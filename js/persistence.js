// IndexedDB save/load + dialogs
// Replaces filesystem-based persistence from Branchess.py

import { serializeTree, deserializeTree } from './game-tree.js';

const DB_NAME = 'Branchess';
const DB_VERSION = 2;
const STORE_NAME = 'positions';
const GAMES_STORE = 'games';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(GAMES_STORE)) {
        db.createObjectStore(GAMES_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onblocked = () => reject(new Error('Database blocked — close other Branchess tabs and retry'));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveGame(name, treeData) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(GAMES_STORE, 'readwrite');
    tx.objectStore(GAMES_STORE).add({ name, tree: treeData, savedAt: new Date().toISOString() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function listGames() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(GAMES_STORE, 'readonly');
    const req = tx.objectStore(GAMES_STORE).getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => b.savedAt.localeCompare(a.savedAt)));
    req.onerror = () => reject(req.error);
  });
}

async function deleteGame(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(GAMES_STORE, 'readwrite');
    tx.objectStore(GAMES_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function savePosition(name, fen) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add({ name, fen, savedAt: new Date().toISOString() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function listPositions() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => b.savedAt.localeCompare(a.savedAt)));
    req.onerror = () => reject(req.error);
  });
}

async function deletePosition(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export class DialogManager {
  constructor(overlayEl, state) {
    this.overlay = overlayEl;
    this.state = state;
    this._currentDialog = null;

    state.on('openSaveDialog', () => this._showSaveDialog());
    state.on('openLoadDialog', () => this._showLoadDialog());
    state.on('openSaveGameDialog', () => this._showSaveGameDialog());
    state.on('openLoadGameDialog', () => this._showLoadGameDialog());
    state.on('openGamesDialog', () => this._showGamesDialog());
    state.on('promotionNeeded', () => this._showPromotionDialog());
    state.on('promotionDone', () => this._close());
    state.on('openMermaidExportDialog', () => this._showMermaidExportDialog());
    state.on('openMermaidMenu', () => this._showMermaidMenu());
    state.on('openPlayEngineDialog', () => this._showPlayEngineDialog());
    state.on('openStudyChapterDialog', (chapters, onSelect) => this._showStudyChapterDialog(chapters, onSelect));
  }

  _close() {
    this.overlay.innerHTML = '';
    this.overlay.style.display = 'none';
    this._currentDialog = null;
  }

  _showOverlay() {
    this.overlay.style.display = 'flex';
  }

  // --- Promotion Dialog ---
  _showPromotionDialog() {
    this._showOverlay();
    this.overlay.innerHTML = '';
    this._currentDialog = 'promotion';

    const box = document.createElement('div');
    box.className = 'dialog promo-dialog';

    const title = document.createElement('div');
    title.className = 'dialog-title';
    title.textContent = 'Promote to:';
    box.appendChild(title);

    const row = document.createElement('div');
    row.className = 'promo-row';
    const turn = this.state.chess.turn();
    const pieces = ['q', 'r', 'b', 'n'];
    const unicodeMap = { q: turn === 'w' ? '\u2655' : '\u265B', r: turn === 'w' ? '\u2656' : '\u265C',
                         b: turn === 'w' ? '\u2657' : '\u265D', n: turn === 'w' ? '\u2658' : '\u265E' };

    for (const p of pieces) {
      const btn = document.createElement('button');
      btn.className = `promo-btn ${turn === 'w' ? 'piece-white' : 'piece-black'}`;
      btn.textContent = unicodeMap[p];
      btn.addEventListener('click', () => {
        // The moveHandler will handle this
        this.state.emit('promotionChoice', p);
      });
      row.appendChild(btn);
    }
    box.appendChild(row);
    this.overlay.appendChild(box);
  }

  // --- Save Dialog ---
  _showSaveDialog() {
    this._showOverlay();
    this.overlay.innerHTML = '';
    this._currentDialog = 'save';

    const box = document.createElement('div');
    box.className = 'dialog save-dialog';

    const title = document.createElement('div');
    title.className = 'dialog-title';
    title.textContent = 'Save Position';
    box.appendChild(title);

    const warning = document.createElement('div');
    warning.className = 'dialog-label dim';
    warning.textContent = 'Positions are saved locally on your machine. Clearing your browser\'s site data will delete all saved positions.';
    box.appendChild(warning);

    const label = document.createElement('div');
    label.className = 'dialog-label';
    label.textContent = 'Name:';
    box.appendChild(label);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'dialog-input';
    input.value = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 15);
    input.maxLength = 40;
    box.appendChild(input);

    const btnRow = document.createElement('div');
    btnRow.className = 'dialog-btn-row';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'panel-btn btn-active';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', async () => {
      try {
        const name = input.value.trim() || input.value;
        await savePosition(name, this.state.chess.fen());
        this.state.status = `Saved: ${name}`;
        this.state.emit('boardChanged');
        this._close();
      } catch (err) {
        this.state.status = `Save failed: ${err.message}`;
        this.state.emit('boardChanged');
        this._close();
      }
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'panel-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this._close());

    btnRow.append(saveBtn, cancelBtn);
    box.appendChild(btnRow);
    this.overlay.appendChild(box);

    input.focus();
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveBtn.click();
      if (e.key === 'Escape') this._close();
    });
  }

  // --- Load Dialog ---
  async _showLoadDialog() {
    this._showOverlay();
    this.overlay.innerHTML = '';
    this._currentDialog = 'load';

    const box = document.createElement('div');
    box.className = 'dialog load-dialog';

    const header = document.createElement('div');
    header.className = 'dialog-header';
    const title = document.createElement('div');
    title.className = 'dialog-title';
    title.textContent = 'Load Position';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'dialog-close';
    closeBtn.textContent = 'X';
    closeBtn.addEventListener('click', () => this._close());
    header.append(title, closeBtn);
    box.appendChild(header);

    const list = document.createElement('div');
    list.className = 'load-list';

    try {
      const positions = await listPositions();
      if (!positions.length) {
        list.innerHTML = '<div class="dialog-label">No saved positions.</div>';
      } else {
        for (const pos of positions) {
          const item = document.createElement('div');
          item.className = 'load-item';

          const info = document.createElement('div');
          info.className = 'load-item-info';
          info.innerHTML = `<strong>${pos.name}</strong><br>
            <span class="dim">${(pos.savedAt || '').substring(0, 16).replace('T', ' ')}</span><br>
            <span class="dim">${(pos.fen || '').substring(0, 42)}...</span>`;
          info.addEventListener('click', () => {
            this.state.chess.load(pos.fen);
            this.state.resetTree(pos.fen);
            this.state.status = `Loaded: ${pos.name}`;
            this.state.emit('boardChanged');
            this._close();
          });

          const delBtn = document.createElement('button');
          delBtn.className = 'load-delete';
          delBtn.textContent = 'Del';
          delBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await deletePosition(pos.id);
            this._showLoadDialog(); // Refresh
          });

          item.append(info, delBtn);
          list.appendChild(item);
        }
      }
    } catch (err) {
      list.innerHTML = `<div class="dialog-label">Error: ${err.message}</div>`;
    }

    box.appendChild(list);
    this.overlay.appendChild(box);
  }

  // --- Save Game Dialog ---
  _showSaveGameDialog() {
    this._showOverlay();
    this.overlay.innerHTML = '';
    this._currentDialog = 'save';

    const box = document.createElement('div');
    box.className = 'dialog save-dialog';

    const title = document.createElement('div');
    title.className = 'dialog-title';
    title.textContent = 'Save Game';
    box.appendChild(title);

    const warning = document.createElement('div');
    warning.className = 'dialog-label dim';
    warning.textContent = 'Games are saved locally on your machine. Clearing your browser\'s site data will delete all saved games.';
    box.appendChild(warning);

    const label = document.createElement('div');
    label.className = 'dialog-label';
    label.textContent = 'Name:';
    box.appendChild(label);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'dialog-input';
    input.value = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 15);
    input.maxLength = 40;
    box.appendChild(input);

    const btnRow = document.createElement('div');
    btnRow.className = 'dialog-btn-row';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'panel-btn btn-active';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', async () => {
      try {
        const name = input.value.trim() || input.value;
        const treeData = serializeTree(this.state.treeRoot);
        await saveGame(name, treeData);
        this.state.status = `Game saved: ${name}`;
        this.state.emit('boardChanged');
        this._close();
      } catch (err) {
        this.state.status = `Save failed: ${err.message}`;
        this.state.emit('boardChanged');
        this._close();
      }
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'panel-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this._close());

    btnRow.append(saveBtn, cancelBtn);
    box.appendChild(btnRow);
    this.overlay.appendChild(box);

    input.focus();
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveBtn.click();
      if (e.key === 'Escape') this._close();
    });
  }

  // --- Load Game Dialog ---
  async _showLoadGameDialog() {
    this._showOverlay();
    this.overlay.innerHTML = '';
    this._currentDialog = 'load';

    const box = document.createElement('div');
    box.className = 'dialog load-dialog';

    const header = document.createElement('div');
    header.className = 'dialog-header';
    const title = document.createElement('div');
    title.className = 'dialog-title';
    title.textContent = 'Load Game';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'dialog-close';
    closeBtn.textContent = 'X';
    closeBtn.addEventListener('click', () => this._close());
    header.append(title, closeBtn);
    box.appendChild(header);

    const list = document.createElement('div');
    list.className = 'load-list';

    try {
      const games = await listGames();
      if (!games.length) {
        list.innerHTML = '<div class="dialog-label">No saved games.</div>';
      } else {
        for (const game of games) {
          const item = document.createElement('div');
          item.className = 'load-item';

          const info = document.createElement('div');
          info.className = 'load-item-info';
          info.innerHTML = `<strong>${game.name}</strong><br>
            <span class="dim">${(game.savedAt || '').substring(0, 16).replace('T', ' ')}</span>`;
          info.addEventListener('click', () => {
            const root = deserializeTree(game.tree);
            // Walk to the end of the main line
            let last = root;
            while (last.children.length) last = last.children[0];
            this.state.treeRoot = root;
            this.state.currentNode = last;
            this.state.chess.load(last.fen);
            this.state.invalidateTreeLayout();
            this.state.treeScrollX = 0;
            this.state.treeScrollY = 0;
            this.state.treeZoom = 1;
            this.state.lastMove = last.move ? { from: last.move.from, to: last.move.to } : null;
            this.state.selectedSq = null;
            this.state.legalDests = new Set();
            this.state.gameOver = false;
            this.state.status = `Game loaded: ${game.name}`;
            this.state.emit('boardChanged');
            this.state.emit('treeChanged');
            this._close();
          });

          const delBtn = document.createElement('button');
          delBtn.className = 'load-delete';
          delBtn.textContent = 'Del';
          delBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await deleteGame(game.id);
            this._showLoadGameDialog();
          });

          item.append(info, delBtn);
          list.appendChild(item);
        }
      }
    } catch (err) {
      list.innerHTML = `<div class="dialog-label">Error: ${err.message}</div>`;
    }

    box.appendChild(list);
    this.overlay.appendChild(box);
  }

  // --- Combined Games Dialog (Save + Load) ---
  async _showGamesDialog() {
    this._showOverlay();
    this.overlay.innerHTML = '';
    this._currentDialog = 'games';

    const box = document.createElement('div');
    box.className = 'dialog load-dialog';

    const header = document.createElement('div');
    header.className = 'dialog-header';
    const title = document.createElement('div');
    title.className = 'dialog-title';
    title.textContent = 'Games';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'dialog-close';
    closeBtn.textContent = 'X';
    closeBtn.addEventListener('click', () => this._close());
    header.append(title, closeBtn);
    box.appendChild(header);

    // Save section
    const saveRow = document.createElement('div');
    saveRow.className = 'dialog-btn-row';
    saveRow.style.marginBottom = '10px';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'dialog-input';
    input.placeholder = 'Game name';
    input.value = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 15);
    input.maxLength = 40;
    input.style.flex = '1';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'panel-btn btn-active';
    saveBtn.textContent = 'Save';
    saveBtn.style.marginLeft = '6px';
    saveBtn.addEventListener('click', async () => {
      try {
        const name = input.value.trim() || input.value;
        const treeData = serializeTree(this.state.treeRoot);
        await saveGame(name, treeData);
        this.state.status = `Game saved: ${name}`;
        this.state.emit('boardChanged');
        this._showGamesDialog(); // Refresh list
      } catch (err) {
        this.state.status = `Save failed: ${err.message}`;
        this.state.emit('boardChanged');
        this._close();
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveBtn.click();
      if (e.key === 'Escape') this._close();
    });

    saveRow.append(input, saveBtn);
    box.appendChild(saveRow);

    // Load list
    const list = document.createElement('div');
    list.className = 'load-list';

    try {
      const games = await listGames();
      if (!games.length) {
        list.innerHTML = '<div class="dialog-label dim">No saved games.</div>';
      } else {
        for (const game of games) {
          const item = document.createElement('div');
          item.className = 'load-item';

          const info = document.createElement('div');
          info.className = 'load-item-info';
          info.innerHTML = `<strong>${game.name}</strong><br>
            <span class="dim">${(game.savedAt || '').substring(0, 16).replace('T', ' ')}</span>`;
          info.addEventListener('click', () => {
            const root = deserializeTree(game.tree);
            let last = root;
            while (last.children.length) last = last.children[0];
            this.state.treeRoot = root;
            this.state.currentNode = last;
            this.state.chess.load(last.fen);
            this.state.invalidateTreeLayout();
            this.state.treeScrollX = 0;
            this.state.treeScrollY = 0;
            this.state.treeZoom = 1;
            this.state.lastMove = last.move ? { from: last.move.from, to: last.move.to } : null;
            this.state.selectedSq = null;
            this.state.legalDests = new Set();
            this.state.gameOver = false;
            this.state.status = `Game loaded: ${game.name}`;
            this.state.emit('boardChanged');
            this.state.emit('treeChanged');
            this._close();
          });

          const delBtn = document.createElement('button');
          delBtn.className = 'load-delete';
          delBtn.textContent = 'Del';
          delBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await deleteGame(game.id);
            this._showGamesDialog();
          });

          item.append(info, delBtn);
          list.appendChild(item);
        }
      }
    } catch (err) {
      list.innerHTML = `<div class="dialog-label">Error: ${err.message}</div>`;
    }

    box.appendChild(list);
    this.overlay.appendChild(box);
    input.focus();
  }

  // --- Study Chapter Picker ---
  _showStudyChapterDialog(chapters, onSelect) {
    this._showOverlay();
    this.overlay.innerHTML = '';
    this._currentDialog = 'study';

    const box = document.createElement('div');
    box.className = 'dialog load-dialog';

    const header = document.createElement('div');
    header.className = 'dialog-header';
    const title = document.createElement('div');
    title.className = 'dialog-title';
    title.textContent = `Study — ${chapters.length} chapters`;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'dialog-close';
    closeBtn.textContent = 'X';
    closeBtn.addEventListener('click', () => this._close());
    header.append(title, closeBtn);
    box.appendChild(header);

    const list = document.createElement('div');
    list.className = 'load-list';

    for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i];
      const item = document.createElement('div');
      item.className = 'load-item';
      const info = document.createElement('div');
      info.className = 'load-item-info';
      info.innerHTML = `<strong>${i + 1}. ${ch.name}</strong>`;
      info.addEventListener('click', () => {
        this._close();
        onSelect(ch);
      });
      item.appendChild(info);
      list.appendChild(item);
    }

    box.appendChild(list);
    this.overlay.appendChild(box);
  }

  // --- Play Engine Dialog ---
  _showPlayEngineDialog() {
    this._showOverlay();
    this.overlay.innerHTML = '';
    this._currentDialog = 'save';

    const box = document.createElement('div');
    box.className = 'dialog save-dialog';

    const title = document.createElement('div');
    title.className = 'dialog-title';
    title.textContent = 'Engine plays as';
    box.appendChild(title);

    const btnRow = document.createElement('div');
    btnRow.className = 'dialog-btn-row';
    btnRow.style.flexDirection = 'column';

    const pawn = (color) => {
      const span = document.createElement('span');
      span.textContent = '\u265F';
      span.style.color = color === 'w' ? '#fff' : '#333';
      span.style.textShadow = color === 'w' ? '0 0 2px #888' : 'none';
      return span;
    };

    const whiteBtn = document.createElement('button');
    whiteBtn.className = 'panel-btn btn-active';
    whiteBtn.appendChild(pawn('w'));
    whiteBtn.append(' White');
    whiteBtn.addEventListener('click', () => {
      this._close();
      this.state.emit('playEngineConfirm', 'b');
    });

    const blackBtn = document.createElement('button');
    blackBtn.className = 'panel-btn btn-active';
    blackBtn.appendChild(pawn('b'));
    blackBtn.append(' Black');
    blackBtn.addEventListener('click', () => {
      this._close();
      this.state.emit('playEngineConfirm', 'w');
    });

    const randomBtn = document.createElement('button');
    randomBtn.className = 'panel-btn btn-active';
    randomBtn.appendChild(pawn('w'));
    randomBtn.append('/');
    randomBtn.appendChild(pawn('b'));
    randomBtn.append(' Random');
    randomBtn.addEventListener('click', () => {
      this._close();
      this.state.emit('playEngineConfirm', Math.random() < 0.5 ? 'w' : 'b');
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'panel-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this._close());

    btnRow.append(whiteBtn, blackBtn, randomBtn, cancelBtn);
    box.appendChild(btnRow);
    this.overlay.appendChild(box);
  }

  // --- Mermaid Menu ---
  _showMermaidMenu() {
    this._showOverlay();
    this.overlay.innerHTML = '';
    this._currentDialog = 'save';

    const box = document.createElement('div');
    box.className = 'dialog save-dialog';

    const title = document.createElement('div');
    title.className = 'dialog-title';
    title.textContent = 'Export/Import Branchess';
    box.appendChild(title);

    const desc = document.createElement('div');
    desc.className = 'dialog-label';
    desc.textContent = 'Games are saved as Mermaid diagrams (.mmd) with full tree data.';
    desc.style.marginBottom = '12px';
    box.appendChild(desc);

    const btnRow = document.createElement('div');
    btnRow.className = 'dialog-btn-row';
    btnRow.style.flexDirection = 'column';

    const exportBtn = document.createElement('button');
    exportBtn.className = 'panel-btn btn-active';
    exportBtn.textContent = 'Export Mermaid';
    exportBtn.addEventListener('click', () => {
      this._close();
      this.state.emit('exportMermaid');
    });

    const importBtn = document.createElement('button');
    importBtn.className = 'panel-btn btn-active';
    importBtn.textContent = 'Load Mermaid';
    importBtn.addEventListener('click', () => {
      this._close();
      this.state.emit('loadMermaidFile');
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'panel-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this._close());

    btnRow.append(exportBtn, importBtn, cancelBtn);
    box.appendChild(btnRow);
    this.overlay.appendChild(box);
  }

  // --- Mermaid Export Dialog ---
  _showMermaidExportDialog() {
    this._showOverlay();
    this.overlay.innerHTML = '';
    this._currentDialog = 'save';

    const box = document.createElement('div');
    box.className = 'dialog save-dialog';

    const title = document.createElement('div');
    title.className = 'dialog-title';
    title.textContent = 'Export Mermaid';
    box.appendChild(title);

    const label = document.createElement('div');
    label.className = 'dialog-label';
    label.textContent = 'Filename:';
    box.appendChild(label);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'dialog-input';
    input.value = new Date().toISOString().slice(0, 10);
    input.maxLength = 60;
    box.appendChild(input);

    const hint = document.createElement('div');
    hint.className = 'dialog-label';
    hint.style.fontSize = '11px';
    hint.style.marginTop = '-8px';
    hint.textContent = '.mmd extension added automatically';
    box.appendChild(hint);

    const btnRow = document.createElement('div');
    btnRow.className = 'dialog-btn-row';

    const exportBtn = document.createElement('button');
    exportBtn.className = 'panel-btn btn-active';
    exportBtn.textContent = 'Export';
    exportBtn.addEventListener('click', () => {
      const name = input.value.trim() || input.value;
      this.state.emit('mermaidExportConfirm', name);
      this._close();
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'panel-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this._close());

    btnRow.append(exportBtn, cancelBtn);
    box.appendChild(btnRow);
    this.overlay.appendChild(box);

    input.focus();
    input.select();
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') exportBtn.click();
      if (e.key === 'Escape') this._close();
    });
  }

  handleKeydown(e) {
    if (this._currentDialog === 'save' || this._currentDialog === 'load') {
      if (e.key === 'Escape') this._close();
    }
  }
}
