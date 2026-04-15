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
import { BoardSetupPanel } from './board-setup.js';
import { DialogManager } from './persistence.js';
import { bang, fireworksShow } from './bang.js';
import { LANGUAGES, getLang, setLang, onLangChange, t } from './i18n.js';
import { decodeGameFromHash, loadStudy } from './sharing.js';

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

// Board setup panel (replaces main panel when same-color double move)
const boardSetupContainer = document.getElementById('board-setup-panel');
const boardSetupPanel = new BoardSetupPanel(boardSetupContainer, panelContainer, state);

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

// Help overlay
const helpOverlay = document.getElementById('help-overlay');
const helpClose = document.getElementById('help-close');

// Use delegation so it survives panel rebuilds
panelContainer.addEventListener('click', (e) => {
  if (e.target.closest('#help-btn')) helpOverlay.classList.add('active');
});
helpClose.addEventListener('click', () => helpOverlay.classList.remove('active'));
helpOverlay.addEventListener('click', (e) => {
  if (e.target === helpOverlay) helpOverlay.classList.remove('active');
});
document.getElementById('help-reset').addEventListener('click', () => {
  if (confirm('This will delete all saved games, positions, and settings. Continue?')) {
    localStorage.clear();
    indexedDB.deleteDatabase('Branchess');
    location.reload();
  }
});
const helpThemeBtn = document.getElementById('help-theme');
helpThemeBtn.addEventListener('click', () => {
  const isBangLabs = document.documentElement.classList.toggle('theme-banglabs');
  helpThemeBtn.textContent = isBangLabs ? 'Theme: Classic' : 'Theme: Bang Labs';
  localStorage.setItem('branchess-theme', isBangLabs ? 'banglabs' : 'classic');
  state.emit('treeChanged');
  state.emit('boardChanged');
});

// Language selector — inject into help overlay footer
const helpFooterActions = document.querySelector('.help-footer-actions');
if (helpFooterActions) {
  const langSelect = document.createElement('select');
  langSelect.className = 'help-theme-btn';
  langSelect.style.marginRight = '6px';
  langSelect.style.background = '#1a1a2e';
  langSelect.style.color = '#e0e0e8';
  langSelect.style.border = '1px solid #444';
  langSelect.style.borderRadius = '6px';
  langSelect.style.padding = '6px 8px';
  for (const lang of LANGUAGES) {
    const opt = document.createElement('option');
    opt.value = lang.code;
    opt.textContent = lang.name;
    if (lang.code === getLang()) opt.selected = true;
    langSelect.appendChild(opt);
  }
  langSelect.addEventListener('change', () => {
    setLang(langSelect.value);
    state.emit('boardChanged');
    state.emit('treeChanged');
  });
  helpFooterActions.prepend(langSelect);
}

// Translate help overlay elements with data-i18n attributes
function translateHelp() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
}
translateHelp();
onLangChange(() => translateHelp());

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
// Scroll wheel on board navigates moves
boardContainer.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (e.deltaY > 0) state.goForward();
  else if (e.deltaY < 0) state.goBack();
}, { passive: false });

document.addEventListener('keydown', (e) => {
  // Help overlay escape
  if (e.key === 'Escape' && helpOverlay.classList.contains('active')) {
    helpOverlay.classList.remove('active');
    return;
  }

  // Let dialogs handle their own keys
  dialogs.handleKeydown(e);

  // Skip shortcuts when typing in an input field
  if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
  if (state.showSaveDialog || state.showLoadDialog) return;
  if (state.promotingFrom !== null) return;

  if (e.key === 'ArrowUp') { state.goBack(); }
  else if (e.key === 'ArrowDown') { state.goForward(); }
  else if (e.key === 'ArrowLeft') { state.switchBranch(-1); }
  else if (e.key === 'ArrowRight') { state.switchBranch(1); }
  else if (e.key === 'u' || e.key === 'U') { state.undo(); }
  else if (e.key === 'n' || e.key === 'N') { state.newGame(); }
  else if (e.key === ' ') { e.preventDefault(); moveHandler.showBestMove(state.chess.turn()); }
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
  else if (e.key === '?') {
    helpOverlay.classList.toggle('active');
  }
});

// Restore theme
if (localStorage.getItem('branchess-theme') === 'banglabs') {
  document.documentElement.classList.add('theme-banglabs');
  helpThemeBtn.textContent = 'Theme: Classic';
}

// Fireworks — only in Bang Labs theme
function isBangLabsTheme() {
  return document.documentElement.classList.contains('theme-banglabs');
}

// Click off the board
document.addEventListener('click', (e) => {
  if (!isBangLabsTheme()) return;
  if (e.target.closest('#board, #panel, #setup-panel, #overlay, #help-overlay, #help-btn, .panel-btn, .btn-area, .dialog')) return;
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

// Wire loadTree event (used by Library dialog and URL sharing)
state.on('loadTree', (root, statusMsg) => {
  uiPanel._loadTree(root, statusMsg);
});

// Initial render
boardView.render();
treeView.render();

// Load shared game or study from URL hash (#g=... or #s=...)
const hashData = decodeGameFromHash();
if (hashData) {
  if (hashData.type === 'game' && hashData.root) {
    uiPanel._loadTree(hashData.root, 'Shared game loaded');
  } else if (hashData.type === 'study' && hashData.slug) {
    state.status = 'Loading study...';
    state.emit('boardChanged');
    loadStudy(hashData.slug).then(root => {
      uiPanel._loadTree(root, `Study loaded: ${hashData.slug}`);
    }).catch(() => {
      state.status = 'Study not found';
      state.emit('boardChanged');
    });
  }
}

// Page unload
window.addEventListener('beforeunload', () => engine.terminate());
