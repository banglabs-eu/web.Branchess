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
    state.on('promotionNeeded', () => this._showPromotionDialog());
    state.on('promotionDone', () => this._close());
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
      const name = input.value.trim() || input.value;
      await savePosition(name, this.state.chess.fen());
      this.state.status = `Saved: ${name}`;
      this.state.emit('boardChanged');
      this._close();
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
      const name = input.value.trim() || input.value;
      const treeData = serializeTree(this.state.treeRoot);
      await saveGame(name, treeData);
      this.state.status = `Game saved: ${name}`;
      this.state.emit('boardChanged');
      this._close();
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
            this.state.treeRoot = root;
            this.state.currentNode = root;
            this.state.chess.load(root.fen);
            this.state.invalidateTreeLayout();
            this.state.treeScrollX = 0;
            this.state.treeScrollY = 0;
            this.state.treeZoom = 1;
            this.state.lastMove = null;
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

  handleKeydown(e) {
    if (this._currentDialog === 'save' || this._currentDialog === 'load') {
      if (e.key === 'Escape') this._close();
    }
  }
}
