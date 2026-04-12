// Colors — ported from python.Branchess/Branchess.py lines 31-67
export const COLOR_LIGHT_SQ = '#f0d9b5';
export const COLOR_DARK_SQ = '#b58863';
export const COLOR_SELECTED = 'rgba(130,151,105,0.7)';
export const COLOR_LEGAL = 'rgba(20,85,30,0.47)';
export const COLOR_LEGAL_CAPTURE = 'rgba(20,85,30,0.31)';
export const COLOR_LAST_MOVE = 'rgba(205,210,106,0.55)';
export const COLOR_CHECK = 'rgba(235,64,52,0.63)';
export const COLOR_BG = '#302e2b';
export const COLOR_PANEL = '#27251e';
export const COLOR_TEXT = '#dcdcdc';
export const COLOR_TEXT_DIM = '#969696';
export const COLOR_BTN = '#505050';
export const COLOR_BTN_HOVER = '#646464';
export const COLOR_BTN_TEXT = '#e6e6e6';
export const COLOR_BTN_ACTIVE = '#3c7850';
export const COLOR_PROMO_BG = '#3c3a37';
export const COLOR_DIALOG_BG = '#373532';
export const COLOR_DIALOG_BORDER = '#646464';
export const COLOR_SCROLL_BG = '#464441';
export const COLOR_PALETTE_SEL = '#64a064';
export const COLOR_SLIDER_TRACK = '#3c3a37';
export const COLOR_SLIDER_FILL = '#64b450';

// Tree colors — classic theme
export const COLOR_TREE_EDGE = '#37373c';
export const COLOR_TREE_PATH_EDGE = '#8cc350';
export const COLOR_TREE_NODE = '#5a5a5f';
export const COLOR_TREE_NODE_BORDER = '#78787d';
export const COLOR_TREE_PATH_NODE = '#78af50';
export const COLOR_TREE_PATH_BORDER = '#aad278';
export const COLOR_TREE_CURRENT = '#50e63c';
export const COLOR_TREE_BRANCH = '#b48c50';
export const COLOR_TREE_LABEL = '#bebea0';
export const COLOR_TREE_LABEL_DIM = '#6e6e64';

// Tree colors — Bang Labs theme
const BANGLABS_TREE = {
  EDGE: '#1e1e3a',
  PATH_EDGE: '#6366f1',
  NODE: '#2a2a44',
  NODE_BORDER: '#4a4a6a',
  PATH_NODE: '#6366f1',
  PATH_BORDER: '#818cf8',
  CURRENT: '#06b6d4',
  BRANCH: '#818cf8',
  LABEL: '#c7d2fe',
  LABEL_DIM: '#4a4a6a',
};

export function treeColors() {
  if (document.documentElement.classList.contains('theme-banglabs')) {
    return BANGLABS_TREE;
  }
  return {
    EDGE: COLOR_TREE_EDGE,
    PATH_EDGE: COLOR_TREE_PATH_EDGE,
    NODE: COLOR_TREE_NODE,
    NODE_BORDER: COLOR_TREE_NODE_BORDER,
    PATH_NODE: COLOR_TREE_PATH_NODE,
    PATH_BORDER: COLOR_TREE_PATH_BORDER,
    CURRENT: COLOR_TREE_CURRENT,
    BRANCH: COLOR_TREE_BRANCH,
    LABEL: COLOR_TREE_LABEL,
    LABEL_DIM: COLOR_TREE_LABEL_DIM,
  };
}

// Layout
export const ANIM_DURATION = 180; // ms
export const TREE_SPACING_X = 80;
export const TREE_SPACING_Y = 48;
export const TREE_NODE_R = 11;

// Unicode pieces
export const UNICODE_PIECES = {
  K: '\u2654\uFE0E', Q: '\u2655\uFE0E', R: '\u2656\uFE0E', B: '\u2657\uFE0E', N: '\u2658\uFE0E', P: '\u2659\uFE0E',
  k: '\u265A\uFE0E', q: '\u265B\uFE0E', r: '\u265C\uFE0E', b: '\u265D\uFE0E', n: '\u265E\uFE0E', p: '\u265F\uFE0E',
};

// Piece type to symbol
export const PIECE_SYMBOLS = { k: 'k', q: 'q', r: 'r', b: 'b', n: 'n', p: 'p' };

export const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const FILES = 'abcdefgh';
export const RANKS = '87654321';
