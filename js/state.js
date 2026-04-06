// Simple event emitter + centralized game state
import { STARTING_FEN } from './constants.js';
import { GameNode, computeTreeLayout } from './game-tree.js';

class EventEmitter {
  constructor() { this._listeners = {}; }
  on(evt, fn) { (this._listeners[evt] ||= []).push(fn); }
  off(evt, fn) { const a = this._listeners[evt]; if (a) this._listeners[evt] = a.filter(f => f !== fn); }
  emit(evt, ...args) { (this._listeners[evt] || []).forEach(fn => fn(...args)); }
}

export class GameState extends EventEmitter {
  constructor(chess) {
    super();
    this.chess = chess;

    // Game tree
    this.treeRoot = new GameNode(STARTING_FEN);
    this.currentNode = this.treeRoot;
    this._treeLayoutDirty = true;
    this._cachedLayout = {};

    // Board orientation: 'w' = white on bottom, 'b' = black on bottom
    this.playerColor = 'w';
    this.versusMode = false; // 90° rotated board for 2 humans
    this.enginePaused = true; // When true, engine won't auto-respond
    this.bestMoveHint = null; // {from, to, score} — shown by "Best Move" button

    // Selection / UI
    this.selectedSq = null;
    this.legalDests = new Set();
    this.lastMove = null; // {from, to}
    this.status = 'White to move';
    this.engineThinking = false;
    this.gameOver = false;

    // Promotion
    this.promotingFrom = null;
    this.promotingTo = null;

    // Animation
    this.animating = false;

    // Engine queued
    this._pendingEngineMove = null;
    this._queuedEngineNav = null;

    // Strength (0-100)
    this.strength = 30;

    // Setup mode
    this.setupMode = false;
    this.setupPiece = null; // {type, color}
    this.setupTurn = 'w';

    // Dialogs
    this.showLoadDialog = false;
    this.showSaveDialog = false;
    this.saveNameText = '';
    this.loadPositions = [];
    this.loadScroll = 0;

    // Tree scroll/zoom
    this.treeScrollX = 0;
    this.treeScrollY = 0;
    this.treeZoom = 1;
  }

  fen() { return this.chess.fen(); }

  getTreeLayout() {
    if (this._treeLayoutDirty) {
      this._cachedLayout = computeTreeLayout(this.treeRoot);
      this._treeLayoutDirty = false;
    }
    return this._cachedLayout;
  }

  invalidateTreeLayout() {
    this._treeLayoutDirty = true;
    this.emit('treeChanged');
  }

  navigateTo(node) {
    this.currentNode = node;
    this.chess.load(node.fen);
    this.lastMove = node.move; // {from, to} or null
    this.selectedSq = null;
    this.legalDests = new Set();
    this.bestMoveHint = null;
    this.gameOver = false;
    this.checkGameOver();
    if (!this.gameOver) {
      this.status = this.chess.turn() === 'w' ? 'White to move' : 'Black to move';
    }
    this.emit('boardChanged');
    this.emit('treeChanged');
  }

  goBack() {
    if (this.engineThinking || !this.currentNode.parent) return;
    this.navigateTo(this.currentNode.parent);
  }

  goForward() {
    if (this.engineThinking || !this.currentNode.children.length) return;
    this.navigateTo(this.currentNode.children[0]);
  }

  switchBranch(direction) {
    if (this.engineThinking) return;
    const parent = this.currentNode.parent;
    if (!parent || parent.children.length <= 1) return;
    const idx = parent.children.indexOf(this.currentNode);
    const newIdx = ((idx + direction) % parent.children.length + parent.children.length) % parent.children.length;
    this.navigateTo(parent.children[newIdx]);
  }

  undo() {
    this.goBack();
    if (this.currentNode.parent || this.currentNode === this.treeRoot) {
      this.status = 'White to move \u2014 try a different move!';
      this.emit('boardChanged');
    }
  }

  checkGameOver() {
    if (this.chess.isCheckmate()) {
      const winner = this.chess.turn() === 'w' ? 'Black' : 'White';
      this.status = `Checkmate! ${winner} wins`;
      this.gameOver = true;
    } else if (this.chess.isStalemate()) {
      this.status = 'Stalemate \u2014 Draw';
      this.gameOver = true;
    } else if (this.chess.isInsufficientMaterial()) {
      this.status = 'Draw \u2014 Insufficient material';
      this.gameOver = true;
    } else if (this.chess.isDraw()) {
      this.status = 'Draw';
      this.gameOver = true;
    }
    return this.gameOver;
  }

  strengthParams() {
    const t = this.strength / 100;
    const skill = Math.round(t * 20);
    // Temperature: only affects low settings, near-zero above 50%
    const temperature = t < 0.5 ? 2.0 * Math.pow(1 - t * 2, 1.5) : 0;
    const thinkTime = Math.round(50 + t * t * 2000); // ms
    return { skill, temperature, thinkTime };
  }

  resetTree(fen) {
    this.treeRoot = new GameNode(fen);
    this.currentNode = this.treeRoot;
    this.invalidateTreeLayout();
    this.treeScrollX = 0;
    this.treeScrollY = 0;
    this.treeZoom = 1;
    this.lastMove = null;
    this.selectedSq = null;
    this.legalDests = new Set();
    this.bestMoveHint = null;
    this.gameOver = false;
    this.status = this.chess.turn() === 'w' ? 'White to move' : 'Black to move';
    this.emit('boardChanged');
    this.emit('treeChanged');
  }

  newGame() {
    if (this.engineThinking) return;
    this.chess.reset();
    this.resetTree(STARTING_FEN);
  }

  flipBoard() {
    this.playerColor = this.playerColor === 'w' ? 'b' : 'w';
    this.emit('boardFlipped');
    this.emit('boardChanged');
  }

  rotateBoard() {
    // Cycle: normal (w,false) → 90° (w,true) → 180° (b,false) → 270° (b,true) → normal
    if (!this.versusMode && this.playerColor === 'w') {
      this.versusMode = true; this.playerColor = 'w';
    } else if (this.versusMode && this.playerColor === 'w') {
      this.versusMode = false; this.playerColor = 'b';
    } else if (!this.versusMode && this.playerColor === 'b') {
      this.versusMode = true; this.playerColor = 'b';
    } else {
      this.versusMode = false; this.playerColor = 'w';
    }
    this.emit('boardFlipped');
    this.emit('boardChanged');
  }

  toggleVersusMode() {
    this.versusMode = !this.versusMode;
    this.playerColor = 'w'; // Reset to white on left
    this.emit('boardFlipped');
    this.emit('boardChanged');
  }
}
