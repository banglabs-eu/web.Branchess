// Board rendering — CSS grid of 64 divs with Unicode pieces
import { COLOR_LIGHT_SQ, COLOR_DARK_SQ, COLOR_SELECTED, COLOR_LEGAL, COLOR_LEGAL_CAPTURE,
         COLOR_LAST_MOVE, COLOR_CHECK, UNICODE_PIECES, FILES, RANKS } from './constants.js';

export class BoardView {
  constructor(container, state) {
    this.state = state;
    this.container = container;
    this.squares = [];
    this._build();

    state.on('boardChanged', () => this.render());
    state.on('boardFlipped', () => { this._build(); this.render(); });
  }

  _build() {
    this.container.innerHTML = '';
    this.container.classList.add('chess-board');
    this.squares = [];

    const flipped = this.state.playerColor === 'b';
    const versus = this.state.versusMode;

    const topLabels = document.getElementById('file-labels-top');
    const bottomLabels = document.getElementById('file-labels-bottom');
    topLabels.innerHTML = '';
    bottomLabels.innerHTML = '';

    if (versus) {
      // 90° rotation: rows = ranks (1-8 left to right), cols = files (a-h top to bottom)
      // White on left (rank 1-2), Black on right (rank 7-8)
      // Grid row = file index (a=top, h=bottom), Grid col = rank (1=left, 8=right)
      // Top/bottom labels show ranks 1-8
      for (let col = 0; col < 8; col++) {
        const tl = document.createElement('span');
        tl.textContent = String(col + 1);
        topLabels.appendChild(tl);
        const bl = document.createElement('span');
        bl.textContent = String(col + 1);
        bottomLabels.appendChild(bl);
      }

      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const sq = document.createElement('div');
          sq.className = 'square';
          // file = row (a=0 at top), rank = col+1 (1 at left)
          const file = FILES[row];
          const rank = String(col + 1);
          const isLight = (row + col) % 2 === 0;
          sq.style.background = isLight ? COLOR_LIGHT_SQ : COLOR_DARK_SQ;
          sq.dataset.square = file + rank;
          sq.dataset.row = row;
          sq.dataset.col = col;

          // File labels (left column)
          if (col === 0) {
            const label = document.createElement('span');
            label.className = 'label label-rank';
            label.textContent = file.toUpperCase();
            label.style.color = isLight ? COLOR_DARK_SQ : COLOR_LIGHT_SQ;
            sq.appendChild(label);
          }

          this.squares.push(sq);
          this.container.appendChild(sq);
        }
      }
    } else {
      // Normal or flipped
      const files = flipped ? [...FILES].reverse().join('') : FILES;
      const ranks = flipped ? [...RANKS].reverse().join('') : RANKS;

      for (let col = 0; col < 8; col++) {
        const tl = document.createElement('span');
        tl.textContent = files[col].toUpperCase();
        topLabels.appendChild(tl);
        const bl = document.createElement('span');
        bl.textContent = files[col].toUpperCase();
        bottomLabels.appendChild(bl);
      }

      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const sq = document.createElement('div');
          sq.className = 'square';
          const isLight = (row + col) % 2 === 0;
          sq.style.background = isLight ? COLOR_LIGHT_SQ : COLOR_DARK_SQ;
          sq.dataset.square = files[col] + ranks[row];
          sq.dataset.row = row;
          sq.dataset.col = col;

          // Rank labels (left column)
          if (col === 0) {
            const label = document.createElement('span');
            label.className = 'label label-rank';
            label.textContent = ranks[row];
            label.style.color = isLight ? COLOR_DARK_SQ : COLOR_LIGHT_SQ;
            sq.appendChild(label);
          }

          this.squares.push(sq);
          this.container.appendChild(sq);
        }
      }
    }
  }

  _sqIndex(algebraic) {
    const flipped = this.state.playerColor === 'b';
    const versus = this.state.versusMode;
    const col = algebraic.charCodeAt(0) - 97; // a=0, file
    const row = 8 - parseInt(algebraic[1]);    // 8=0, 1=7, rank inverted

    if (versus) {
      // Grid row = file (a=0 at top), Grid col = rank-1 (1=0 at left)
      const gridRow = col;            // file a=0 at top
      const gridCol = parseInt(algebraic[1]) - 1; // rank 1=0 at left
      return gridRow * 8 + gridCol;
    }
    if (flipped) return (7 - row) * 8 + (7 - col);
    return row * 8 + col;
  }

  render() {
    const chess = this.state.chess;
    const board = chess.board(); // 8x8 array of {type, color} or null

    // Clear all overlays and pieces
    for (const sq of this.squares) {
      // Remove piece spans and overlays
      const piece = sq.querySelector('.piece');
      if (piece) piece.remove();
      sq.classList.remove('highlight-selected', 'highlight-legal', 'highlight-last', 'highlight-check', 'highlight-legal-capture');
    }

    // Place pieces
    const flipped = this.state.playerColor === 'b';
    const versus = this.state.versusMode;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const p = board[row][col];
        if (!p) continue;
        let idx;
        if (versus) {
          // board[row][col]: row=0 is rank 8, col=0 is file a
          // grid: gridRow=file(col), gridCol=rank(7-row) → rank 8=left? No, rank 1=left
          // board row 0 = rank 8, board row 7 = rank 1
          // grid col = rank-1 = 7-row (so rank 8 → col 7, rank 1 → col 0... wait)
          // We want rank 1 on left (gridCol 0) and rank 8 on right (gridCol 7)
          // board row 0 = rank 8 → gridCol 7, board row 7 = rank 1 → gridCol 0
          const gridRow = col;        // file a=0 at top
          const gridCol = 7 - row;    // rank 1=left(0), rank 8=right(7)
          idx = gridRow * 8 + gridCol;
        } else if (flipped) {
          idx = (7 - row) * 8 + (7 - col);
        } else {
          idx = row * 8 + col;
        }
        const sq = this.squares[idx];
        const span = document.createElement('span');
        span.className = 'piece';
        // Always use filled (black) glyphs — color via CSS
        const key = p.type;
        span.textContent = UNICODE_PIECES[key];
        span.classList.add(p.color === 'w' ? 'piece-white' : 'piece-black');
        sq.appendChild(span);
      }
    }

    // Highlights
    const { lastMove, selectedSq, legalDests } = this.state;

    if (lastMove) {
      const fromIdx = this._sqIndex(lastMove.from);
      const toIdx = this._sqIndex(lastMove.to);
      this.squares[fromIdx].classList.add('highlight-last');
      this.squares[toIdx].classList.add('highlight-last');
    }

    if (chess.isCheck()) {
      // Find the king
      const turn = chess.turn();
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const p = board[row][col];
          if (p && p.type === 'k' && p.color === turn) {
            let ki;
            if (versus) { ki = col * 8 + (7 - row); }
            else if (flipped) { ki = (7 - row) * 8 + (7 - col); }
            else { ki = row * 8 + col; }
            this.squares[ki].classList.add('highlight-check');
          }
        }
      }
    }

    if (selectedSq !== null) {
      const idx = this._sqIndex(selectedSq);
      this.squares[idx].classList.add('highlight-selected');
    }

    for (const dest of legalDests) {
      const idx = this._sqIndex(dest);
      const p = board[Math.floor(idx / 8)][idx % 8];
      if (p) {
        this.squares[idx].classList.add('highlight-legal-capture');
      } else {
        this.squares[idx].classList.add('highlight-legal');
      }
    }
  }

  getSquareElement(algebraic) {
    return this.squares[this._sqIndex(algebraic)];
  }

  getSquareRect(algebraic) {
    return this.getSquareElement(algebraic).getBoundingClientRect();
  }
}
