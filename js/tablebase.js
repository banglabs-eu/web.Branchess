// Syzygy endgame tablebase lookups via Lichess API
// https://tablebase.lichess.ovh/standard?fen=...
// Supports positions with up to 7 pieces

const API_URL = 'https://tablebase.lichess.ovh/standard';
const cache = new Map();

function pieceCount(fen) {
  const board = fen.split(' ')[0];
  return board.replace(/[^a-zA-Z]/g, '').length;
}

export function isTablebasePosition(fen) {
  return pieceCount(fen) <= 7;
}

export async function queryTablebase(fen) {
  const key = fen.split(' ').slice(0, 4).join(' ');
  if (cache.has(key)) return cache.get(key);

  try {
    const url = `${API_URL}?fen=${encodeURIComponent(fen)}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();

    // data has:
    //   category: "win", "loss", "draw", "maybe-win", "maybe-loss", "cursed-win", "blessed-loss"
    //   dtз: distance to zeroing move (negative = opponent wins)
    //   moves: [{uci, san, category, dtz, ...}, ...]
    const result = {
      category: data.category,
      dtz: data.dtz,
      dtm: data.dtm,
      moves: (data.moves || []).map(m => ({
        uci: m.uci,
        san: m.san,
        category: m.category,
        dtz: m.dtz,
        dtm: m.dtm,
      }))
    };

    cache.set(key, result);
    return result;
  } catch {
    return null;
  }
}

// Human-readable category
export function categoryLabel(cat) {
  switch (cat) {
    case 'win': return 'Win';
    case 'loss': return 'Loss';
    case 'draw': return 'Draw';
    case 'maybe-win': return 'Win (50-move)';
    case 'maybe-loss': return 'Loss (50-move)';
    case 'cursed-win': return 'Cursed win';
    case 'blessed-loss': return 'Blessed loss';
    default: return cat || '?';
  }
}

// Color for category
export function categoryColor(cat) {
  if (cat === 'win' || cat === 'maybe-win' || cat === 'cursed-win') return '#4caf50';
  if (cat === 'loss' || cat === 'maybe-loss' || cat === 'blessed-loss') return '#f44336';
  return '#aaa'; // draw
}
