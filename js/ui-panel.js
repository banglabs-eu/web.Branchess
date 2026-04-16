// Side panel: buttons, status, branch info, move list
import { COLOR_TEXT, COLOR_TEXT_DIM, COLOR_BTN_ACTIVE, UNICODE_PIECES } from './constants.js';
import { GameNode } from './game-tree.js';
import { t, onLangChange } from './i18n.js';
import { ravToTree, treeToRAV } from './pgn-rav.js';
import { encodeGameURL, downloadPGN } from './sharing.js';

export class UIPanel {
  constructor(container, state, moveHandler) {
    this.container = container;
    this.treeAreaEl = document.getElementById('tree-area');
    this.infoAreaEl = document.getElementById('info-area');
    this.boardAreaEl = document.getElementById('board-area');
    this.state = state;
    this.moveHandler = moveHandler;
    this._build();

    state.on('boardChanged', () => { this._updateStatus(); this._updateCapturedPieces(); this._updateMoveList(); });
    state.on('treeChanged', () => this._updateMoveList());
    state.on('mermaidExportConfirm', (filename) => this._doMermaidDownload(filename));
    state.on('exportMermaid', () => this._exportMermaid());
    state.on('loadMermaidFile', () => this._loadMermaidFile());
    onLangChange(() => this._build());

    // Save/Load menu actions
    state.on('saveAsPGN', () => this._exportPGN());
    state.on('saveAsURL', () => this._shareGame());
    state.on('saveAsMermaid', () => this._exportMermaid());
    state.on('loadAsPGN', () => this.state.emit('openLoadPGNDialog'));
    state.on('loadAsMermaid', () => this._loadMermaidFile());

    // Triggered by the Load PGN dialog
    state.on('loadPGNText', (text) => this._importPGN(text));
    state.on('loadLichessURL', (url) => this._loadLichessFromURL(url));
  }

