// StochasticEngine — wraps Stockfish WASM worker, softmax move selection, position cache
// Ported from Branchess.py lines 175-251

export class StochasticEngine {
  constructor() {
    this._worker = null;
    this._ready = false;
    this._readyPromise = null;
    this._resolveReady = null;
    this._cache = new Map();
    this._currentStrength = null;
    this._analysisResolve = null;
    this._analysisLines = [];
    this._init();
  }

  _init() {
    this._readyPromise = new Promise(r => { this._resolveReady = r; });

    try {
      // The stockfish.wasm worker uses importScripts internally
      this._worker = new Worker('js/stockfish-worker.js');
    } catch (e) {
      console.error('Failed to create Stockfish worker:', e);
      return;
    }

    this._worker.onmessage = (e) => this._handleMessage(e.data);
    this._worker.onerror = (e) => console.error('Stockfish worker error:', e);

    // nmrugg/stockfish.js auto-initializes, send uci with retry
    this._initRetryCount = 0;
    this._sendUciInit();
  }

  _sendUciInit() {
    this._send('uci');
    this._initRetryCount++;
    if (this._initRetryCount < 20) {
      this._initTimer = setTimeout(() => {
        if (!this._ready) this._sendUciInit();
      }, 500);
    }
  }

  _handleMessage(line) {
    if (typeof line !== 'string') return;

    if (line === 'uciok') {
      if (this._initTimer) clearTimeout(this._initTimer);
      this._send('setoption name MultiPV value 5');
      this._send('isready');
      return;
    }
    if (line === 'readyok') {
      if (!this._ready) {
        this._ready = true;
        this._resolveReady();
      }
      return;
    }
    if (typeof line === 'string' && line.startsWith('info') && line.includes(' pv ')) {
      const parsed = this._parseInfoLine(line);
      if (parsed) this._analysisLines.push(parsed);
      return;
    }
    if (typeof line === 'string' && line.startsWith('bestmove')) {
      if (this._analysisResolve) {
        this._analysisResolve(this._analysisLines);
        this._analysisResolve = null;
        this._analysisLines = [];
      }
    }
  }

  _parseInfoLine(line) {
    const parts = line.split(' ');
    let score = null;
    let pv = null;
    let multipv = null;

    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === 'multipv') multipv = parseInt(parts[i + 1]);
      if (parts[i] === 'score' && parts[i + 1] === 'cp') score = parseInt(parts[i + 2]);
      if (parts[i] === 'score' && parts[i + 1] === 'mate') score = parseInt(parts[i + 2]) * 10000;
      if (parts[i] === 'pv') pv = parts[i + 1];
    }

    if (pv && score !== null) return { score, move: pv, multipv };
    return null;
  }

  _send(cmd) {
    if (this._worker) this._worker.postMessage(cmd);
  }

  static _cacheKey(fen) {
    return fen.split(' ').slice(0, 4).join(' ');
  }

  async getMove(fen, strengthParams) {
    // Update strength if changed
    const strengthKey = JSON.stringify(strengthParams);
    if (this._currentStrength !== strengthKey) {
      this._currentStrength = strengthKey;
      this._cache.clear();
      await this._readyPromise;
      this._send(`setoption name Skill Level value ${strengthParams.skill}`);
    }

    const key = StochasticEngine._cacheKey(fen);
    if (this._cache.has(key)) return this._cache.get(key);

    await this._readyPromise;

    this._send(`position fen ${fen}`);
    this._send(`go movetime ${strengthParams.thinkTime}`);

    const lines = await new Promise(r => {
      this._analysisResolve = r;
      this._analysisLines = [];
    });

    if (!lines.length) return null;

    // Deduplicate: keep highest multipv number for each unique move
    const byMove = new Map();
    for (const l of lines) {
      const existing = byMove.get(l.move);
      if (!existing || (l.multipv && (!existing.multipv || l.multipv >= existing.multipv))) {
        byMove.set(l.move, l);
      }
    }
    const candidates = [...byMove.values()].sort((a, b) => b.score - a.score).slice(0, 5);

    // Softmax selection
    const chosen = this._softmaxSelect(candidates, strengthParams.temperature);

    // Convert UCI move (e.g. "e2e4") to {from, to, promotion?}
    const moveObj = this._uciToMove(chosen.move);
    this._cache.set(key, moveObj);
    return moveObj;
  }

  _softmaxSelect(candidates, temperature) {
    if (candidates.length === 1 || temperature <= 0) return candidates[0];

    const scores = candidates.map(c => c.score);
    const scaled = scores.map(s => s / (temperature * 100));
    const maxS = Math.max(...scaled);
    const exps = scaled.map(s => Math.exp(s - maxS));
    const total = exps.reduce((a, b) => a + b, 0);
    const weights = exps.map(e => e / total);

    // Weighted random choice
    const r = Math.random();
    let cumulative = 0;
    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i];
      if (r <= cumulative) return candidates[i];
    }
    return candidates[candidates.length - 1];
  }

  async analyze(fen) {
    await this._readyPromise;

    // Use max strength for analysis
    this._send('setoption name Skill Level value 20');
    this._send(`position fen ${fen}`);
    this._send('go movetime 1500');

    const lines = await new Promise(r => {
      this._analysisResolve = r;
      this._analysisLines = [];
    });

    // Restore previous skill level on next getMove call
    this._currentStrength = null;

    if (!lines.length) return null;

    const byMove = new Map();
    for (const l of lines) {
      const existing = byMove.get(l.move);
      if (!existing || (l.multipv && (!existing.multipv || l.multipv >= existing.multipv))) {
        byMove.set(l.move, l);
      }
    }
    const best = [...byMove.values()].sort((a, b) => b.score - a.score)[0];
    if (!best) return null;

    return { move: this._uciToMove(best.move), score: best.score };
  }

  _uciToMove(uci) {
    const from = uci.substring(0, 2);
    const to = uci.substring(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    return { from, to, promotion };
  }

  terminate() {
    if (this._worker) {
      this._send('quit');
      this._worker.terminate();
      this._worker = null;
    }
  }
}
