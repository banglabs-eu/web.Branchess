// Utility for force-loading board positions that bypass chess.js restrictions
// (multiple kings, pawns on edge rows, etc.)

export function forceLoadBoard(chess, board) {
  const fenRows = [];
  for (const row of board) {
    let fenRow = '';
    let empty = 0;
    for (const cell of row) {
      if (!cell) { empty++; continue; }
      if (empty) { fenRow += empty; empty = 0; }
      fenRow += cell.color === 'w' ? cell.type.toUpperCase() : cell.type;
    }
    if (empty) fenRow += empty;
    fenRows.push(fenRow);
  }
  const fenParts = chess.fen().split(' ');
  fenParts[0] = fenRows.join('/');
  const fen = fenParts.join(' ');

  chess.load(fen, { skipValidation: true });

  // chess.js _put() silently drops duplicate kings.
  // Force-write any missing pieces directly to the internal _board array.
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const wanted = board[r][c];
      if (!wanted) continue;
      const sq = String.fromCharCode(97 + c) + (8 - r);
      const actual = chess.get(sq);
      if (!actual || actual.type !== wanted.type || actual.color !== wanted.color) {
        const ox88 = r * 16 + c;
        chess._board[ox88] = { type: wanted.type, color: wanted.color };
      }
    }
  }

  return fen;
}

export function forceLoadFen(chess, fen) {
  chess.load(fen, { skipValidation: true });

  // Parse the position part to detect dropped pieces
  const position = fen.split(' ')[0];
  const rows = position.split('/');
  for (let r = 0; r < 8; r++) {
    let c = 0;
    for (const ch of rows[r]) {
      if (ch >= '1' && ch <= '8') {
        c += parseInt(ch);
      } else {
        const color = ch < 'a' ? 'w' : 'b';
        const type = ch.toLowerCase();
        const sq = String.fromCharCode(97 + c) + (8 - r);
        const actual = chess.get(sq);
        if (!actual || actual.type !== type || actual.color !== color) {
          const ox88 = r * 16 + c;
          chess._board[ox88] = { type, color };
        }
        c++;
      }
    }
  }
}
