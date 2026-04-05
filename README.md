# Branchess

A chess analysis tool built around a branching game tree. Play against Stockfish 18, explore opening theory, annotate moves, and study endgames — entirely in your browser.

**[Play online](https://play-branchess.bang-labs.eu)** | **[Website](https://branchess.bang-labs.eu)**

## Run locally

```bash
python3 -m http.server 8080
```

No build step. Pure HTML/CSS/JS.

## Features

### Board
- Click-to-move and drag-and-drop
- Free piece placement — move any piece anywhere for analysis
- Flip board to play as black
- 2P versus mode — board rotated 90 degrees, white left / black right, flip to swap sides
- Setup mode for custom positions
- Board labels (A-H files, 1-8 ranks) outside the board
- Responsive layout — board always square, side panel always at least 1/3 of viewport

### Branching game tree
- Every move creates a branch — navigate freely between variations
- Fullscreen tree mode (double-click empty space) with floating draggable board
- Zoom with scroll wheel or +/- buttons, pan by dragging in fullscreen
- Click any node to jump to that position
- Single-ply back/forward navigation

### Opening book (171 openings)
- Full continuation trees shown as ghost branches from the current position
- Win/draw/loss percentages from master games on hover
- Click ghost nodes to jump to any opening position
- Opening names link to Wikipedia
- Covers all major systems: Italian, Ruy Lopez, Sicilian (Najdorf, Dragon, Sveshnikov, etc.), French, Caro-Kann, Queen's Gambit, Slav, Semi-Slav, King's Indian, Grünfeld, Nimzo-Indian, Catalan, English, Réti, London, and many more

### Move annotations
- Right-click a node to choose: ! (good), !! (brilliant), !? (interesting), ?! (dubious), ? (mistake), ?? (blunder)
- Nodes change color: green, blue, orange, yellow, red, purple
- Double-click a node to write free-form notes (yellow dot indicator)

### Syzygy endgame tablebases
- Activates automatically at 7 or fewer pieces
- Shows win/draw/loss evaluation with DTZ (distance to zeroing)
- All possible moves displayed as color-coded ghost branches
- Powered by the Lichess Syzygy API

### Engine
- Stockfish 18 WASM (runs in browser, no server needed)
- Strength slider showing actual parameters: Skill Level (0-20), think time, temperature
- Blue-to-red slider color indicating difficulty
- Engine auto-responds after your moves — click a piece to interrupt and play manually
- Request engine move with spacebar or Engine Move button
- **Pause Engine** — disable auto-responses to play both sides manually (e.g., to recreate a game from chess.com)
- **Show Best Move** — full-strength analysis highlights the top move on the board with evaluation score

### Game input
- **Type moves** — double-click the move list to type moves in SAN notation (e.g., e4, Nf3, O-O). Real-time validation highlights invalid moves in red.
- **Import from Lichess** — paste any Lichess game URL or ID to load the full game
- **PGN import** via clipboard

### Persistence and sharing
- Save/load positions (IndexedDB, browser-local)
- **Save/load full games** with all branches, annotations, and notes (IndexedDB)
- Share position via URL (`?fen=...` parameter, copied to clipboard)
- **Export/import Mermaid** — round-trip game trees as `.mmd` files with embedded metadata. Notes appear as separate boxes in the diagram.

### Themes
- **Classic** — traditional chess.com-style brown board
- **Bang Labs** — dark indigo/cyan theme matching bang-labs.eu branding, with themed tree colors and fireworks effects on checkmate wins

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
| Ctrl+V | Paste PGN |
| Right-click node | Annotate move |
| Double-click node | Write notes |
| Scroll wheel (tree) | Zoom |

## Architecture

```
index.html          Entry point
css/main.css        Layout, themes (classic + Bang Labs), board
css/tree.css        Tree SVG styles, zoom controls, annotation menu
css/dialogs.css     Promotion, save/load, note editor dialogs
js/main.js          Wires everything together, keyboard shortcuts, URL sharing
js/constants.js     Colors, Unicode map, layout defaults
js/state.js         GameState + EventEmitter
js/game-tree.js     GameNode class (with annotation/note fields) + tree layout
js/board.js         8x8 CSS grid rendering (normal, flipped, versus modes)
js/moves.js         Click-to-move, drag-and-drop, illegal moves, en passant
js/engine.js        StochasticEngine (Stockfish worker, softmax, cache)
js/stockfish-worker.js  Web Worker loading Stockfish WASM
js/tree-view.js     SVG tree, opening book, tablebases, annotations, fullscreen
js/animation.js     CSS transition piece slides
js/setup.js         Setup mode: piece palette, castling inference
js/persistence.js   IndexedDB save/load + dialogs
js/ui-panel.js      Side panel: buttons, slider, move list, share, export, Lichess import
js/bang.js          Fireworks particle effect + synthesized thunder (Bang Labs theme)
js/openings.js      171 openings with move sequences and win/draw/loss stats
js/tablebase.js     Syzygy tablebase lookups via Lichess API
lib/chess.js        Vendored chess.js (ESM)
lib/stockfish/      Vendored Stockfish 18 lite WASM (single-threaded)
favicon.svg         Pawn favicon
```

## Credits

- [chess.js](https://github.com/jhlywa/chess.js) for move generation and validation
- [Stockfish](https://stockfishchess.org/) via [stockfish.js](https://github.com/nicfab/stockfish.wasm)
- [Lichess Syzygy API](https://tablebase.lichess.ovh) for endgame tablebases
- Built by [Bang Labs](https://bang-labs.eu)
