// Click-to-move handling, promotion, player/engine move execution
import { ANIM_DURATION } from './constants.js';

export class MoveHandler {
  constructor(state, boardView, animationManager, engine) {
    this.state = state;
    this.boardView = boardView;
    this.animation = animationManager;
    this.engine = engine;

    this._bindBoardClicks();
  }

  _bindBoardClicks() {
    const container = this.boardView.container;
    this._dragPiece = null;
    this._dragFromSq = null;
    this._dragGhost = null;
    this._dragMoved = false;

    container.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const sqEl = e.target.closest('.square');
      if (!sqEl) return;
      const sq = sqEl.dataset.square;
      const piece = this.state.chess.get(sq);

      if (piece && !this.state.setupMode && !this.state.gameOver && !this.state.promotingFrom) {
        // Start drag
        this._dragFromSq = sq;
        this._dragMoved = false;

        // Select the piece (for highlights)
        if (!this.state.engineThinking) {
          this.state.selectedSq = sq;
          this.state.legalDests = new Set();
          this.state.emit('boardChanged');
        }

        // Create ghost element
        const pieceEl = sqEl.querySelector('.piece');
        if (pieceEl) {
          const rect = sqEl.getBoundingClientRect();
          const ghost = document.createElement('span');
          ghost.className = pieceEl.className + ' drag-ghost';
          ghost.textContent = pieceEl.textContent;
          ghost.style.position = 'fixed';
          ghost.style.fontSize = getComputedStyle(pieceEl).fontSize;
          ghost.style.lineHeight = '1';
          ghost.style.pointerEvents = 'none';
          ghost.style.zIndex = '900';
          ghost.style.width = rect.width + 'px';
          ghost.style.height = rect.height + 'px';
          ghost.style.display = 'flex';
          ghost.style.alignItems = 'center';
          ghost.style.justifyContent = 'center';
          ghost.style.left = (e.clientX - rect.width / 2) + 'px';
          ghost.style.top = (e.clientY - rect.height / 2) + 'px';
          ghost.style.opacity = '0.85';
          document.body.appendChild(ghost);
          this._dragGhost = ghost;

          // Hide the original piece
          pieceEl.style.opacity = '0.3';
          this._dragOrigPiece = pieceEl;
        }
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!this._dragGhost) return;
      this._dragMoved = true;
      const w = parseFloat(this._dragGhost.style.width);
      const h = parseFloat(this._dragGhost.style.height);
      this._dragGhost.style.left = (e.clientX - w / 2) + 'px';
      this._dragGhost.style.top = (e.clientY - h / 2) + 'px';
    });

    window.addEventListener('mouseup', (e) => {
      if (this._dragGhost) {
        this._dragGhost.remove();
        this._dragGhost = null;
        if (this._dragOrigPiece) {
          this._dragOrigPiece.style.opacity = '';
          this._dragOrigPiece = null;
        }

        if (this._dragMoved && this._dragFromSq) {
          // Find the square under the cursor
          const el = document.elementFromPoint(e.clientX, e.clientY);
          const sqEl = el ? el.closest('.square') : null;
          if (sqEl) {
            const toSq = sqEl.dataset.square;
            if (toSq && toSq !== this._dragFromSq) {
              this.state.selectedSq = this._dragFromSq;
              this._tryMove(this._dragFromSq, toSq);
              this._dragFromSq = null;
              return;
            }
          }
          // Drag cancelled — deselect
          this.state.selectedSq = null;
          this.state.legalDests = new Set();
          this.state.emit('boardChanged');
        }
        this._dragFromSq = null;
        return;
      }

      // Fall through to click handling if no drag happened
    });

    // Click handler (for click-to-move, fires after mouseup if no drag)
    container.addEventListener('click', (e) => {
      if (this._dragMoved) { this._dragMoved = false; return; }
      const sqEl = e.target.closest('.square');
      if (!sqEl) return;
      const sq = sqEl.dataset.square;
      this._handleBoardClick(sq);
    });

    container.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!this.state.setupMode) return;
      const sqEl = e.target.closest('.square');
      if (!sqEl) return;
      this._handleSetupRightClick(sqEl.dataset.square);
    });
  }

  _handleBoardClick(sq) {
    const state = this.state;
    if (state.promotingFrom !== null) return;

    // Allow interrupting the engine by selecting a piece
    if (state.engineThinking) {
      const chess = state.chess;
      const piece = chess.get(sq);
      if (piece) {
        this._cancelEngine();
        state.selectedSq = sq;
        state.legalDests = new Set();
        state.emit('boardChanged');
      }
      return;
    }

    if (state.setupMode) {
      this._handleSetupClick(sq);
      return;
    }
    if (state.gameOver) return;

    // If a piece is selected, try to move it to the clicked square
    if (state.selectedSq !== null && state.selectedSq !== sq) {
      this._tryMove(state.selectedSq, sq);
      return;
    }

    // Select a piece (either color)
    const chess = state.chess;
    const piece = chess.get(sq);
    if (piece) {
      state.selectedSq = sq;
      state.legalDests = new Set();
      // Show all squares as potential destinations (no legal move filtering)
    } else {
      state.selectedSq = null;
      state.legalDests = new Set();
    }
    state.emit('boardChanged');
  }

  _tryMove(from, to) {
    const chess = this.state.chess;
    const piece = chess.get(from);
    if (!piece) return;

    // Check promotion — pawn reaching back rank
    if (piece.type === 'p') {
      const rank = parseInt(to[1]);
      if ((piece.color === 'w' && rank === 8) || (piece.color === 'b' && rank === 1)) {
        this.state.promotingFrom = from;
        this.state.promotingTo = to;
        this.state.emit('promotionNeeded');
        return;
      }
    }

    this._executeMove({ from, to });
  }

  handlePromotion(pieceType) {
    const from = this.state.promotingFrom;
    const to = this.state.promotingTo;
    this.state.promotingFrom = null;
    this.state.promotingTo = null;
    this.state.emit('promotionDone');
    this._executeMove({ from, to, promotion: pieceType });
  }

  _executeMove(move) {
    const state = this.state;
    const chess = state.chess;
    const movedColor = chess.turn();

    // Check if move exists in tree already
    const existing = state.currentNode.findChild(move);
    if (existing) {
      // Animate then navigate
      this.animation.animate(move, () => {
        state.navigateTo(existing);
        this._afterPlayerMove(movedColor);
      });
      return;
    }

    // Try legal move first via chess.js
    let san;
    let result;
    try {
      result = chess.move(move);
      san = result.san;
    } catch {
      // Illegal move — apply it manually (move piece, swap turn)
      const piece = chess.get(move.from);
      if (!piece) return;

      const fromFile = move.from.charCodeAt(0) - 97;
      const fromRank = parseInt(move.from[1]);
      const toFile = move.to.charCodeAt(0) - 97;
      const toRank = parseInt(move.to[1]);

      // En passant capture: pawn moves diagonally to empty square
      const isEpCapture = piece.type === 'p'
        && fromFile !== toFile
        && !chess.get(move.to);
      if (isEpCapture) {
        // Remove the captured pawn on the same rank as the moving pawn
        const capturedSq = move.to[0] + fromRank;
        chess.remove(capturedSq);
      }

      chess.remove(move.from);
      chess.remove(move.to);
      const placed = move.promotion
        ? { type: move.promotion, color: piece.color }
        : piece;
      chess.put(placed, move.to);

      // Swap turn by loading the modified FEN with flipped side
      const fen = chess.fen();
      const parts = fen.split(' ');
      parts[1] = parts[1] === 'w' ? 'b' : 'w';

      // Set en passant square if pawn moved two ranks
      if (piece.type === 'p' && Math.abs(toRank - fromRank) === 2 && fromFile === toFile) {
        const epRank = piece.color === 'w' ? fromRank + 1 : fromRank - 1;
        parts[3] = move.from[0] + epRank;
      } else {
        parts[3] = '-';
      }

      chess.load(parts.join(' '));
      san = `${piece.type.toUpperCase()}${move.from}-${move.to}`;
      if (piece.type === 'p') san = `${move.from}-${move.to}`;
    }

    const child = state.currentNode.addChild(
      { from: move.from, to: move.to, promotion: move.promotion },
      chess.fen(),
      san
    );
    state.currentNode = child;
    state.lastMove = { from: move.from, to: move.to };
    state.invalidateTreeLayout();

    // Animate
    state.selectedSq = null;
    state.legalDests = new Set();

    this.animation.animate(move, () => {
      state.emit('boardChanged');
      this._afterPlayerMove(movedColor);
    });
  }

  _afterPlayerMove(movedColor) {
    const state = this.state;
    if (state.checkGameOver()) {
      state.emit('boardChanged');
      return;
    }

    // Auto engine response after the player moves
    if (movedColor === state.playerColor) {
      if (state.currentNode.children.length) {
        const target = state.currentNode.children[0];
        const move = target.move;
        this.animation.animate(move, () => {
          state.navigateTo(target);
          if (!state.gameOver) state.status = 'Your turn';
          state.emit('boardChanged');
        });
      } else {
        this._requestEngineMove();
      }
    } else {
      state.status = 'Your turn';
      state.emit('boardChanged');
    }
  }

  _cancelEngine() {
    this.state.engineThinking = false;
    this._engineCancelled = true;
    this.animation.cancel();
    this.state.status = 'Your move';
    this.state.emit('boardChanged');
  }

  _requestEngineMove() {
    const state = this.state;
    state.status = 'Engine thinking...';
    state.engineThinking = true;
    this._engineCancelled = false;
    state.emit('boardChanged');

    this.engine.getMove(state.chess.fen(), state.strengthParams()).then(move => {
      if (this._engineCancelled) return;
      if (!move) {
        state.status = 'Engine error';
        state.engineThinking = false;
        state.emit('boardChanged');
        return;
      }

      const chess = state.chess;
      let result;
      try {
        result = chess.move(move);
      } catch {
        state.status = 'Engine error: invalid move';
        state.engineThinking = false;
        state.emit('boardChanged');
        return;
      }
      const san = result.san;

      const child = state.currentNode.addChild(
        { from: move.from, to: move.to, promotion: move.promotion },
        chess.fen(),
        san
      );
      state.currentNode = child;
      state.lastMove = { from: move.from, to: move.to };
      state.invalidateTreeLayout();

      this.animation.animate(move, () => {
        state.engineThinking = false;
        state.checkGameOver();
        if (!state.gameOver) {
          const turn = state.chess.turn() === 'w' ? 'White' : 'Black';
          state.status = `${turn} to move`;
        }
        state.emit('boardChanged');

        // If this was a forced engine move, chain the opponent's response
        if (this._chainOpponentResponse && !state.gameOver) {
          this._chainOpponentResponse = false;
          this._afterPlayerMove(movedColor);
        }
      });
    }).catch(err => {
      state.status = `Engine error: ${err.message}`;
      state.engineThinking = false;
      state.emit('boardChanged');
    });
  }

  requestEngineCalculation() {
    if (this.state.gameOver) return;
    const moves = this.state.chess.moves();
    if (!moves.length) return;
    // Force — cancel any in-flight animation and request immediately
    this.animation.cancel();
    this.state.engineThinking = false;
    this._chainOpponentResponse = true;
    this._requestEngineMove();
  }

  _handleSetupClick(sq) {
    const state = this.state;
    if (state.setupPiece === null) {
      // Eraser — remove piece
      state.chess.remove(sq);
    } else {
      state.chess.put(state.setupPiece, sq);
    }
    state.emit('boardChanged');
  }

  _handleSetupRightClick(sq) {
    this.state.chess.remove(sq);
    this.state.emit('boardChanged');
  }
}
