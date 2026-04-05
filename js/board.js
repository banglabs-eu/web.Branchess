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
    const rankLabels = document.getElementById('rank-labels');
    topLabels.innerHTML = '';
    bottomLabels.innerHTML = '';
    rankLabels.innerHTML = '';

    if (versus) {
      // 90° rotation: grid row = file, grid col = rank
      // flipped: black on left (rank 8→1), normal: white on left (rank 1→8)
      const vRanks = flipped ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
      const vFiles = flipped ? [...FILES].reverse() : [...FILES];

      for (let col = 0; col < 8; col++) {
        const tl = document.createElement('span');
        tl.textContent = String(vRanks[col]);
        topLabels.appendChild(tl);
        const bl = document.createElement('span');
        bl.textContent = String(vRanks[col]);
        bottomLabels.appendChild(bl);
      }
      for (let row = 0; row < 8; row++) {
        const rl = document.createElement('span');
        rl.textContent = vFiles[row].toUpperCase();
        rankLabels.appendChild(rl);
      }

      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const sq = document.createElement('div');
          sq.className = 'square';
          const file = vFiles[row];
          const rank = String(vRanks[col]);
          const isLight = (row + col) % 2 === 0;
          sq.classList.add(isLight ? 'sq-light' : 'sq-dark');
          sq.dataset.square = file + rank;
          sq.dataset.row = row;
          sq.dataset.col = col;

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
        const rl = document.createElement('span');
        rl.textContent = ranks[row];
        rankLabels.appendChild(rl);
      }

      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const sq = document.createElement('div');
          sq.className = 'square';
          const isLight = (row + col) % 2 === 0;
          sq.classList.add(isLight ? 'sq-light' : 'sq-dark');
          sq.dataset.square = files[col] + ranks[row];
          sq.dataset.row = row;
          sq.dataset.col = col;

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
      const gridRow = flipped ? (7 - col) : col;
      const gridCol = flipped ? (8 - parseInt(algebraic[1])) : (parseInt(algebraic[1]) - 1);
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
      sq.classList.remove('highlight-selected', 'highlight-legal', 'highlight-last', 'highlight-check', 'highlight-legal-capture', 'highlight-best');
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
          // board[row][col]: row=0=rank8, col=0=fileA
          const gridRow = flipped ? (7 - col) : col;
          const gridCol = flipped ? row : (7 - row);
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
            if (versus) {
              const gr = flipped ? (7 - col) : col;
              const gc = flipped ? row : (7 - row);
              ki = gr * 8 + gc;
            }
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

    // Best move hint
    if (this.state.bestMoveHint) {
      const fromIdx = this._sqIndex(this.state.bestMoveHint.from);
      const toIdx = this._sqIndex(this.state.bestMoveHint.to);
      this.squares[fromIdx].classList.add('highlight-best');
      this.squares[toIdx].classList.add('highlight-best');
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