  _build() {
    // --- Tree area (full background) ---
    this.treeAreaEl.innerHTML = '';

    // Tree container
    if (!this.treeContainer) {
      this.treeContainer = document.createElement('div');
      this.treeContainer.className = 'tree-container';
    }
    this.treeAreaEl.appendChild(this.treeContainer);

    // --- Board area: piece tray (left) + board + buttons (right) ---
    // Clear old tray/buttons if rebuilding
    if (this.capturedEl) this.capturedEl.remove();
    if (this._btnBox) this._btnBox.remove();

    // Piece tray (vertical, left of board)
    this.capturedEl = document.createElement('div');
    this.capturedEl.className = 'captured-tray';
    this.boardAreaEl.insertBefore(this.capturedEl, this.boardAreaEl.firstChild);

    // Buttons box (vertical, right of board)
    this._btnBox = document.createElement('div');
    this._btnBox.className = 'btn-box';

    this._hamburgerBtn = document.createElement('button');
    this._hamburgerBtn.className = 'hamburger-btn';
    this._hamburgerBtn.ariaLabel = 'Menu';
    this._hamburgerBtn.textContent = '\u2630';
    this._hamburgerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._toggleMenu();
    });
    this._btnBox.appendChild(this._hamburgerBtn);

    const helpBtn = document.createElement('button');
    helpBtn.id = 'help-btn';
    helpBtn.className = 'help-btn';
    helpBtn.ariaLabel = 'Help';
    helpBtn.textContent = '?';
    this._btnBox.appendChild(helpBtn);

    this.boardAreaEl.appendChild(this._btnBox);

    // Hamburger dropdown menu
    if (this._menuEl) this._menuEl.remove();
    this._menuEl = this._buildMenu();
    document.body.appendChild(this._menuEl);

    // --- Info area (floating moves panel) ---
    this.infoAreaEl.innerHTML = '';

    // Drag title bar
    const infoTitle = document.createElement('div');
    infoTitle.className = 'float-title';
    infoTitle.textContent = 'Moves';
    this.infoAreaEl.appendChild(infoTitle);

    const movesSection = document.createElement('div');
    movesSection.className = 'moves-section';

    // Status (whose turn)
    this.statusEl = document.createElement('div');
    this.statusEl.className = 'panel-status';
    movesSection.appendChild(this.statusEl);

    // Move list
    this.moveList = document.createElement('div');
    this.moveList.className = 'move-list';
    movesSection.appendChild(this.moveList);

    // Move input (always visible)
    this.moveInput = document.createElement('input');
    this.moveInput.type = 'text';
    this.moveInput.className = 'move-input';
    this.moveInput.placeholder = 'Type moves: e4 e5 Nf3...';
    movesSection.appendChild(this.moveInput);

    // Comment/note for current move
    this.noteArea = document.createElement('textarea');
    this.noteArea.className = 'note-area';
    this.noteArea.placeholder = 'Add a comment for this move...';
    this.noteArea.rows = 2;
    movesSection.appendChild(this.noteArea);

    // Branch info at bottom
    this.branchInfo = document.createElement('div');
    this.branchInfo.className = 'branch-info';
    movesSection.appendChild(this.branchInfo);

    this.infoAreaEl.appendChild(movesSection);

    this.moveInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = this.moveInput.value.trim();
        if (val) this._playTypedMoves(val);
        this.moveInput.value = '';
      }
    });
    this.moveInput.addEventListener('input', () => this._validateMoveInput());

    // Save note on change
    this.noteArea.addEventListener('input', () => {
      const node = this.state.currentNode;
      if (node) {
        node.note = this.noteArea.value;
        this.state.emit('treeChanged');
      }
    });

    this._updateStatus();
    this._updateCapturedPieces();
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

  // --- Hamburger menu ---

  _buildMenu() {
    const menu = document.createElement('div');
    menu.className = 'hamburger-menu';
    menu.style.display = 'none';

    // Engine section
    this._addMenuSection(menu, t('engine'));
    this._addMenuItem(menu, t('bestWhite'), 'Space', () => this.moveHandler.showBestMove('w'));
    this._addMenuItem(menu, t('bestBlack'), '', () => this.moveHandler.showBestMove('b'));

    // File section
    this._addMenuSection(menu, t('games'));
    this._addMenuItem(menu, 'Save / Load...', 'Ctrl+S', () => this.state.emit('openFileDialog'));

    // Board section
    this._addMenuSection(menu, t('board'));
    this._addMenuItem(menu, t('rotateBoard'), 'R', () => this.state.rotateBoard());
    this._addMenuItem(menu, t('resetBoard'), 'N', () => this.state.newGame());

    // Stop clicks inside menu from propagating to the close handler
    menu.addEventListener('click', (e) => e.stopPropagation());

    return menu;
  }

  _addMenuSection(parent, title) {
    const el = document.createElement('div');
    el.className = 'menu-section-title';
    el.textContent = title;
    parent.appendChild(el);
  }

  _addMenuItem(parent, label, shortcut, onClick) {
    const item = document.createElement('div');
    item.className = 'menu-item';

    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;

    item.appendChild(labelSpan);

    if (shortcut) {
      const shortcutSpan = document.createElement('span');
      shortcutSpan.className = 'menu-shortcut';
      shortcutSpan.textContent = shortcut;
      item.appendChild(shortcutSpan);
    }

    item.addEventListener('click', () => {
      this._closeMenu();
      onClick();
    });
    parent.appendChild(item);
  }

  _toggleMenu() {
    if (!this._menuEl) return;
    const open = this._menuEl.style.display !== 'none';
    if (open) {
      this._closeMenu();
    } else {
      // Position below the hamburger button
      const rect = this._hamburgerBtn.getBoundingClientRect();
      this._menuEl.style.left = rect.left + 'px';
      this._menuEl.style.top = rect.bottom + 4 + 'px';
      this._menuEl.style.display = '';
      // Close on next click outside
      this._menuCloseHandler = () => this._closeMenu();
      setTimeout(() => document.addEventListener('click', this._menuCloseHandler, { once: true }), 0);
    }
  }

  _closeMenu() {
    if (!this._menuEl) return;
    this._menuEl.style.display = 'none';
    if (this._menuCloseHandler) {
      document.removeEventListener('click', this._menuCloseHandler);
      this._menuCloseHandler = null;
    }
  }

  _updateCapturedPieces() {
    if (!this.capturedEl) return;
    this.capturedEl.innerHTML = '';

    const chess = this.state.chess;
    const board = chess.board();

    // Count pieces currently on the board
    const onBoard = { w: { k: 0, q: 0, r: 0, b: 0, n: 0, p: 0 }, b: { k: 0, q: 0, r: 0, b: 0, n: 0, p: 0 } };
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p) onBoard[p.color][p.type]++;
      }
    }

    const types = ['k', 'q', 'r', 'b', 'n', 'p'];
    const starting = { k: 1, q: 1, r: 2, b: 2, n: 2, p: 8 };

    // Show all pieces for each color, with count captured (off the board)
    for (const color of ['w', 'b']) {
      const row = document.createElement('div');
      row.className = 'captured-row';

      for (const pt of types) {
        const count = Math.max(0, starting[pt] - onBoard[color][pt]);

        const cell = document.createElement('div');
        cell.className = 'captured-cell';
        cell.draggable = true;
        cell.dataset.pieceType = pt;
        cell.dataset.pieceColor = color;

        // Drag start: store piece info for drop on board
        cell.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', JSON.stringify({ type: pt, color }));
          e.dataTransfer.effectAllowed = 'copy';
        });

        const icon = document.createElement('span');
        icon.className = 'captured-piece ' + (color === 'w' ? 'piece-white' : 'piece-black');
        icon.textContent = UNICODE_PIECES[pt];

        const countEl = document.createElement('span');
        countEl.className = 'captured-count';
        countEl.textContent = count;

        cell.append(icon, countEl);
        row.appendChild(cell);
      }

      this.capturedEl.appendChild(row);
    }
  }

  _updateStatus() {
    const s = this.state.status;

    // Rebuild status: optional spinner + text
    this.statusEl.innerHTML = '';
    if (this.state.engineThinking) {
      const spinner = document.createElement('span');
      spinner.className = 'thinking-spinner';
      this.statusEl.appendChild(spinner);
    }
    this.statusEl.appendChild(document.createTextNode(s));

    if (this.state.engineThinking) {
      this.statusEl.style.color = 'rgb(220,180,80)';
    } else if (this.state.gameOver) {
      this.statusEl.style.color = 'rgb(220,80,80)';
    } else if (s === t('yourMove')) {
      this.statusEl.style.color = 'rgb(120,220,120)';
    } else {
      this.statusEl.style.color = COLOR_TEXT;
    }
    this._updateMoveList();
    this._updateNavButtons();
  }

  _updateNavButtons() {
    // Back/forward buttons removed — navigation via scroll wheel and arrow keys
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

    // Move list with annotations
    const path = state.currentNode.pathFromRoot();
    const nodes = path.slice(1).filter(n => n.san);
    const lines = [];
    for (let i = 0; i < nodes.length; i += 2) {
      const num = Math.floor(i / 2) + 1;
      let line = `${num}. ${nodes[i].san}${nodes[i].annotation || ''}`;
      if (i + 1 < nodes.length) line += `  ${nodes[i + 1].san}${nodes[i + 1].annotation || ''}`;
      lines.push(line);
    }
    if (lines.length) {
      this.moveList.textContent = lines.join('\n');
      this.moveList.scrollTop = this.moveList.scrollHeight;
      this.moveList.classList.remove('move-list-empty');
    } else {
      this.moveList.textContent = 'No moves yet';
      this.moveList.classList.add('move-list-empty');
    }

    // Update note area for current move
    if (this.noteArea && document.activeElement !== this.noteArea) {
      this.noteArea.value = state.currentNode.note || '';
    }
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
      state.status = chess.turn() === 'w' ? t('whiteToMove') : t('blackToMove');
    }
    state.emit('boardChanged');
    state.emit('treeChanged');
    return true;
  }

  async _loadLichessFromURL(url) {
    if (this.state.engineThinking) return;
    if (!url) return;
    await this._loadLichess(url);
  }

  async _loadLichess(urlInput) {
    if (this.state.engineThinking) return;
    const input = urlInput || window.prompt('Paste a Lichess game or study URL:');
    if (!input) return;

    const trimmed = input.trim();

    // Detect study URL: /study/{id} or /study/{id}/{chapterId}
    const studyMatch = trimmed.match(/lichess\.org\/study\/([a-zA-Z0-9]{8})/);
    if (studyMatch) {
      const studyId = studyMatch[1];
      this.state.status = 'Loading study from Lichess...';
      this.state.emit('boardChanged');
      try {
        const resp = await fetch(`https://lichess.org/api/study/${studyId}.pgn`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const pgn = await resp.text();
        this._importMultiPGN(pgn);
      } catch (err) {
        this.state.status = `Lichess error: ${err.message}`;
        this.state.emit('boardChanged');
      }
      return;
    }

    // Extract game ID: first 8-char alphanumeric segment
    const match = trimmed.match(/([a-zA-Z0-9]{8})/);
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

  _importMultiPGN(pgnText) {
    const games = pgnText.split(/\n\n(?=\[)/).filter(g => g.trim());
    if (!games.length) {
      this.state.status = 'No games found in study';
      this.state.emit('boardChanged');
      return;
    }

    if (games.length === 1) {
      this._importPGN(games[0]);
      return;
    }

    // Parse chapter names from PGN headers
    const chapters = games.map((pgn, i) => {
      const nameMatch = pgn.match(/\[ChapterName "([^"]+)"\]/);
      const whiteMatch = pgn.match(/\[White "([^"]+)"\]/);
      const blackMatch = pgn.match(/\[Black "([^"]+)"\]/);
      const name = nameMatch ? nameMatch[1]
        : (whiteMatch && blackMatch) ? `${whiteMatch[1]} vs ${blackMatch[1]}`
        : `Chapter ${i + 1}`;
      return { name, pgn };
    });

    // Show chapter picker dialog
    this.state.emit('openStudyChapterDialog', chapters, (chapter) => {
      this._importPGN(chapter.pgn);
    });
  }

  _importPGN(pgnText) {
    const state = this.state;

    let root;
    try {
      root = ravToTree(pgnText);
    } catch {
      state.status = 'Invalid PGN';
      state.emit('boardChanged');
      return;
    }

    this._loadTree(root);
  }

  // Load a GameNode tree into the game state (used by import and sharing)
  _loadTree(root, statusMsg) {
    const state = this.state;

    state.treeRoot = root;
    state.invalidateTreeLayout();
    state.treeScrollX = 0;
    state.treeScrollY = 0;
    state.treeZoom = 1;

    // Walk to the last move on the main line
    let node = root;
    let count = 0;
    while (node.children.length) {
      node = node.children[0];
      count++;
    }

    state.chess.load(node.fen);
    state.currentNode = node;
    state.lastMove = node.move ? { from: node.move.from, to: node.move.to } : null;
    state.selectedSq = null;
    state.legalDests = new Set();
    state.gameOver = false;
    state.lastMovedPieceColor = null;
    state.checkGameOver();

    if (statusMsg) {
      state.status = statusMsg;
    } else if (!state.gameOver) {
      const turn = state.chess.turn() === 'w' ? 'White' : 'Black';
      state.status = `PGN loaded (${count} moves) \u2014 ${turn} to move`;
    }
    state.invalidateTreeLayout();
    state.emit('boardChanged');
    state.emit('treeChanged');
  }

  _openSaveDialog() {
    this.state.emit('openSaveDialog');
  }

  _openLoadDialog() {
    this.state.emit('openLoadDialog');
  }

  _shareGame() {
    const { url, tooLong } = encodeGameURL(this.state.treeRoot);
    if (tooLong) {
      this.state.status = t('shareTooLong');
      this.state.emit('boardChanged');
      // Still copy — it might work in some contexts
      navigator.clipboard.writeText(url).catch(() => {});
      return;
    }
    navigator.clipboard.writeText(url).then(() => {
      this.state.status = t('shareCopied');
      this.state.emit('boardChanged');
    }).catch(() => {
      prompt('Share this URL:', url);
    });
  }

  _exportPGN() {
    const date = new Date().toISOString().slice(0, 10);
    const name = downloadPGN(this.state.treeRoot, `branchess-${date}`);
    this.state.status = `Exported: ${name}`;
    this.state.emit('boardChanged');
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
    this._pendingMermaidContent = mmd;
    state.emit('openMermaidExportDialog');
  }

  _doMermaidDownload(filename) {
    const mmd = this._pendingMermaidContent;
    if (!mmd) return;
    const name = filename.endsWith('.mmd') ? filename : filename + '.mmd';
    const blob = new Blob([mmd], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
    this._pendingMermaidContent = null;
    this.state.status = `Exported: ${name}`;
    this.state.emit('boardChanged');
  }

  _showMermaidMenu() {
    this.state.emit('openMermaidMenu');
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
