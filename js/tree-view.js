// SVG-based game tree visualization
// Ported from Branchess.py lines 860-986
import { TREE_SPACING_X, TREE_SPACING_Y, TREE_NODE_R, treeColors } from './constants.js';
import { OPENINGS } from './openings.js';
import { isTablebasePosition, queryTablebase, categoryLabel, categoryColor } from './tablebase.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export class TreeView {
  constructor(container, state) {
    this.container = container;
    this.state = state;
    this.svg = null;
    this._dragging = false;
    this._dragStart = null;
    this._dragScrollStart = null;
    this._lastClickTime = 0;
    this._fullscreen = false;
    this._boardDragging = false;
    this._boardDragStart = null;
    this._boardPos = null;

    this._build();
    state.on('treeChanged', () => this.render());
    state.on('boardChanged', () => this.render());
  }

  _build() {
    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.classList.add('tree-svg');
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');

    // Defs for glow filter
    const defs = document.createElementNS(SVG_NS, 'defs');
    const filter = document.createElementNS(SVG_NS, 'filter');
    filter.id = 'glow';
    filter.setAttribute('x', '-50%');
    filter.setAttribute('y', '-50%');
    filter.setAttribute('width', '200%');
    filter.setAttribute('height', '200%');
    const blur = document.createElementNS(SVG_NS, 'feGaussianBlur');
    blur.setAttribute('stdDeviation', '3');
    blur.setAttribute('result', 'blur');
    const merge = document.createElementNS(SVG_NS, 'feMerge');
    const mn1 = document.createElementNS(SVG_NS, 'feMergeNode');
    mn1.setAttribute('in', 'blur');
    const mn2 = document.createElementNS(SVG_NS, 'feMergeNode');
    mn2.setAttribute('in', 'SourceGraphic');
    merge.append(mn1, mn2);
    filter.append(blur, merge);
    defs.append(filter);
    this.svg.append(defs);

    this.openingsGroup = document.createElementNS(SVG_NS, 'g');
    this.edgesGroup = document.createElementNS(SVG_NS, 'g');
    this.nodesGroup = document.createElementNS(SVG_NS, 'g');
    this.labelsGroup = document.createElementNS(SVG_NS, 'g');
    this.tooltipGroup = document.createElementNS(SVG_NS, 'g');
    this.svg.append(this.openingsGroup, this.edgesGroup, this.nodesGroup, this.labelsGroup, this.tooltipGroup);

    this.container.appendChild(this.svg);

    // Zoom controls
    const zoomBar = document.createElement('div');
    zoomBar.className = 'tree-zoom-bar';
    const zoomIn = document.createElement('button');
    zoomIn.className = 'tree-zoom-btn';
    zoomIn.textContent = '+';
    zoomIn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.state.treeZoom = Math.min(4, this.state.treeZoom * 1.3);
      this.render();
    });
    const zoomOut = document.createElement('button');
    zoomOut.className = 'tree-zoom-btn';
    zoomOut.textContent = '−';
    zoomOut.addEventListener('click', (e) => {
      e.stopPropagation();
      this.state.treeZoom = Math.max(0.3, this.state.treeZoom / 1.3);
      this.render();
    });
    const zoomReset = document.createElement('button');
    zoomReset.className = 'tree-zoom-btn';
    zoomReset.textContent = '⊙';
    zoomReset.addEventListener('click', (e) => {
      e.stopPropagation();
      this.state.treeZoom = 1;
      this.state.treeScrollX = 0;
      this.state.treeScrollY = 0;
      this.render();
    });
    zoomBar.append(zoomIn, zoomOut, zoomReset);
    this.container.appendChild(zoomBar);

    // Mouse interactions
    this._bindEvents();
  }

  _bindEvents() {
    const el = this.container;

    el.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const now = Date.now();
      if (now - this._lastClickTime < 300) {
        this._lastClickTime = 0;
        // Double click on node → open note editor; on empty space → toggle fullscreen
        const node = this._findClickedNode(e);
        if (node) {
          this._handleNodeDoubleClick(e);
        } else {
          this._toggleFullscreen(e);
        }
        return;
      }
      this._lastClickTime = now;
      this._dragging = true;
      this._dragStart = { x: e.clientX, y: e.clientY };
      this._dragScrollStart = { x: this.state.treeScrollX, y: this.state.treeScrollY };
      el.style.cursor = 'grabbing';
    });

    // Right-click: open annotation menu on node
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const node = this._findClickedNode(e);
      if (node && node.san) {
        this._openAnnotationMenu(e, node);
      } else {
        this._closeAnnotationMenu();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!this._dragging) return;
      const dx = e.clientX - this._dragStart.x;
      const dy = e.clientY - this._dragStart.y;
      this.state.treeScrollX = this._dragScrollStart.x - dx;
      this.state.treeScrollY = this._dragScrollStart.y - dy;
      this.render();
    });

    window.addEventListener('mouseup', (e) => {
      if (!this._dragging) return;
      this._dragging = false;
      el.style.cursor = '';
      const dx = e.clientX - this._dragStart.x;
      const dy = e.clientY - this._dragStart.y;
      // If barely moved, treat as node click
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
        this._handleNodeClick(e);
      }
    });

    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      this.state.treeZoom = Math.max(0.3, Math.min(6, this.state.treeZoom * factor));
      this.render();
    }, { passive: false });
  }

  _findClickedNode(e) {
    const rect = this.svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const nodes = this.nodesGroup.querySelectorAll('[data-node-id]');
    for (const el of nodes) {
      const cx = parseFloat(el.getAttribute('cx') || el.getAttribute('x') || 0);
      const cy = parseFloat(el.getAttribute('cy') || el.getAttribute('y') || 0);
      const r = TREE_NODE_R * this.state.treeZoom + 5;
      let centerX = cx, centerY = cy;
      if (el.tagName === 'polygon') {
        const pts = el.getAttribute('points').split(' ').map(p => p.split(',').map(Number));
        centerX = pts.reduce((s, p) => s + p[0], 0) / pts.length;
        centerY = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      }
      if (Math.abs(x - centerX) < r && Math.abs(y - centerY) < r) {
        const nodeId = parseInt(el.dataset.nodeId);
        return this._findNodeById(this.state.treeRoot, nodeId);
      }
    }
    return null;
  }

  _handleNodeClick(e) {
    const node = this._findClickedNode(e);
    if (node) this.state.navigateTo(node);
  }

  _openAnnotationMenu(e, node) {
    this._closeAnnotationMenu();

    const ANNOTATIONS = [
      { sym: '!',  label: 'Good move',    color: '#4caf50' },
      { sym: '!!', label: 'Brilliant',     color: '#2196f3' },
      { sym: '!?', label: 'Interesting',   color: '#ff9800' },
      { sym: '?!', label: 'Dubious',       color: '#ffeb3b' },
      { sym: '?',  label: 'Mistake',       color: '#f44336' },
      { sym: '??', label: 'Blunder',       color: '#9c27b0' },
      { sym: '',   label: 'Clear',         color: '#888' },
    ];

    const menu = document.createElement('div');
    menu.className = 'anno-menu';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';

    for (const a of ANNOTATIONS) {
      const item = document.createElement('div');
      item.className = 'anno-menu-item';
      if (node.annotation === a.sym) item.classList.add('anno-menu-active');

      const sym = document.createElement('span');
      sym.className = 'anno-menu-sym';
      sym.style.color = a.color;
      sym.textContent = a.sym || '✕';

      const label = document.createElement('span');
      label.className = 'anno-menu-label';
      label.textContent = a.label;

      item.append(sym, label);
      item.addEventListener('click', (ev) => {
        ev.stopPropagation();
        node.annotation = a.sym;
        this._closeAnnotationMenu();
        this.render();
      });
      menu.appendChild(item);
    }

    document.body.appendChild(menu);
    this._annoMenu = menu;

    // Close on click elsewhere
    this._annoCloseHandler = () => this._closeAnnotationMenu();
    setTimeout(() => window.addEventListener('click', this._annoCloseHandler), 0);
  }

  _closeAnnotationMenu() {
    if (this._annoMenu) {
      this._annoMenu.remove();
      this._annoMenu = null;
    }
    if (this._annoCloseHandler) {
      window.removeEventListener('click', this._annoCloseHandler);
      this._annoCloseHandler = null;
    }
  }

  _handleNodeDoubleClick(e) {
    const node = this._findClickedNode(e);
    if (!node) return;
    this._openNoteDialog(node);
  }

  _openNoteDialog(node) {
    const overlay = document.getElementById('overlay');
    overlay.style.display = 'flex';
    overlay.innerHTML = '';

    const box = document.createElement('div');
    box.className = 'dialog note-dialog';

    const title = document.createElement('div');
    title.className = 'dialog-title';
    title.textContent = `Note: ${node.san || 'Start'}${node.annotation}`;
    box.appendChild(title);

    const textarea = document.createElement('textarea');
    textarea.className = 'dialog-textarea';
    textarea.value = node.note;
    textarea.rows = 6;
    textarea.placeholder = 'Document your thinking...';
    box.appendChild(textarea);

    const btnRow = document.createElement('div');
    btnRow.className = 'dialog-btn-row';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'panel-btn btn-active';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => {
      node.note = textarea.value;
      overlay.innerHTML = '';
      overlay.style.display = 'none';
      this.render();
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'panel-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      overlay.innerHTML = '';
      overlay.style.display = 'none';
    });

    btnRow.append(saveBtn, cancelBtn);
    box.appendChild(btnRow);
    overlay.appendChild(box);

    textarea.focus();
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { overlay.innerHTML = ''; overlay.style.display = 'none'; }
      e.stopPropagation(); // Don't trigger game shortcuts
    });
  }

  _toggleFullscreen(e) {
    this._fullscreen = !this._fullscreen;
    const boardWrap = document.getElementById('board-wrap');
    const panel = document.getElementById('panel');

    if (this._fullscreen) {
      // Capture click position relative to SVG before layout change
      const svgRect = this.svg.getBoundingClientRect();
      const clickSvgX = e.clientX - svgRect.left;
      const clickSvgY = e.clientY - svgRect.top;

      // Tree goes fullscreen, board becomes floating window
      this.container.classList.add('tree-fullscreen');
      boardWrap.classList.add('board-floating');
      panel.classList.add('panel-hidden');

      // Adjust scroll so the click point stays centered in the fullscreen view
      const newW = window.innerWidth;
      const newH = window.innerHeight;
      // The click was at (clickSvgX, clickSvgY) in the old SVG.
      // We want that same world point at the center of the new viewport.
      this.state.treeScrollX += clickSvgX - newW / 2;
      this.state.treeScrollY += clickSvgY - newH / 2;

      // Move buttons under the floating board
      const btnArea = panel.querySelector('.btn-area');
      if (btnArea) boardWrap.appendChild(btnArea);

      // Position board at bottom-right
      // Use requestAnimationFrame so the board has its floating size
      requestAnimationFrame(() => {
        const bw = boardWrap.offsetWidth || 300;
        const bh = boardWrap.offsetHeight || 300;
        this._boardPos = { x: newW - bw - 16, y: newH - bh - 16 };
        boardWrap.style.left = this._boardPos.x + 'px';
        boardWrap.style.top = this._boardPos.y + 'px';
      });

      // Make board draggable
      this._boardMouseDown = (ev) => {
        if (ev.target.closest('.square') || ev.target.closest('.btn-area')) return;
        ev.preventDefault();
        this._boardDragging = true;
        this._boardDragStart = { x: ev.clientX - this._boardPos.x, y: ev.clientY - this._boardPos.y };
      };
      this._boardMouseMove = (ev) => {
        if (!this._boardDragging) return;
        this._boardPos.x = ev.clientX - this._boardDragStart.x;
        this._boardPos.y = ev.clientY - this._boardDragStart.y;
        boardWrap.style.left = this._boardPos.x + 'px';
        boardWrap.style.top = this._boardPos.y + 'px';
      };
      this._boardMouseUp = () => { this._boardDragging = false; };

      boardWrap.addEventListener('mousedown', this._boardMouseDown);
      window.addEventListener('mousemove', this._boardMouseMove);
      window.addEventListener('mouseup', this._boardMouseUp);
    } else {
      // Capture click position before restoring
      const svgRect = this.svg.getBoundingClientRect();
      const clickSvgX = e.clientX - svgRect.left;
      const clickSvgY = e.clientY - svgRect.top;

      // Move buttons back to panel (before the slider)
      const btnArea = boardWrap.querySelector('.btn-area');
      if (btnArea) {
        const slider = panel.querySelector('.slider-area');
        if (slider) panel.insertBefore(btnArea, slider);
        else panel.appendChild(btnArea);
      }

      // Restore normal layout
      this.container.classList.remove('tree-fullscreen');
      boardWrap.classList.remove('board-floating');
      panel.classList.remove('panel-hidden');
      boardWrap.style.left = '';
      boardWrap.style.top = '';

      if (this._boardMouseDown) {
        boardWrap.removeEventListener('mousedown', this._boardMouseDown);
        window.removeEventListener('mousemove', this._boardMouseMove);
        window.removeEventListener('mouseup', this._boardMouseUp);
      }

      // Reset scroll and zoom when returning to default view — auto-centers on current node
      this.state.treeScrollX = 0;
      this.state.treeScrollY = 0;
      this.state.treeZoom = 1;
    }

    this.render();
  }

  _findNodeById(root, id) {
    if (root.id === id) return root;
    for (const child of root.children) {
      const found = this._findNodeById(child, id);
      if (found) return found;
    }
    return null;
  }

  render() {
    const layout = this.state.getTreeLayout();
    if (!layout.size) return;

    const tc = treeColors();
    const state = this.state;
    const zoom = state.treeZoom;
    const r = Math.max(2, Math.round(TREE_NODE_R * zoom));
    const sx = TREE_SPACING_X * zoom;
    const sy = TREE_SPACING_Y * zoom;

    // Current path
    const pathIds = new Set();
    let node = state.currentNode;
    while (node) {
      pathIds.add(node.id);
      node = node.parent;
    }

    // Auto-center on current node
    const svgRect = this.svg.getBoundingClientRect();
    const areaW = svgRect.width || 280;
    const areaH = svgRect.height || 200;
    const curPos = layout.get(state.currentNode.id) || { x: 0, y: 0 };
    const vpX = curPos.x * sx - areaW / 2 + state.treeScrollX;
    const vpY = curPos.y * sy - areaH / 3 + state.treeScrollY;

    const toPx = (lx, ly) => [lx * sx - vpX, ly * sy - vpY];

    // Clear groups
    this.openingsGroup.innerHTML = '';
    this.edgesGroup.innerHTML = '';
    this.nodesGroup.innerHTML = '';
    this.labelsGroup.innerHTML = '';
    this.tooltipGroup.innerHTML = '';

    // Collect all nodes
    const allNodes = [];
    const gather = (n) => { allNodes.push(n); n.children.forEach(gather); };
    gather(state.treeRoot);

    // Detect and draw opening annotations
    this._drawOpenings(state.treeRoot, layout, toPx, r, zoom, areaW, areaH);
    this._drawOpeningSuggestions(state, layout, toPx, r, zoom, sy);

    // Tablebase endgame suggestions
    this._drawTablebaseSuggestions(state, layout, toPx, r, zoom, sy);

    // Pass 1: dim edges
    for (const n of allNodes) {
      if (!n.children.length) continue;
      const nPos = layout.get(n.id);
      if (!nPos) continue;
      const [ppx, ppy] = toPx(nPos.x, nPos.y);
      for (const child of n.children) {
        const cPos = layout.get(child.id);
        if (!cPos) continue;
        if (pathIds.has(n.id) && pathIds.has(child.id)) continue;
        const [cpx, cpy] = toPx(cPos.x, cPos.y);
        this._drawEdge(ppx, ppy + r, cpx, cpy - r, tc.EDGE, 1);
      }
    }

    // Path edges
    const pathList = state.currentNode.pathFromRoot();
    for (let i = 0; i < pathList.length - 1; i++) {
      const pPos = layout.get(pathList[i].id);
      const cPos = layout.get(pathList[i + 1].id);
      if (!pPos || !cPos) continue;
      const [ppx, ppy] = toPx(pPos.x, pPos.y);
      const [cpx, cpy] = toPx(cPos.x, cPos.y);
      // Glow edge
      this._drawEdge(ppx, ppy + r, cpx, cpy - r, tc.PATH_EDGE, 4, 0.3);
      this._drawEdge(ppx, ppy + r, cpx, cpy - r, tc.PATH_EDGE, 2);
    }

    // Annotation color map
    const ANNO_COLORS = {
      '!':  '#4caf50', // good — green
      '!!': '#2196f3', // brilliant — blue
      '?':  '#f44336', // mistake — red
      '??': '#9c27b0', // blunder — purple
      '!?': '#ff9800', // interesting — orange
      '?!': '#ffeb3b', // dubious — yellow
    };

    // Pass 2: nodes
    for (const n of allNodes) {
      const nPos = layout.get(n.id);
      if (!nPos) continue;
      const [npx, npy] = toPx(nPos.x, nPos.y);

      // Cull off-screen
      if (npx < -30 || npx > areaW + 30 || npy < -30 || npy > areaH + 30) continue;

      const isCurrent = n === state.currentNode;
      const onPath = pathIds.has(n.id);
      const isBranch = n.children.length > 1;
      const annoColor = n.annotation ? ANNO_COLORS[n.annotation] : null;

      if (isCurrent) {
        // Glow halo
        const haloColor = annoColor || tc.CURRENT;
        const halo = document.createElementNS(SVG_NS, 'circle');
        halo.setAttribute('cx', npx);
        halo.setAttribute('cy', npy);
        halo.setAttribute('r', r * 3);
        halo.setAttribute('fill', haloColor);
        halo.setAttribute('opacity', '0.14');
        this.nodesGroup.append(halo);

        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('cx', npx);
        circle.setAttribute('cy', npy);
        circle.setAttribute('r', r + 2);
        circle.setAttribute('fill', annoColor || tc.CURRENT);
        circle.setAttribute('stroke', '#fff');
        circle.setAttribute('stroke-width', '2');
        circle.setAttribute('filter', 'url(#glow)');
        circle.dataset.nodeId = n.id;
        this.nodesGroup.append(circle);
      } else if (annoColor) {
        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('cx', npx);
        circle.setAttribute('cy', npy);
        circle.setAttribute('r', onPath ? r : r - 1);
        circle.setAttribute('fill', annoColor);
        circle.setAttribute('stroke', onPath ? '#fff' : annoColor);
        circle.setAttribute('stroke-width', '1.5');
        circle.dataset.nodeId = n.id;
        this.nodesGroup.append(circle);
      } else if (onPath) {
        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('cx', npx);
        circle.setAttribute('cy', npy);
        circle.setAttribute('r', r);
        circle.setAttribute('fill', tc.PATH_NODE);
        circle.setAttribute('stroke', tc.PATH_BORDER);
        circle.setAttribute('stroke-width', '1');
        circle.dataset.nodeId = n.id;
        this.nodesGroup.append(circle);
      } else if (isBranch) {
        const pts = [
          `${npx},${npy - r}`, `${npx + r},${npy}`,
          `${npx},${npy + r}`, `${npx - r},${npy}`
        ].join(' ');
        const poly = document.createElementNS(SVG_NS, 'polygon');
        poly.setAttribute('points', pts);
        poly.setAttribute('fill', tc.BRANCH);
        poly.setAttribute('stroke', '#c8aa64');
        poly.setAttribute('stroke-width', '1');
        poly.dataset.nodeId = n.id;
        this.nodesGroup.append(poly);
      } else {
        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('cx', npx);
        circle.setAttribute('cy', npy);
        circle.setAttribute('r', r - 1);
        circle.setAttribute('fill', tc.NODE);
        circle.setAttribute('stroke', tc.NODE_BORDER);
        circle.setAttribute('stroke-width', '1');
        circle.dataset.nodeId = n.id;
        this.nodesGroup.append(circle);
      }

      // Note indicator (small dot) + hover tooltip
      if (n.note) {
        const dot = document.createElementNS(SVG_NS, 'circle');
        dot.setAttribute('cx', npx + r);
        dot.setAttribute('cy', npy - r);
        dot.setAttribute('r', Math.max(2, 3 * zoom));
        dot.setAttribute('fill', '#ffeb3b');
        this.nodesGroup.append(dot);

        // Invisible hit area for hover
        const hitR = r + 4;
        const hit = document.createElementNS(SVG_NS, 'circle');
        hit.setAttribute('cx', npx);
        hit.setAttribute('cy', npy);
        hit.setAttribute('r', hitR);
        hit.setAttribute('fill', 'transparent');
        hit.style.cursor = 'pointer';

        // Tooltip elements (hidden until hover) — multiline
        const fontSize = Math.max(10, 12 * zoom);
        const lineH = fontSize * 1.4;
        const pad = 6;
        const maxCharsPerLine = 30;

        // Word-wrap into lines
        const lines = [];
        for (const raw of n.note.split('\n')) {
          if (!raw.length) { lines.push(''); continue; }
          const words = raw.split(/\s+/);
          let cur = '';
          for (const w of words) {
            if (cur && (cur.length + 1 + w.length) > maxCharsPerLine) {
              lines.push(cur);
              cur = w;
            } else {
              cur = cur ? cur + ' ' + w : w;
            }
          }
          if (cur) lines.push(cur);
        }

        let maxLineW = 0;
        for (const l of lines) maxLineW = Math.max(maxLineW, l.length);
        const tipW = maxLineW * fontSize * 0.6 + pad * 2;
        const tipH = lines.length * lineH + pad * 2;
        const tipX = npx - tipW / 2;
        const tipY = npy - r - tipH - 6;

        const bg = document.createElementNS(SVG_NS, 'rect');
        bg.setAttribute('x', tipX);
        bg.setAttribute('y', tipY);
        bg.setAttribute('width', tipW);
        bg.setAttribute('height', tipH);
        bg.setAttribute('rx', '4');
        bg.setAttribute('fill', '#2a2a2a');
        bg.setAttribute('stroke', '#ffeb3b');
        bg.setAttribute('stroke-width', '1');
        bg.setAttribute('opacity', '0.95');
        bg.style.display = 'none';

        const label = document.createElementNS(SVG_NS, 'text');
        label.setAttribute('x', tipX + pad);
        label.setAttribute('fill', '#e8e0d0');
        label.setAttribute('font-size', fontSize + 'px');
        label.setAttribute('font-family', 'system-ui, sans-serif');
        for (let li = 0; li < lines.length; li++) {
          const tspan = document.createElementNS(SVG_NS, 'tspan');
          tspan.setAttribute('x', tipX + pad);
          tspan.setAttribute('y', tipY + pad + fontSize * 0.8 + li * lineH);
          tspan.textContent = lines[li] || '\u00a0';
          label.appendChild(tspan);
        }
        label.style.display = 'none';

        hit.addEventListener('mouseenter', () => {
          bg.style.display = '';
          label.style.display = '';
        });
        hit.addEventListener('mouseleave', () => {
          bg.style.display = 'none';
          label.style.display = 'none';
        });

        this.tooltipGroup.append(bg, label);
        this.nodesGroup.append(hit);
      }

      // SAN label + annotation
      if (n.san) {
        const showLabel = onPath || (n.parent && n.parent.children.length > 1) || n.annotation;
        if (showLabel) {
          const text = document.createElementNS(SVG_NS, 'text');
          text.setAttribute('x', npx);
          text.setAttribute('y', npy + r + Math.max(10, 14 * zoom));
          text.setAttribute('text-anchor', 'middle');
          text.setAttribute('fill', annoColor || (onPath ? tc.LABEL : tc.LABEL_DIM));
          text.setAttribute('font-size', Math.max(9, 12 * zoom) + 'px');
          text.setAttribute('font-family', 'system-ui, sans-serif');
          text.textContent = n.san + (n.annotation || '');
          this.labelsGroup.append(text);
        }
      }
    }
  }

  _detectOpenings(root) {
    // For each branch from root, collect SANs and match against openings
    const results = [];
    const seen = new Set();

    // Gather all leaf-to-root paths, then check each
    const walkBranch = (node, sans, nodes) => {
      if (node.san) {
        sans = [...sans, node.san];
        nodes = [...nodes, node];
      }

      // Check this path against all openings, keep the longest match
      let best = null;
      for (const op of OPENINGS) {
        if (op.moves.length > sans.length) continue;
        let match = true;
        for (let i = 0; i < op.moves.length; i++) {
          if (op.moves[i] !== sans[i]) { match = false; break; }
        }
        if (match && (!best || op.moves.length > best.opening.moves.length)) {
          best = { opening: op, nodes: nodes.slice(0, op.moves.length) };
        }
      }

      if (best) {
        const key = best.opening.name + ':' + best.nodes[0].id;
        if (!seen.has(key)) {
          seen.add(key);
          results.push(best);
        }
      }

      for (const child of node.children) {
        walkBranch(child, sans, nodes);
      }
    };

    walkBranch(root, [], []);
    return results;
  }

  _drawOpenings(root, layout, toPx, r, zoom, areaW, areaH) {
    const matches = this._detectOpenings(root);

    for (const match of matches) {
      const { opening, nodes } = match;
      if (!nodes.length) continue;

      // Get pixel positions of the first and last nodes in the opening
      const positions = nodes.map(n => {
        const pos = layout.get(n.id);
        return pos ? toPx(pos.x, pos.y) : null;
      }).filter(Boolean);

      if (!positions.length) continue;

      // Compute bounding box
      const pad = r + 8;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const [px, py] of positions) {
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
      minX -= pad; minY -= pad;
      maxX += pad; maxY += pad;

      // Skip if entirely off-screen
      if (maxX < -50 || minX > areaW + 50 || maxY < -50 || minY > areaH + 50) continue;

      // Draw rounded rectangle
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', minX);
      rect.setAttribute('y', minY);
      rect.setAttribute('width', maxX - minX);
      rect.setAttribute('height', maxY - minY);
      rect.setAttribute('rx', '6');
      rect.setAttribute('ry', '6');
      rect.setAttribute('fill', 'rgba(60, 90, 60, 0.25)');
      rect.setAttribute('stroke', '#6a9a5b');
      rect.setAttribute('stroke-width', '1.5');
      rect.setAttribute('stroke-dasharray', '4,3');
      this.openingsGroup.append(rect);

      // Draw opening name label (clickable, rotated 45°)
      const fontSize = Math.max(9, 12 * zoom);
      const lx = minX + 4;
      const ly = maxY + fontSize + 4;
      const label = document.createElementNS(SVG_NS, 'text');
      label.classList.add('opening-label');
      label.setAttribute('x', lx);
      label.setAttribute('y', ly);
      label.setAttribute('fill', '#8cbf78');
      label.setAttribute('font-size', fontSize + 'px');
      label.setAttribute('font-family', 'Inter, system-ui, sans-serif');
      label.setAttribute('font-weight', '600');
      label.setAttribute('opacity', '0.8');
      label.setAttribute('transform', `rotate(45, ${lx}, ${ly})`);
      label.textContent = opening.name;
      const url = opening.url;
      label.addEventListener('click', (e) => {
        e.stopPropagation();
        window.open(url, '_blank');
      });
      this.tooltipGroup.append(label);
    }
  }

  _buildGhostTree(currentNode) {
    // Build a virtual tree of all opening continuations from the current position
    const pathSans = currentNode.pathFromRoot().slice(1).map(n => n.san);

    // Find all openings matching the current path
    const matchingOpenings = [];
    for (const op of OPENINGS) {
      if (op.moves.length <= pathSans.length) continue;
      let match = true;
      for (let i = 0; i < pathSans.length; i++) {
        if (op.moves[i] !== pathSans[i]) { match = false; break; }
      }
      if (match) matchingOpenings.push(op);
    }
    if (!matchingOpenings.length) return null;

    // Build a tree structure from the remaining moves of each opening
    // Each node: { move, children: Map<move, node>, names: [], url, fullMoves[] }
    const root = { move: null, children: new Map(), names: [], url: null, fullMoves: [...pathSans] };

    for (const op of matchingOpenings) {
      let node = root;
      for (let i = pathSans.length; i < op.moves.length; i++) {
        const m = op.moves[i];
        if (!node.children.has(m)) {
          const parentMoves = node.fullMoves;
          node.children.set(m, {
            move: m, children: new Map(), names: [], url: null,
            fullMoves: [...parentMoves, m]
          });
        }
        node = node.children.get(m);
      }
      // Tag the final node of this opening with its name and stats
      node.names.push(op.name);
      node.url = op.url;
      if (op.stats) node.stats = op.stats;
    }
    return root;
  }

  _drawOpeningSuggestions(state, layout, toPx, r, zoom, sy) {
    const ghostTree = this._buildGhostTree(state.currentNode);
    if (!ghostTree || !ghostTree.children.size) return;

    const curPos = layout.get(state.currentNode.id);
    if (!curPos) return;
    const [cx, cy] = toPx(curPos.x, curPos.y);

    const fontSize = Math.max(10, 13 * zoom);
    const ghostR = Math.max(2, r - 2);
    const sx = TREE_SPACING_X * zoom;

    // Layout the ghost tree: assign x positions via leaf counting, then center
    let leafCounter = 0;
    const ghostLayout = new Map(); // ghostNode -> { x, y }

    const layoutGhost = (gNode, depth) => {
      const children = [...gNode.children.values()];

      // Skip nodes whose move already exists as a real child (at depth 1)
      const filteredChildren = depth === 0
        ? children.filter(c => !state.currentNode.children.some(ch => ch.san === c.move))
        : children;

      if (filteredChildren.length === 0) {
        ghostLayout.set(gNode, { x: leafCounter, y: depth });
        leafCounter++;
        return;
      }

      for (const child of filteredChildren) {
        layoutGhost(child, depth + 1);
      }

      // Center parent over children
      const childPositions = filteredChildren.map(c => ghostLayout.get(c)).filter(Boolean);
      if (childPositions.length) {
        const avgX = childPositions.reduce((s, p) => s + p.x, 0) / childPositions.length;
        ghostLayout.set(gNode, { x: avgX, y: depth });
      } else {
        ghostLayout.set(gNode, { x: leafCounter, y: depth });
        leafCounter++;
      }
    };

    // Layout each top-level ghost branch
    const topChildren = [...ghostTree.children.values()]
      .filter(c => !state.currentNode.children.some(ch => ch.san === c.move));
    for (const child of topChildren) {
      layoutGhost(child, 1);
    }

    // Center the ghost tree under the current node
    const totalLeaves = leafCounter;
    const centerOffset = (totalLeaves - 1) / 2;
    for (const [gNode, pos] of ghostLayout) {
      pos.x -= centerOffset;
    }

    // Draw the ghost tree recursively
    const drawGhostNode = (gNode, parentPx, parentPy, depth) => {
      const pos = ghostLayout.get(gNode);
      if (!pos) return;

      const gx = cx + pos.x * sx;
      const gy = cy + pos.y * sy;

      // Ghost edge from parent
      if (parentPx !== null) {
        const midY = (parentPy + r + gy - ghostR) / 2;
        const edge = document.createElementNS(SVG_NS, 'path');
        edge.setAttribute('d', `M ${parentPx},${parentPy + r} C ${parentPx},${midY} ${gx},${midY} ${gx},${gy - ghostR}`);
        edge.setAttribute('stroke', '#6a9a5b');
        edge.setAttribute('stroke-width', '1');
        edge.setAttribute('stroke-dasharray', '4,3');
        edge.setAttribute('fill', 'none');
        edge.setAttribute('opacity', '0.4');
        this.openingsGroup.append(edge);
      }

      // Ghost node — clickable to play to this position
      const hitR = Math.max(ghostR + 4, 10); // larger hit area
      const hitArea = document.createElementNS(SVG_NS, 'circle');
      hitArea.setAttribute('cx', gx);
      hitArea.setAttribute('cy', gy);
      hitArea.setAttribute('r', hitR);
      hitArea.setAttribute('fill', 'transparent');
      hitArea.setAttribute('cursor', 'pointer');
      hitArea.classList.add('ghost-hit');

      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', gx);
      circle.setAttribute('cy', gy);
      circle.setAttribute('r', ghostR);
      circle.setAttribute('fill', gNode.names.length ? 'rgba(106, 154, 91, 0.3)' : 'none');
      circle.setAttribute('stroke', '#6a9a5b');
      circle.setAttribute('stroke-width', '1.5');
      circle.setAttribute('stroke-dasharray', '3,2');
      circle.setAttribute('opacity', '0.6');
      circle.style.pointerEvents = 'none';
      this.openingsGroup.append(circle);

      // Move label
      const moveLabel = document.createElementNS(SVG_NS, 'text');
      moveLabel.setAttribute('x', gx + ghostR + 4);
      moveLabel.setAttribute('y', gy + 3);
      moveLabel.setAttribute('fill', '#8cbf78');
      moveLabel.setAttribute('font-size', fontSize + 'px');
      moveLabel.setAttribute('font-family', 'system-ui, sans-serif');
      moveLabel.setAttribute('font-weight', '600');
      moveLabel.setAttribute('opacity', '0.8');
      moveLabel.textContent = gNode.move;
      this.openingsGroup.append(moveLabel);

      // Opening name + stats labels — hidden by default, shown on hover
      const nameEls = [];
      if (gNode.names.length) {
        const nameFontSize = fontSize * 0.75;
        const lx = gx + ghostR + 4;
        const ly = gy + ghostR + nameFontSize + 2;
        let lineIdx = 0;

        for (let ni = 0; ni < gNode.names.length; ni++) {
          const name = gNode.names[ni];
          const url = gNode.url;
          const nameLabel = document.createElementNS(SVG_NS, 'text');
          nameLabel.classList.add('opening-label');
          nameLabel.setAttribute('x', lx);
          nameLabel.setAttribute('y', ly + lineIdx * nameFontSize * 1.3);
          nameLabel.setAttribute('fill', '#8cbf78');
          nameLabel.setAttribute('font-size', nameFontSize + 'px');
          nameLabel.setAttribute('font-family', 'Inter, system-ui, sans-serif');
          nameLabel.setAttribute('opacity', '0');
          nameLabel.setAttribute('transform', `rotate(45, ${lx}, ${ly + lineIdx * nameFontSize * 1.3})`);
          nameLabel.style.transition = 'opacity 0.15s';
          nameLabel.textContent = name;
          if (url) {
            nameLabel.addEventListener('click', (e) => {
              e.stopPropagation();
              window.open(url, '_blank');
            });
          }
          this.tooltipGroup.append(nameLabel);
          nameEls.push(nameLabel);
          lineIdx++;
        }

        // Stats bar if available
        if (gNode.stats) {
          const s = gNode.stats;
          const statsLabel = document.createElementNS(SVG_NS, 'text');
          statsLabel.setAttribute('x', lx);
          statsLabel.setAttribute('y', ly + lineIdx * nameFontSize * 1.3);
          statsLabel.setAttribute('fill', '#aaa');
          statsLabel.setAttribute('font-size', (nameFontSize * 0.9) + 'px');
          statsLabel.setAttribute('font-family', 'JetBrains Mono, monospace');
          statsLabel.setAttribute('opacity', '0');
          statsLabel.setAttribute('transform', `rotate(45, ${lx}, ${ly + lineIdx * nameFontSize * 1.3})`);
          statsLabel.style.transition = 'opacity 0.15s';
          statsLabel.textContent = `W${s.w}% D${s.d}% B${s.b}%`;
          this.tooltipGroup.append(statsLabel);
          nameEls.push(statsLabel);
        }
      }

      // Hover: show names
      hitArea.addEventListener('mouseenter', () => {
        circle.setAttribute('opacity', '1');
        circle.setAttribute('stroke-width', '2.5');
        for (const el of nameEls) el.setAttribute('opacity', '0.9');
      });
      hitArea.addEventListener('mouseleave', () => {
        circle.setAttribute('opacity', '0.6');
        circle.setAttribute('stroke-width', '1.5');
        for (const el of nameEls) el.setAttribute('opacity', '0');
      });

      // Click: play all moves to reach this position
      const fullMoves = gNode.fullMoves;
      const stateRef = this.state;
      hitArea.addEventListener('click', (e) => {
        e.stopPropagation();
        this._playOpeningMoves(fullMoves);
      });

      this.openingsGroup.append(hitArea);

      // Recurse into children
      for (const child of gNode.children.values()) {
        drawGhostNode(child, gx, gy, depth + 1);
      }
    };

    // Draw each top-level ghost branch
    for (const child of topChildren) {
      drawGhostNode(child, cx, cy, 1);
    }
  }

  _drawTablebaseSuggestions(state, layout, toPx, r, zoom, sy) {
    const fen = state.chess.fen();
    if (!isTablebasePosition(fen)) {
      this._tbData = null;
      return;
    }

    // Async query — cache result and re-render once
    const cacheKey = fen.split(' ').slice(0, 4).join(' ');
    if (this._tbCacheKey === cacheKey && this._tbData) {
      this._renderTablebaseMoves(state, layout, toPx, r, zoom, sy, this._tbData);
      return;
    }

    // Don't re-query if already pending for this position
    if (this._tbPending === cacheKey) return;
    this._tbPending = cacheKey;

    queryTablebase(fen).then(data => {
      if (!data) return;
      this._tbData = data;
      this._tbCacheKey = cacheKey;
      this._tbPending = null;
      this.render(); // Re-render with tablebase data
    });
  }

  _renderTablebaseMoves(state, layout, toPx, r, zoom, sy, tbData) {
    const curPos = layout.get(state.currentNode.id);
    if (!curPos) return;
    const [cx, cy] = toPx(curPos.x, curPos.y);

    const fontSize = Math.max(10, 13 * zoom);
    const ghostR = Math.max(2, r - 2);
    const sx = TREE_SPACING_X * zoom;

    // Sort moves: wins first, then draws, then losses
    const catOrder = { win: 0, 'maybe-win': 1, 'cursed-win': 2, draw: 3, 'blessed-loss': 4, 'maybe-loss': 5, loss: 6 };
    const moves = [...tbData.moves].sort((a, b) => (catOrder[a.category] ?? 3) - (catOrder[b.category] ?? 3));

    // Filter out moves that already exist as real children
    const newMoves = moves.filter(m => !state.currentNode.children.some(c => c.san === m.san));
    if (!newMoves.length) {
      // Still show status label for current position
      this._drawTablebaseStatus(cx, cy, r, zoom, tbData);
      return;
    }

    this._drawTablebaseStatus(cx, cy, r, zoom, tbData);

    // Layout: center ghost nodes under current
    const startOffset = -(newMoves.length - 1) / 2;
    // Offset past any existing children and opening ghosts
    const existingWidth = state.currentNode.children.length;

    for (let i = 0; i < newMoves.length; i++) {
      const m = newMoves[i];
      const gx = cx + (existingWidth + i - (newMoves.length - 1) / 2) * sx;
      const gy = cy + sy;
      const color = categoryColor(m.category);

      // Edge
      const midY = (cy + r + gy - ghostR) / 2;
      const edge = document.createElementNS(SVG_NS, 'path');
      edge.setAttribute('d', `M ${cx},${cy + r} C ${cx},${midY} ${gx},${midY} ${gx},${gy - ghostR}`);
      edge.setAttribute('stroke', color);
      edge.setAttribute('stroke-width', '1.5');
      edge.setAttribute('stroke-dasharray', '4,3');
      edge.setAttribute('fill', 'none');
      edge.setAttribute('opacity', '0.5');
      this.openingsGroup.append(edge);

      // Node circle
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', gx);
      circle.setAttribute('cy', gy);
      circle.setAttribute('r', ghostR);
      circle.setAttribute('fill', color);
      circle.setAttribute('opacity', '0.4');
      circle.setAttribute('stroke', color);
      circle.setAttribute('stroke-width', '1.5');
      this.openingsGroup.append(circle);

      // Move label
      const moveLabel = document.createElementNS(SVG_NS, 'text');
      moveLabel.setAttribute('x', gx + ghostR + 4);
      moveLabel.setAttribute('y', gy + 3);
      moveLabel.setAttribute('fill', color);
      moveLabel.setAttribute('font-size', fontSize + 'px');
      moveLabel.setAttribute('font-family', 'system-ui, sans-serif');
      moveLabel.setAttribute('font-weight', '600');
      moveLabel.setAttribute('opacity', '0.9');
      moveLabel.textContent = m.san;
      this.openingsGroup.append(moveLabel);

      // Tooltip labels — hidden, shown on hover
      const nameEls = [];
      const nameFontSize = fontSize * 0.75;
      const lx = gx + ghostR + 4;
      const ly = gy + ghostR + nameFontSize + 2;

      const catLabel = document.createElementNS(SVG_NS, 'text');
      catLabel.setAttribute('x', lx);
      catLabel.setAttribute('y', ly);
      catLabel.setAttribute('fill', color);
      catLabel.setAttribute('font-size', nameFontSize + 'px');
      catLabel.setAttribute('font-family', 'Inter, system-ui, sans-serif');
      catLabel.setAttribute('font-weight', '600');
      catLabel.setAttribute('opacity', '0');
      catLabel.setAttribute('transform', `rotate(45, ${lx}, ${ly})`);
      catLabel.style.transition = 'opacity 0.15s';
      const dtzText = m.dtz != null ? ` (DTZ ${Math.abs(m.dtz)})` : '';
      catLabel.textContent = categoryLabel(m.category) + dtzText;
      this.tooltipGroup.append(catLabel);
      nameEls.push(catLabel);

      // Hit area
      const hitArea = document.createElementNS(SVG_NS, 'circle');
      hitArea.setAttribute('cx', gx);
      hitArea.setAttribute('cy', gy);
      hitArea.setAttribute('r', Math.max(ghostR + 4, 10));
      hitArea.setAttribute('fill', 'transparent');
      hitArea.setAttribute('cursor', 'pointer');

      hitArea.addEventListener('mouseenter', () => {
        circle.setAttribute('opacity', '0.8');
        for (const el of nameEls) el.setAttribute('opacity', '0.9');
      });
      hitArea.addEventListener('mouseleave', () => {
        circle.setAttribute('opacity', '0.4');
        for (const el of nameEls) el.setAttribute('opacity', '0');
      });

      this.openingsGroup.append(hitArea);
    }
  }

  _drawTablebaseStatus(cx, cy, r, zoom, tbData) {
    const fontSize = Math.max(9, 11 * zoom);
    const color = categoryColor(tbData.category);
    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', cx);
    label.setAttribute('y', cy - r - 6);
    label.setAttribute('fill', color);
    label.setAttribute('font-size', fontSize + 'px');
    label.setAttribute('font-family', 'Inter, system-ui, sans-serif');
    label.setAttribute('font-weight', '600');
    label.setAttribute('text-anchor', 'middle');
    const dtz = tbData.dtz != null ? ` DTZ:${Math.abs(tbData.dtz)}` : '';
    label.textContent = `TB: ${categoryLabel(tbData.category)}${dtz}`;
    this.tooltipGroup.append(label);
  }

  _playOpeningMoves(sanMoves) {
    const state = this.state;
    const chess = state.chess;

    // Reset to starting position
    chess.reset();
    state.treeRoot = new (state.treeRoot.constructor)(chess.fen());
    state.currentNode = state.treeRoot;
    state.invalidateTreeLayout();
    state.treeScrollX = 0;
    state.treeScrollY = 0;

    // Replay each move
    let node = state.treeRoot;
    for (const san of sanMoves) {
      let result;
      try {
        result = chess.move(san);
      } catch {
        break; // Stop if a move fails
      }
      const child = node.addChild(
        { from: result.from, to: result.to, promotion: result.promotion },
        chess.fen(),
        result.san
      );
      node = child;
    }

    state.currentNode = node;
    state.lastMove = node.move;
    state.selectedSq = null;
    state.legalDests = new Set();
    state.gameOver = false;
    state.checkGameOver();
    if (!state.gameOver) {
      const turn = chess.turn() === 'w' ? 'White' : 'Black';
      state.status = `${turn} to move`;
    }
    state.invalidateTreeLayout();
    state.emit('boardChanged');
  }

  _drawEdge(x1, y1, x2, y2, color, width, opacity = 1) {
    const midY = (y1 + y2) / 2;
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', `M ${x1},${y1} C ${x1},${midY} ${x2},${midY} ${x2},${y2}`);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', width);
    path.setAttribute('fill', 'none');
    if (opacity < 1) path.setAttribute('opacity', opacity);
    this.edgesGroup.append(path);
  }
}
