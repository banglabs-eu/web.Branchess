// GameNode and tree layout — ported from Branchess.py lines 100-169

let _nextId = 0;

export class GameNode {
  constructor(fen, move = null, san = '', parent = null) {
    this.id = _nextId++;
    this.fen = fen;
    this.move = move;   // {from, to, promotion?} or null
    this.san = san;
    this.parent = parent;
    this.children = [];
    this.annotation = ''; // !, ?, !!, ??, !?, ?!
    this.note = '';        // free-form text
  }

  addChild(move, fen, san) {
    const child = new GameNode(fen, move, san, this);
    this.children.push(child);
    return child;
  }

  findChild(move) {
    return this.children.find(c =>
      c.move && c.move.from === move.from && c.move.to === move.to &&
      (c.move.promotion || '') === (move.promotion || '')
    ) || null;
  }

  pathFromRoot() {
    const path = [];
    let node = this;
    while (node) {
      path.push(node);
      node = node.parent;
    }
    path.reverse();
    return path;
  }

  depth() {
    let d = 0, node = this.parent;
    while (node) { d++; node = node.parent; }
    return d;
  }
}

export function serializeTree(root) {
  function walk(node) {
    const obj = { fen: node.fen, san: node.san, annotation: node.annotation, note: node.note };
    if (node.move) obj.move = node.move;
    if (node.children.length) obj.children = node.children.map(walk);
    return obj;
  }
  return walk(root);
}

export function deserializeTree(data, parent = null) {
  const node = new GameNode(data.fen, data.move || null, data.san || '', parent);
  node.annotation = data.annotation || '';
  node.note = data.note || '';
  if (data.children) {
    for (const childData of data.children) {
      node.children.push(deserializeTree(childData, node));
    }
  }
  return node;
}

export function computeTreeLayout(root) {
  const positions = new Map();
  let nextX = 0;

  function walk(node, depth) {
    if (!node.children.length) {
      positions.set(node.id, { x: nextX, y: depth });
      nextX++;
    } else {
      for (const child of node.children) {
        walk(child, depth + 1);
      }
      const childXs = node.children.map(c => positions.get(c.id).x);
      positions.set(node.id, {
        x: (childXs[0] + childXs[childXs.length - 1]) / 2,
        y: depth,
      });
    }
  }

  walk(root, 0);
  return positions;
}
