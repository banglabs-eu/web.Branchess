# Branchess (Web)

Web version of Branchess — a chess analysis tool built around a branching game tree. Play against Stockfish 18, explore opening theory, annotate moves, and study endgames.

**[Play online](https://play.branchess.bang-labs.eu)** | **[Website](https://branchess.bang-labs.eu)**

## Run locally

```bash
python3 -m http.server 8080
# Open http://localhost:8080
```

No build step. Pure HTML/CSS/JS.

## Features

### Board
- Click-to-move and drag-and-drop
- Free piece placement (illegal moves allowed for analysis)
- Flip board to play as black
- 2P versus mode (90-degree rotated board for two humans side-by-side)
- Setup mode for custom positions
- PGN import via clipboard

### Branching game tree
- Every move creates a branch — navigate freely between variations
- Fullscreen tree mode (double-click empty space) with floating draggable board
- Zoom (scroll wheel, +/- buttons) and pan (drag in fullscreen)
- Click any node to jump to that position

### Opening book
- 60+ openings with full continuation trees shown as ghost branches
- Win/draw/loss percentages from master games (hover to see)
- Click ghost nodes to jump to any opening position
- Opening names link to Wikipedia
- Covers Italian, Ruy Lopez, Sicilian (Najdorf, Dragon, etc.), French, Caro-Kann, Queen's Gambit, Indian defenses, English, London, and more

### Move annotations
- Right-click a node to annotate: ! (good), !! (brilliant), !? (interesting), ?! (dubious), ? (mistake), ?? (blunder)
- Nodes change color to match the annotation
- Double-click a node to write free-form notes (yellow dot indicator)

### Syzygy endgame tablebases
- Activates automatically when 7 or fewer pieces remain
- Shows win/draw/loss evaluation with DTZ (distance to zeroing)
- All possible moves displayed as color-coded ghost branches
- Powered by the Lichess Syzygy API

### Engine
- Stockfish 18 WASM (runs in browser, no server needed)
- Strength slider from beginner (~400 ELO) to full power (~3500 ELO)
- Stochastic move selection from top 5 lines (weighted by score)
- Engine auto-responds after your moves (click a piece to interrupt and play manually)
- Request engine move with spacebar

### Persistence and sharing
- Save/load positions (IndexedDB, browser-local)
- Share position via URL (`?fen=...` parameter, copied to clipboard)
- Export game tree as Mermaid `.mmd` file

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| Left / Right | Navigate back / forward (single ply) |
| Up / Down | Switch between branches at a fork |
| Space | Request engine move |
| U | Undo |
| F | Flip board |
| N | New game |
| H | Toggle move highlights |
| E | Toggle setup mode |
| Ctrl+S | Save position |
| Ctrl+L | Load position |
| Ctrl+V | Paste PGN |

## Architecture

```
index.html          Entry point
css/main.css        Layout, dark theme, board
css/tree.css        Tree SVG styles, zoom controls, annotation menu
css/dialogs.css     Promotion, save/load, note editor dialogs
js/main.js          Wires everything together, keyboard shortcuts
js/constants.js     Colors, Unicode map, layout defaults
js/state.js         GameState + EventEmitter
js/game-tree.js     GameNode class + tree layout algorithm
js/board.js         8x8 CSS grid board rendering (normal, flipped, versus)
js/moves.js         Click-to-move, drag-and-drop, promotion, engine triggering
js/engine.js        StochasticEngine (wraps Stockfish worker, softmax, cache)
js/stockfish-worker.js  Web Worker loading Stockfish WASM
js/tree-view.js     SVG tree visualization, opening book, tablebases, annotations
js/animation.js     CSS transition piece slides
js/setup.js         Setup mode: piece palette, castling inference
js/persistence.js   IndexedDB save/load + dialogs
js/ui-panel.js      Side panel: buttons, slider, move list, share, export
js/openings.js      Opening book database with move sequences and stats
js/tablebase.js     Syzygy tablebase lookups via Lichess API
lib/chess.js        Vendored chess.js (ESM)
lib/stockfish/      Vendored Stockfish 18 lite WASM (single-threaded)
```

## Credits

- [chess.js](https://github.com/jhlywa/chess.js) for move generation and validation
- [Stockfish](https://stockfishchess.org/) via [stockfish.js](https://github.com/nicfab/stockfish.wasm)
- [Lichess Syzygy API](https://tablebase.lichess.ovh) for endgame tablebases
- Built by [Bang Labs](https://bang-labs.eu)
