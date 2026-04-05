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

    // Buttons
    const btnArea = document.createElement('div');
    btnArea.className = 'btn-area';

    // Row 1: Back / Forward
    const row1 = this._btnRow();
    this._addBtn(row1, '\u2190 Back', () => this.state.goBack(), 'half');
    this._addBtn(row1, 'Fwd \u2192', () => this.state.goForward(), 'half');
    btnArea.appendChild(row1);

    // Row 2: Engine Move / Paste PGN
    const row2 = this._btnRow();
    this._addBtn(row2, 'Engine Move', () => this.moveHandler.requestEngineCalculation(), 'half');
    this._addBtn(row2, 'Paste PGN', () => this._pastePGN(), 'half');
    btnArea.appendChild(row2);

    // Full-width buttons
    this._addBtn(btnArea, 'Flip Board', () => this.state.flipBoard());
    this.versusBtn = this._addBtn(btnArea, '2P Mode', () => {
      this.state.toggleVersusMode();
      this.versusBtn.textContent = this.state.versusMode ? '1P Mode' : '2P Mode';
    });
    this._addBtn(btnArea, 'Share Position', () => this._sharePosition());
    this._addBtn(btnArea, 'Export Mermaid', () => this._exportMermaid());
    this._addBtn(btnArea, 'Save Position', () => this._openSaveDialog());
    this._addBtn(btnArea, 'Load Position', () => this._openLoadDialog());
    this._addBtn(btnArea, 'Setup Board', () => this._enterSetupMode());
    this._addBtn(btnArea, 'New Game', () => this.state.newGame());

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
    this.moveList.textContent = lines.slice(-8).join('\n');
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
    const visited = new Set();

    const nodeLabel = (n) => {
      let label = n.san || 'Start';
      if (n.annotation) label += n.annotation;
      if (n.note) label += ` "${n.note.substring(0, 20)}"`;
      return label.replace(/"/g, '#quot;');
    };

    const nodeId = (n) => `n${n.id}`;

    const walk = (node) => {
      if (visited.has(node.id)) return;
      visited.add(node.id);
      for (const child of node.children) {
        lines.push(`    ${nodeId(node)}["${nodeLabel(node)}"] --> ${nodeId(child)}["${nodeLabel(child)}"]`);
        walk(child);
      }
      // Leaf nodes with no children still need to be declared
      if (!node.children.length && !node.parent) {
        lines.push(`    ${nodeId(node)}["${nodeLabel(node)}"]`);
      }
    };

    walk(state.treeRoot);

    const mmd = lines.join('\n');
    const blob = new Blob([mmd], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'branchess-tree.mmd';
    a.click();
    URL.revokeObjectURL(a.href);

    state.status = 'Exported Mermaid file';
    state.emit('boardChanged');
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
