// Entry point — wires everything together
import { Chess } from '../lib/chess.js';
import { GameState } from './state.js';
import { BoardView } from './board.js';
import { MoveHandler } from './moves.js';
import { AnimationManager } from './animation.js';
import { StochasticEngine } from './engine.js';
import { TreeView } from './tree-view.js';
import { UIPanel } from './ui-panel.js';
import { SetupPanel } from './setup.js';
import { DialogManager } from './persistence.js';
import { bang, fireworksShow } from './bang.js';

// Initialize — load FEN from URL if present
const chess = new Chess();
const urlParams = new URLSearchParams(window.location.search);
const urlFen = urlParams.get('fen');
if (urlFen) {
  try { chess.load(urlFen); } catch { /* ignore invalid */ }
}
const state = new GameState(chess);
if (urlFen) state.resetTree(chess.fen());

// Board
const boardContainer = document.getElementById('board');
const boardView = new BoardView(boardContainer, state);

// Animation
const animation = new AnimationManager(boardView, state);

// Engine
const engine = new StochasticEngine();

// Move handler
const moveHandler = new MoveHandler(state, boardView, animation, engine);

// Panel
const panelContainer = document.getElementById('panel');
const uiPanel = new UIPanel(panelContainer, state, moveHandler);

// Tree view (inside panel's tree container)
const treeView = new TreeView(uiPanel.treeContainer, state);

// Setup panel (replaces main panel when in setup mode)
const setupContainer = document.getElementById('setup-panel');
const setupPanel = new SetupPanel(setupContainer, state);

// Double-click board to exit fullscreen tree
const boardWrap = document.getElementById('board-wrap');
let boardLastClick = 0;
boardWrap.addEventListener('mousedown', (e) => {
  if (e.target.closest('.btn-area, .panel-btn, .move-list, .move-input')) return;
  const now = Date.now();
  if (now - boardLastClick < 300 && treeView._fullscreen) {
    treeView._toggleFullscreen(e);
    boardLastClick = 0;
    return;
  }
  boardLastClick = now;
});

// Dialogs (promotion, save, load)
const overlayEl = document.getElementById('overlay');
const dialogs = new DialogManager(overlayEl, state);

// Wire promotion choice back to move handler
state.on('promotionChoice', (pieceType) => {
  moveHandler.handlePromotion(pieceType);
});

// Toggle panel visibility in setup mode
state.on('setupModeChanged', () => {
  panelContainer.style.display = state.setupMode ? 'none' : '';
  setupContainer.style.display = state.setupMode ? '' : 'none';
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Let dialogs handle their own keys
  dialogs.handleKeydown(e);

  // Skip shortcuts when typing in an input field
  if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
  if (state.showSaveDialog || state.showLoadDialog) return;
  if (state.promotingFrom !== null) return;

  if (e.key === 'ArrowLeft') { state.goBack(); }
  else if (e.key === 'ArrowRight') { state.goForward(); }
  else if (e.key === 'ArrowUp') { state.switchBranch(-1); }
  else if (e.key === 'ArrowDown') { state.switchBranch(1); }
  else if (e.key === 'u' || e.key === 'U') { state.undo(); }
  else if (e.key === 'n' || e.key === 'N') { state.newGame(); }
  else if (e.key === 'f' || e.key === 'F') { state.flipBoard(); }
  else if (e.key === ' ') { e.preventDefault(); moveHandler.requestEngineCalculation(); }
  else if (e.key === 'h' || e.key === 'H') {
    // Toggle legal move hints
    boardContainer.classList.toggle('hide-hints');
  }
  else if (e.key === 'e' || e.key === 'E') {
    if (state.setupMode) {
      // Exit setup
      setupPanel._exitSetup();
    } else {
      uiPanel._enterSetupMode();
    }
  }
  else if (e.key === 's' && e.ctrlKey) {
    e.preventDefault();
    state.emit('openSaveDialog');
  }
  else if (e.key === 'v' && e.ctrlKey) {
    // Let Paste PGN handle it
    uiPanel._pastePGN();
  }
});

// Restore theme
if (localStorage.getItem('branchess-theme') === 'banglabs') {
  document.documentElement.classList.add('theme-banglabs');
  uiPanel.themeBtn.textContent = 'Theme: Bang Labs';
}

// Fireworks — only in Bang Labs theme
function isBangLabsTheme() {
  return document.documentElement.classList.contains('theme-banglabs');
}

// Click off the board
document.addEventListener('click', (e) => {
  if (!isBangLabsTheme()) return;
  if (e.target.closest('#board, #panel, #setup-panel, #overlay, .panel-btn, .btn-area, .dialog')) return;
  bang(e.clientX, e.clientY);
});

// Fireworks show on winning
state.on('boardChanged', () => {
  if (!isBangLabsTheme()) return;
  if (state.gameOver && state.status && state.status.includes('Checkmate')) {
    const loserTurn = state.chess.turn();
    if (loserTurn !== state.playerColor) {
      fireworksShow();
    }
  }
});

// Initial render
boardView.render();
treeView.render();

// Page unload
window.addEventListener('beforeunload', () => engine.terminate());
