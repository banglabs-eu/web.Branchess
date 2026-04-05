// Side panel: buttons, status, strength slider, branch info, move list
import { COLOR_TEXT, COLOR_TEXT_DIM, COLOR_BTN_ACTIVE } from './constants.js';
import { GameNode } from './game-tree.js';

export class UIPanel {
  constructor(container, state, moveHandler) {
    this.container = container;
    this.state = state;
    this.moveHandler = moveHandler;
    this._build();

    state.on('boardChanged', () => this._updateStatus());
    state.on('treeChanged', () => this._updateMoveList());
  }

  _build() {
    this.container.innerHTML = '';
    this.container.classList.add('panel');

    // Title
    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = 'Branchess {\u2657}';
    this.container.appendChild(title);

    // Status
    this.statusEl = document.createElement('div');
    this.statusEl.className = 'panel-status';
    this.container.appendChild(this.statusEl);

    // Tree container (will be populated by TreeView)
    this.treeContainer = document.createElement('div');
    this.treeContainer.className = 'tree-container';
    this.container.appendChild(this.treeContainer);

    // Branch info + move list
    this.branchInfo = document.createElement('div');
    this.branchInfo.className = 'branch-info';
    this.container.appendChild(this.branchInfo);

    this.moveList = document.createElement('div');
    this.moveList.className = 'move-list';
    this.container.appendChild(this.moveList);

    // Move input: appears on double-click of move list
    this.moveInput = document.createElement('input');
    this.moveInput.type = 'text';
    this.moveInput.className = 'move-input';
    this.moveInput.placeholder = 'e.g. e4 e5 or Nf3';
    this.moveInput.style.display = 'none';
    this.container.appendChild(this.moveInput);

    this.moveList.addEventListener('dblclick', () => this._enterMoveInput());
    this.moveInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this._playTypedMoves(this.moveInput.value.trim());
        this.moveInput.value = '';
      } else if (e.key === 'Escape') {
        this._exitMoveInput();
      }
    });
    this.moveInput.addEventListener('blur', () => this._exitMoveInput());
    this.moveInput.addEventListener('input', () => this._validateMoveInput());

    // Buttons
    const btnArea = document.createElement('div');
    btnArea.className = 'btn-area';

    // --- Navigation ---
    const navSection = this._section('Navigation');
    const navRow = this._btnRow();
    this._addBtn(navRow, '\u2190 Back', () => this.state.goBack(), 'half');
    this._addBtn(navRow, 'Fwd \u2192', () => this.state.goForward(), 'half');
    navSection.appendChild(navRow);
    this._addBtn(navSection, 'Flip Board', () => this.state.flipBoard());
    btnArea.appendChild(navSection);

    // --- Engine ---
    const engineSection = this._section('Engine');
    const engineRow = this._btnRow();
    this._addBtn(engineRow, 'Engine Move', () => this.moveHandler.requestEngineCalculation(), 'half');
    this.pauseEngineBtn = this._addBtn(engineRow, 'Pause Engine', () => {
      this.state.enginePaused = !this.state.enginePaused;
      this.pauseEngineBtn.textContent = this.state.enginePaused ? 'Resume Engine' : 'Pause Engine';
    }, 'half');
    engineSection.appendChild(engineRow);
    this._addBtn(engineSection, 'Best Move', () => this.moveHandler.showBestMove());
    this.versusBtn = this._addBtn(engineSection, '2P Mode', () => {
      this.state.toggleVersusMode();
      this.versusBtn.textContent = this.state.versusMode ? '1P Mode' : '2P Mode';
    });
    btnArea.appendChild(engineSection);

    // --- Save & Load ---
    const saveSection = this._section('Save & Load');
    const savePosRow = this._btnRow();
    this._addBtn(savePosRow, 'Save Position', () => this._openSaveDialog(), 'half');
    this._addBtn(savePosRow, 'Load Position', () => this._openLoadDialog(), 'half');
    saveSection.appendChild(savePosRow);
    const saveGameRow = this._btnRow();
    this._addBtn(saveGameRow, 'Save Game', () => this.state.emit('openSaveGameDialog'), 'half');
    this._addBtn(saveGameRow, 'Load Game', () => this.state.emit('openLoadGameDialog'), 'half');
    saveSection.appendChild(saveGameRow);
    btnArea.appendChild(saveSection);

    // --- Import & Export ---
    const ioSection = this._section('Import & Export');
    const importRow = this._btnRow();
    this._addBtn(importRow, 'Paste PGN', () => this._pastePGN(), 'half');
    this._addBtn(importRow, 'Load Lichess', () => this._loadLichess(), 'half');
    ioSection.appendChild(importRow);
    this._addBtn(ioSection, 'Share Position', () => this._sharePosition());
    const mermaidRow = this._btnRow();
    this._addBtn(mermaidRow, 'Export Mermaid', () => this._exportMermaid(), 'half');
    this._addBtn(mermaidRow, 'Load Mermaid', () => this._loadMermaidFile(), 'half');
    ioSection.appendChild(mermaidRow);
    btnArea.appendChild(ioSection);

    // --- Board ---
    const boardSection = this._section('Board');
    this._addBtn(boardSection, 'Setup Board', () => this._enterSetupMode());
    this._addBtn(boardSection, 'New Game', () => this.state.newGame());
    this.themeBtn = this._addBtn(boardSection, 'Theme: Classic', () => this._toggleTheme());
    btnArea.appendChild(boardSection);

    this.container.appendChild(btnArea);

    // Strength slider
    this.sliderArea = document.createElement('div');
    this.sliderArea.className = 'slider-area';
    this._buildSlider();
    this.container.appendChild(this.sliderArea);

    // Keyboard hints
    const hints = document.createElement('div');
    hints.className = 'hints';
    hints.textContent = 'U:undo F:flip \u2190\u2192\u2191\u2193:nav Space:engine Ctrl+V:pgn';
    this.container.appendChild(hints);

    this._updateStatus();
    this._updateMoveList();
  }

  _section(title) {
    const section = document.createElement('div');
    section.className = 'btn-section';
    const heading = document.createElement('div');
    heading.className = 'btn-section-title';
    heading.textContent = title;
    section.appendChild(heading);
    return section;
  }

  _btnRow() {
    const row = document.createElement('div');
    row.className = 'btn-row';
    return row;
  }

  _addBtn(parent, label, onClick, size = 'full') {
    const btn = document.createElement('button');
    btn.className = `panel-btn ${size === 'half' ? 'btn-half' : 'btn-full'}`;
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    parent.appendChild(btn);
    return btn;
  }

  _buildSlider() {
    this.sliderArea.innerHTML = '';
    this._updateSliderLabel();

    this.slider = document.createElement('input');
    this.slider.type = 'range';
    this.slider.min = '0';
    this.slider.max = '100';
    this.slider.value = this.state.strength;
    this.slider.className = 'strength-slider';

    this.slider.addEventListener('input', () => {
      this.state.strength = parseInt(this.slider.value);
      this._updateSliderLabel();
      this._updateSliderTrack();
    });

    this.sliderArea.appendChild(this.slider);
    this._updateSliderTrack();
  }

  _updateSliderLabel() {
    const p = this.state.strengthParams();
    const tempStr = p.temperature > 0 ? p.temperature.toFixed(1) : 'off';
    const text = `Skill ${p.skill}/20 | Think ${p.thinkTime}ms | Temp ${tempStr}`;

    if (!this.sliderLabel) {
      this.sliderLabel = document.createElement('div');
      this.sliderLabel.className = 'slider-label';
      this.sliderArea.appendChild(this.sliderLabel);
    }
    this.sliderLabel.textContent = text;
  }

  _updateSliderTrack() {
    const t = this.state.strength / 100;
    // Cool blue (low) → warm orange (mid) → hot red (high)
    let r, g, b;
    if (t < 0.5) {
      const s = t * 2; // 0-1 over first half
      r = Math.round(60 + s * 200);
      g = Math.round(120 + s * 80);
      b = Math.round(220 - s * 120);
    } else {
      const s = (t - 0.5) * 2; // 0-1 over second half
      r = Math.round(260 - s * 30);
      g = Math.round(200 - s * 160);
      b = Math.round(100 - s * 70);
    }
    const color = `rgb(${r},${g},${b})`;
    const pct = this.state.strength + '%';
    this.slider.style.setProperty('--slider-color', color);
    this.slider.style.setProperty('--val', pct);
    // Fallback for Firefox (no ::webkit track)
    this.slider.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${pct}, #3c3a37 ${pct}, #3c3a37 100%)`;
  }

  _updateStatus() {
    const s = this.state.status;
    this.statusEl.textContent = s;
    if (s.includes('Your')) {
      this.statusEl.style.color = 'rgb(120,220,120)';
    } else if (s.toLowerCase().includes('think') || s.toLowerCase().includes('calculat')) {
      this.statusEl.style.color = 'rgb(220,180,80)';
    } else if (s.toLowerCase().includes('mate') || s.toLowerCase().includes('draw')) {
      this.statusEl.style.color = 'rgb(220,80,80)';
    } else {
      this.statusEl.style.color = COLOR_TEXT;
    }
    this._updateMoveList();
  }

  _updateMoveList() {
    const state = this.state;
    const depth = state.currentNode.depth();
    const moveNum = Math.ceil(depth / 2);
    let info = `Ply ${depth}`;
    if (moveNum > 0) info = `Move ${moveNum}, ply ${depth}`;

    const parent = state.currentNode.parent;
    if (parent && parent.children.length > 1) {
      const idx = parent.children.indexOf(state.currentNode) + 1;
      info += `  |  Branch ${idx}/${parent.children.length}`;
    }
    this.branchInfo.textContent = info;

    // Move list
    const path = state.currentNode.pathFromRoot();
    const moves = path.slice(1).filter(n => n.san).map(n => n.san);
    const lines = [];
    for (let i = 0; i < moves.length; i += 2) {
      const num = Math.floor(i / 2) + 1;
      let line = `${num}. ${moves[i]}`;
      if (i + 1 < moves.length) line += `  ${moves[i + 1]}`;
      lines.push(line);
    }
    if (lines.length) {
      this.moveList.textContent = lines.slice(-8).join('\n');
      this.moveList.classList.remove('move-list-empty');
    } else {
      this.moveList.textContent = 'Double-click to type moves';
      this.moveList.classList.add('move-list-empty');
    }
  }

  _enterMoveInput() {
    this.moveInput.style.display = '';
    this.moveInput.focus();
  }

  _exitMoveInput() {
    this.moveInput.style.display = 'none';
    this.moveInput.value = '';
    this.moveInput.classList.remove('move-input-invalid');
  }

  _validateMoveInput() {
    const text = this.moveInput.value.trim();
    if (!text) {
      this.moveInput.classList.remove('move-input-invalid');
      return;
    }
    const chess = this.state.chess;
    const moves = text.split(/\s+/);
    let valid = true;
    const undos = [];
    for (const m of moves) {
      try {
        chess.move(m);
        undos.push(true);
      } catch {
        valid = false;
        break;
      }
    }
    for (const _ of undos) chess.undo();
    this.moveInput.classList.toggle('move-input-invalid', !valid);
  }

  _playTypedMoves(text) {
    if (!text) return;
    const moves = text.split(/\s+/);
    for (const m of moves) {
      if (!this._playTypedMove(m)) break;
    }
  }

  _playTypedMove(text) {
    if (!text) return false;
    const state = this.state;
    const chess = state.chess;

    let result;
    try {
      result = chess.move(text);
    } catch {
      state.status = `Invalid move: ${text}`;
      state.emit('boardChanged');
      return false;
    }

    const existing = state.currentNode.findChild({ from: result.from, to: result.to, promotion: result.promotion || '' });
    if (existing) {
      chess.undo();
      state.navigateTo(existing);
    } else {
      const child = state.currentNode.addChild(
        { from: result.from, to: result.to, promotion: result.promotion },
        chess.fen(),
        result.san
      );
      state.currentNode = child;
      state.invalidateTreeLayout();
    }

    state.lastMove = { from: result.from, to: result.to };
    state.selectedSq = null;
    state.legalDests = new Set();
    state.checkGameOver();
    if (!state.gameOver) {
      state.status = chess.turn() === 'w' ? 'White to move' : 'Black to move';
    }
    state.emit('boardChanged');
    state.emit('treeChanged');
    return true;
  }

  async _loadLichess() {
    if (this.state.engineThinking) return;
    const input = window.prompt('Paste a Lichess game URL or ID:');
    if (!input) return;

    // Extract game ID: last path segment, first 8 chars
    const match = input.trim().match(/([a-zA-Z0-9]{8})/);
    if (!match) {
      this.state.status = 'Invalid Lichess URL or game ID';
      this.state.emit('boardChanged');
      return;
    }
    const gameId = match[1];

    this.state.status = 'Loading from Lichess...';
    this.state.emit('boardChanged');

    try {
      const resp = await fetch(`https://lichess.org/game/export/${gameId}`, {
        headers: { 'Accept': 'application/x-chess-pgn' }
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const pgn = await resp.text();
      this._importPGN(pgn);
    } catch (err) {
      this.state.status = `Lichess error: ${err.message}`;
      this.state.emit('boardChanged');
    }
  }

  async _pastePGN() {
    if (this.state.engineThinking) return;
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        this.state.status = 'Clipboard empty';
        this.state.emit('boardChanged');
        return;
      }
      this._importPGN(text);
    } catch {
      this.state.status = 'Clipboard access denied';
      this.state.emit('boardChanged');
    }
  }

  _importPGN(pgnText) {
    const state = this.state;
    const chess = state.chess;

    // Reset and replay
    chess.reset();
    try {
      chess.loadPgn(pgnText);
    } catch {
      state.status = 'Invalid PGN';
      state.emit('boardChanged');
      return;
    }

    const history = chess.history({ verbose: true });
    chess.reset();

    state.treeRoot = new GameNode(chess.fen());
    state.invalidateTreeLayout();
    state.treeScrollX = 0;
    state.treeScrollY = 0;
    state.treeZoom = 1;

    let node = state.treeRoot;
    for (const move of history) {
      const result = chess.move({ from: move.from, to: move.to, promotion: move.promotion });
      const child = node.addChild(
        { from: move.from, to: move.to, promotion: move.promotion },
        chess.fen(),
        result.san
      );
      node = child;
    }

    state.currentNode = node;
    state.lastMove = history.length ? { from: history[history.length - 1].from, to: history[history.length - 1].to } : null;
    state.selectedSq = null;
    state.legalDests = new Set();
    state.gameOver = false;
    state.checkGameOver();

    if (!state.gameOver) {
      const turn = chess.turn() === 'w' ? 'White' : 'Black';
      state.status = `PGN loaded (${history.length} moves) \u2014 ${turn} to move`;
    }
    state.invalidateTreeLayout();
    state.emit('boardChanged');
  }

  _openSaveDialog() {
    this.state.emit('openSaveDialog');
  }

  _openLoadDialog() {
    this.state.emit('openLoadDialog');
  }

  _sharePosition() {
    const fen = this.state.chess.fen();
    const url = new URL(window.location.href.split('?')[0]);
    url.searchParams.set('fen', fen);
    navigator.clipboard.writeText(url.toString()).then(() => {
      this.state.status = 'URL copied to clipboard';
      this.state.emit('boardChanged');
    }).catch(() => {
      // Fallback: show in prompt
      prompt('Share this URL:', url.toString());
    });
  }

  _exportMermaid() {
    const state = this.state;
    const lines = ['graph TD'];
    const meta = ['', '%% branchess-meta'];
    const visited = new Set();

    const nodeLabel = (n) => {
      let label = n.san || 'Start';
      if (n.annotation) label += n.annotation;
      return label.replace(/"/g, '#quot;');
    };

    const nodeId = (n) => `n${n.id}`;
    const noteId = (n) => `note${n.id}`;

    const walk = (node) => {
      if (visited.has(node.id)) return;
      visited.add(node.id);
      // Metadata: fen, move, full annotation/note
      const m = { fen: node.fen };
      if (node.move) m.move = node.move;
      if (node.san) m.san = node.san;
      if (node.annotation) m.ann = node.annotation;
      if (node.note) m.note = node.note;
      meta.push(`%% ${nodeId(node)} ${JSON.stringify(m)}`);
      // Note as a separate box linked to the move
      if (node.note) {
        const noteText = node.note.replace(/"/g, '#quot;');
        lines.push(`    ${noteId(node)}["${noteText}"]:::note -.- ${nodeId(node)}`);
      }
      for (const child of node.children) {
        lines.push(`    ${nodeId(node)}["${nodeLabel(node)}"] --> ${nodeId(child)}["${nodeLabel(child)}"]`);
        walk(child);
      }
      if (!node.children.length && !node.parent) {
        lines.push(`    ${nodeId(node)}["${nodeLabel(node)}"]`);
      }
    };

    walk(state.treeRoot);

    lines.push('    classDef note fill:#fffacd,stroke:#ccc,color:#333,font-size:11px');
    const mmd = lines.join('\n') + '\n' + meta.join('\n') + '\n';
    const blob = new Blob([mmd], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'branchess-tree.mmd';
    a.click();
    URL.revokeObjectURL(a.href);

    state.status = 'Exported Mermaid file';
    state.emit('boardChanged');
  }

  _loadMermaidFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mmd,.mm';
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => this._importMermaid(reader.result);
      reader.readAsText(file);
    });
    input.click();
  }

  _importMermaid(text) {
    const state = this.state;

    // Parse metadata lines: %% nX {"fen":...}
    const metaLines = text.split('\n').filter(l => l.startsWith('%% n'));
    if (!metaLines.length) {
      state.status = 'No Branchess metadata found in file';
      state.emit('boardChanged');
      return;
    }

    // Parse nodes
    const nodes = new Map();
    for (const line of metaLines) {
      const match = line.match(/^%% (n\d+) (.+)$/);
      if (!match) continue;
      const id = match[1];
      const data = JSON.parse(match[2]);
      nodes.set(id, data);
    }

    // Parse edges: nX["..."] --> nY["..."]
    const edges = [];
    for (const line of text.split('\n')) {
      const m = line.match(/(n\d+)\[.*?\]\s*-->\s*(n\d+)\[/);
      if (m) edges.push([m[1], m[2]]);
    }

    // Find root (node with no incoming edges)
    const hasParent = new Set(edges.map(e => e[1]));
    const rootId = [...nodes.keys()].find(id => !hasParent.has(id));
    if (!rootId || !nodes.has(rootId)) {
      state.status = 'Could not find root node in Mermaid file';
      state.emit('boardChanged');
      return;
    }

    // Build tree
    const buildNode = (id, parent) => {
      const data = nodes.get(id);
      const node = new GameNode(data.fen, data.move || null, data.san || '', parent);
      node.annotation = data.ann || '';
      node.note = data.note || '';
      // Find children in edge order
      const childIds = edges.filter(e => e[0] === id).map(e => e[1]);
      for (const childId of childIds) {
        if (nodes.has(childId)) {
          node.children.push(buildNode(childId, node));
        }
      }
      return node;
    };

    const root = buildNode(rootId, null);
    let last = root;
    while (last.children.length) last = last.children[0];

    state.treeRoot = root;
    state.currentNode = last;
    state.chess.load(last.fen);
    state.invalidateTreeLayout();
    state.treeScrollX = 0;
    state.treeScrollY = 0;
    state.treeZoom = 1;
    state.lastMove = last.move ? { from: last.move.from, to: last.move.to } : null;
    state.selectedSq = null;
    state.legalDests = new Set();
    state.gameOver = false;
    state.status = 'Mermaid game loaded';
    state.emit('boardChanged');
    state.emit('treeChanged');
  }

  _toggleTheme() {
    const isBangLabs = document.documentElement.classList.toggle('theme-banglabs');
    this.themeBtn.textContent = isBangLabs ? 'Theme: Bang Labs' : 'Theme: Classic';
    localStorage.setItem('branchess-theme', isBangLabs ? 'banglabs' : 'classic');
    this.state.emit('treeChanged');
    this.state.emit('boardChanged');
  }

  _enterSetupMode() {
    if (this.state.engineThinking) return;
    this.state.setupMode = true;
    this.state.setupPiece = null;
    this.state.setupTurn = this.state.chess.turn();
    this.state.selectedSq = null;
    this.state.legalDests = new Set();
    this.state.emit('setupModeChanged');
  }
}
