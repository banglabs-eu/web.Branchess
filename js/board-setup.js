// Board setup panel — shown when same-color double move triggers setup mode
import { UNICODE_PIECES, COLOR_TEXT_DIM } from './constants.js';
import { forceLoadFen } from './board-utils.js';
import { t, onLangChange } from './i18n.js';

export class BoardSetupPanel {
  constructor(container, panelEl, state) {
    this.container = container;
    this.panelEl = panelEl;
    this.state = state;

    state.on('boardChanged', () => {
      if (state.boardSetupMode) this._updateSelection();
    });
    state.on('boardSetupModeChanged', () => this._toggle());
    onLangChange(() => { if (state.boardSetupMode) this._build(); });
  }

  _toggle() {
    if (this.state.boardSetupMode) {
      this._build();
      this.container.style.display = 'flex';
      this.panelEl.style.display = 'none';
    } else {
      this.container.style.display = 'none';
      this.panelEl.style.display = 'flex';
    }
  }

  _build() {
    this.container.innerHTML = '';
    this.container.classList.add('panel');

    // Title
    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = t('boardSetup');
    title.style.color = '#b4dc8c';
    this.container.appendChild(title);

    // Instructions
    const desc = document.createElement('div');
    desc.style.padding = '4px 8px 8px';
    desc.style.fontSize = '13px';
    desc.style.color = COLOR_TEXT_DIM;
    desc.style.lineHeight = '1.5';
    desc.innerHTML = t('setupDesc');
    this.container.appendChild(desc);

    // White pieces label
    const whiteLabel = document.createElement('div');
    whiteLabel.className = 'btn-section-title';
    whiteLabel.textContent = t('white');
    whiteLabel.style.padding = '4px 8px 2px';
    this.container.appendChild(whiteLabel);

    // White pieces grid
    const whiteGrid = document.createElement('div');
    whiteGrid.className = 'board-setup-grid';
    const whitePieces = [
      { type: 'k', color: 'w' }, { type: 'q', color: 'w' }, { type: 'r', color: 'w' },
      { type: 'b', color: 'w' }, { type: 'n', color: 'w' }, { type: 'p', color: 'w' },
    ];
    for (const p of whitePieces) {
      whiteGrid.appendChild(this._makeCell(p));
    }
    this.container.appendChild(whiteGrid);

    // Black pieces label
    const blackLabel = document.createElement('div');
    blackLabel.className = 'btn-section-title';
    blackLabel.textContent = t('black');
    blackLabel.style.padding = '4px 8px 2px';
    this.container.appendChild(blackLabel);

    // Black pieces grid
    const blackGrid = document.createElement('div');
    blackGrid.className = 'board-setup-grid';
    const blackPieces = [
      { type: 'k', color: 'b' }, { type: 'q', color: 'b' }, { type: 'r', color: 'b' },
      { type: 'b', color: 'b' }, { type: 'n', color: 'b' }, { type: 'p', color: 'b' },
    ];
    for (const p of blackPieces) {
      blackGrid.appendChild(this._makeCell(p));
    }
    this.container.appendChild(blackGrid);

    this._pieceContainer = this.container;

    // Turn toggle
    this.turnBtn = document.createElement('button');
    this.turnBtn.className = 'panel-btn btn-full';
    this.turnBtn.style.margin = '8px 8px 4px';
    this.turnBtn.style.width = 'calc(100% - 16px)';
    this._updateTurnBtn();
    this.turnBtn.addEventListener('click', () => {
      this.state.setupTurn = this.state.setupTurn === 'w' ? 'b' : 'w';
      this._updateTurnBtn();
    });
    this.container.appendChild(this.turnBtn);

    // Setup Complete button
    const doneBtn = document.createElement('button');
    doneBtn.className = 'panel-btn btn-full btn-active';
    doneBtn.textContent = t('setupComplete');
    doneBtn.style.margin = '4px 8px';
    doneBtn.style.width = 'calc(100% - 16px)';
    doneBtn.addEventListener('click', () => this._exitSetup());
    this.container.appendChild(doneBtn);
  }

  _makeCell(p) {
    const cell = document.createElement('div');
    cell.className = 'board-setup-cell';
    const key = p.color === 'w' ? p.type.toUpperCase() : p.type;
    cell.textContent = UNICODE_PIECES[key];
    cell.classList.add(p.color === 'w' ? 'piece-white' : 'piece-black');
    cell.dataset.pieceType = p.type;
    cell.dataset.pieceColor = p.color;

    const state = this.state;
    if (state.boardSetupSelectedPiece &&
        state.boardSetupSelectedPiece.type === p.type &&
        state.boardSetupSelectedPiece.color === p.color) {
      cell.classList.add('palette-selected');
    }

    cell.addEventListener('click', () => {
      // Toggle selection
      if (state.boardSetupSelectedPiece &&
          state.boardSetupSelectedPiece.type === p.type &&
          state.boardSetupSelectedPiece.color === p.color) {
        state.boardSetupSelectedPiece = null;
      } else {
        state.boardSetupSelectedPiece = { type: p.type, color: p.color };
      }
      this._updateSelection();
    });

    return cell;
  }

  _updateSelection() {
    const cells = this.container.querySelectorAll('.board-setup-cell');
    const sel = this.state.boardSetupSelectedPiece;
    for (const cell of cells) {
      const match = sel &&
        cell.dataset.pieceType === sel.type &&
        cell.dataset.pieceColor === sel.color;
      cell.classList.toggle('palette-selected', !!match);
    }
  }

  _updateTurnBtn() {
    const side = this.state.setupTurn === 'w' ? t('white') : t('black');
    this.turnBtn.textContent = t('turnAfterSetup', { side });
  }

  _exitSetup() {
    const state = this.state;
    const chess = state.chess;

    const fen = chess.fen();
    const parts = fen.split(' ');
    parts[1] = state.setupTurn;
    parts[2] = this._inferCastling(parts[0]);
    parts[3] = '-';
    parts[4] = '0';
    parts[5] = '1';
    const newFen = parts.join(' ');

    forceLoadFen(chess, newFen);

    state.boardSetupMode = false;
    state.lastMovedPieceColor = null;
    state.boardSetupSelectedPiece = null;
    state.resetTree(newFen);
    state.emit('boardSetupModeChanged');
  }

  _inferCastling(position) {
    const rows = position.split('/');
    let rights = '';
    const pieceAt = (rank, file) => {
      let col = 0;
      for (const ch of rank) {
        if (col === file) return ch;
        if (ch >= '1' && ch <= '8') col += parseInt(ch);
        else col++;
        if (col > file) return null;
      }
      return null;
    };
    const rank1 = rows[7];
    const rank8 = rows[0];
    if (pieceAt(rank1, 4) === 'K') {
      if (pieceAt(rank1, 7) === 'R') rights += 'K';
      if (pieceAt(rank1, 0) === 'R') rights += 'Q';
    }
    if (pieceAt(rank8, 4) === 'k') {
      if (pieceAt(rank8, 7) === 'r') rights += 'k';
      if (pieceAt(rank8, 0) === 'r') rights += 'q';
    }
    return rights || '-';
  }
}
