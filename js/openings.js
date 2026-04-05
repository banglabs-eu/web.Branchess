// Known chess openings — name, SAN move sequence, reference URL, stats
// Stats: approximate win/draw/loss % for White from master games
// Longer (more specific) openings should come after their parent

export const OPENINGS = [
  // Italian / Giuoco Piano
  { name: "Italian Game", moves: ["e4","e5","Nf3","Nc6","Bc4"],
    url: "https://en.wikipedia.org/wiki/Italian_Game",
    stats: { w: 40, d: 32, b: 28 } },
  { name: "Giuoco Piano", moves: ["e4","e5","Nf3","Nc6","Bc4","Bc5"],
    url: "https://en.wikipedia.org/wiki/Giuoco_Piano",
    stats: { w: 39, d: 33, b: 28 } },
  { name: "Evans Gambit", moves: ["e4","e5","Nf3","Nc6","Bc4","Bc5","b4"],
    url: "https://en.wikipedia.org/wiki/Evans_Gambit",
    stats: { w: 44, d: 27, b: 29 } },
  { name: "Fried Liver Attack", moves: ["e4","e5","Nf3","Nc6","Bc4","Nf6","Ng5","d5","exd5","Nxd5","Nxf7"],
    url: "https://en.wikipedia.org/wiki/Fried_Liver_Attack",
    stats: { w: 53, d: 18, b: 29 } },
  { name: "Two Knights Defense", moves: ["e4","e5","Nf3","Nc6","Bc4","Nf6"],
    url: "https://en.wikipedia.org/wiki/Two_Knights_Defense",
    stats: { w: 41, d: 30, b: 29 } },

  // Ruy López
  { name: "Ruy López", moves: ["e4","e5","Nf3","Nc6","Bb5"],
    url: "https://en.wikipedia.org/wiki/Ruy_Lopez",
    stats: { w: 38, d: 35, b: 27 } },
  { name: "Ruy López: Berlin Defense", moves: ["e4","e5","Nf3","Nc6","Bb5","Nf6"],
    url: "https://en.wikipedia.org/wiki/Berlin_Defence_(chess)",
    stats: { w: 35, d: 40, b: 25 } },
  { name: "Ruy López: Morphy Defense", moves: ["e4","e5","Nf3","Nc6","Bb5","a6"],
    url: "https://en.wikipedia.org/wiki/Ruy_Lopez#Morphy_Defence",
    stats: { w: 38, d: 34, b: 28 } },
  { name: "Ruy López: Marshall Attack", moves: ["e4","e5","Nf3","Nc6","Bb5","a6","Ba4","Nf6","O-O","Be7","Re1","b5","Bb3","O-O","c3","d5"],
    url: "https://en.wikipedia.org/wiki/Marshall_Attack",
    stats: { w: 30, d: 42, b: 28 } },

  // Scotch
  { name: "Scotch Game", moves: ["e4","e5","Nf3","Nc6","d4"],
    url: "https://en.wikipedia.org/wiki/Scotch_Game",
    stats: { w: 40, d: 32, b: 28 } },

  // Petrov
  { name: "Petrov's Defense", moves: ["e4","e5","Nf3","Nf6"],
    url: "https://en.wikipedia.org/wiki/Petrov%27s_Defence",
    stats: { w: 35, d: 40, b: 25 } },

  // Philidor
  { name: "Philidor Defense", moves: ["e4","e5","Nf3","d6"],
    url: "https://en.wikipedia.org/wiki/Philidor_Defence",
    stats: { w: 44, d: 30, b: 26 } },

  // King's Gambit
  { name: "King's Gambit", moves: ["e4","e5","f4"],
    url: "https://en.wikipedia.org/wiki/King%27s_Gambit",
    stats: { w: 42, d: 26, b: 32 } },
  { name: "King's Gambit Accepted", moves: ["e4","e5","f4","exf4"],
    url: "https://en.wikipedia.org/wiki/King%27s_Gambit#King's_Gambit_Accepted",
    stats: { w: 43, d: 25, b: 32 } },

  // Vienna
  { name: "Vienna Game", moves: ["e4","e5","Nc3"],
    url: "https://en.wikipedia.org/wiki/Vienna_Game",
    stats: { w: 39, d: 31, b: 30 } },

  // Sicilian
  { name: "Sicilian Defense", moves: ["e4","c5"],
    url: "https://en.wikipedia.org/wiki/Sicilian_Defence",
    stats: { w: 37, d: 30, b: 33 } },
  { name: "Sicilian: Open", moves: ["e4","c5","Nf3","d6","d4","cxd4","Nxd4"],
    url: "https://en.wikipedia.org/wiki/Sicilian_Defence#Open_Sicilian",
    stats: { w: 38, d: 29, b: 33 } },
  { name: "Sicilian: Najdorf", moves: ["e4","c5","Nf3","d6","d4","cxd4","Nxd4","Nf6","Nc3","a6"],
    url: "https://en.wikipedia.org/wiki/Sicilian_Defence,_Najdorf_Variation",
    stats: { w: 37, d: 30, b: 33 } },
  { name: "Sicilian: Dragon", moves: ["e4","c5","Nf3","d6","d4","cxd4","Nxd4","Nf6","Nc3","g6"],
    url: "https://en.wikipedia.org/wiki/Sicilian_Defence,_Dragon_Variation",
    stats: { w: 40, d: 27, b: 33 } },
  { name: "Sicilian: Scheveningen", moves: ["e4","c5","Nf3","d6","d4","cxd4","Nxd4","Nf6","Nc3","e6"],
    url: "https://en.wikipedia.org/wiki/Sicilian_Defence,_Scheveningen_Variation",
    stats: { w: 39, d: 30, b: 31 } },
  { name: "Sicilian: Classical", moves: ["e4","c5","Nf3","d6","d4","cxd4","Nxd4","Nf6","Nc3","Nc6"],
    url: "https://en.wikipedia.org/wiki/Sicilian_Defence#Classical_Variation",
    stats: { w: 38, d: 31, b: 31 } },
  { name: "Sicilian: Alapin", moves: ["e4","c5","c3"],
    url: "https://en.wikipedia.org/wiki/Sicilian_Defence,_Alapin_Variation",
    stats: { w: 40, d: 33, b: 27 } },
  { name: "Sicilian: Closed", moves: ["e4","c5","Nc3"],
    url: "https://en.wikipedia.org/wiki/Closed_Sicilian",
    stats: { w: 38, d: 32, b: 30 } },
  { name: "Sicilian: Smith-Morra Gambit", moves: ["e4","c5","d4","cxd4","c3"],
    url: "https://en.wikipedia.org/wiki/Smith%E2%80%93Morra_Gambit",
    stats: { w: 44, d: 25, b: 31 } },

  // French
  { name: "French Defense", moves: ["e4","e6"],
    url: "https://en.wikipedia.org/wiki/French_Defence",
    stats: { w: 38, d: 33, b: 29 } },
  { name: "French: Winawer", moves: ["e4","e6","d4","d5","Nc3","Bb4"],
    url: "https://en.wikipedia.org/wiki/French_Defence#Winawer_Variation",
    stats: { w: 38, d: 31, b: 31 } },
  { name: "French: Tarrasch", moves: ["e4","e6","d4","d5","Nd2"],
    url: "https://en.wikipedia.org/wiki/French_Defence#Tarrasch_Variation",
    stats: { w: 37, d: 35, b: 28 } },
  { name: "French: Advance", moves: ["e4","e6","d4","d5","e5"],
    url: "https://en.wikipedia.org/wiki/French_Defence#Advance_Variation",
    stats: { w: 37, d: 34, b: 29 } },
  { name: "French: Exchange", moves: ["e4","e6","d4","d5","exd5"],
    url: "https://en.wikipedia.org/wiki/French_Defence#Exchange_Variation",
    stats: { w: 36, d: 39, b: 25 } },
  { name: "French: Classical", moves: ["e4","e6","d4","d5","Nc3","Nf6"],
    url: "https://en.wikipedia.org/wiki/French_Defence#Classical_Variation",
    stats: { w: 38, d: 33, b: 29 } },

  // Caro-Kann
  { name: "Caro-Kann Defense", moves: ["e4","c6"],
    url: "https://en.wikipedia.org/wiki/Caro%E2%80%93Kann_Defence",
    stats: { w: 38, d: 35, b: 27 } },
  { name: "Caro-Kann: Advance", moves: ["e4","c6","d4","d5","e5"],
    url: "https://en.wikipedia.org/wiki/Caro%E2%80%93Kann_Defence#Advance_Variation",
    stats: { w: 39, d: 33, b: 28 } },
  { name: "Caro-Kann: Classical", moves: ["e4","c6","d4","d5","Nc3","dxe4","Nxe4","Bf5"],
    url: "https://en.wikipedia.org/wiki/Caro%E2%80%93Kann_Defence#Classical_Variation",
    stats: { w: 36, d: 37, b: 27 } },

  // Pirc / Modern
  { name: "Pirc Defense", moves: ["e4","d6","d4","Nf6","Nc3","g6"],
    url: "https://en.wikipedia.org/wiki/Pirc_Defence",
    stats: { w: 44, d: 28, b: 28 } },
  { name: "Modern Defense", moves: ["e4","g6"],
    url: "https://en.wikipedia.org/wiki/Modern_Defense",
    stats: { w: 46, d: 27, b: 27 } },

  // Scandinavian
  { name: "Scandinavian Defense", moves: ["e4","d5"],
    url: "https://en.wikipedia.org/wiki/Scandinavian_Defense",
    stats: { w: 43, d: 30, b: 27 } },

  // Alekhine
  { name: "Alekhine's Defense", moves: ["e4","Nf6"],
    url: "https://en.wikipedia.org/wiki/Alekhine%27s_Defence",
    stats: { w: 42, d: 30, b: 28 } },

  // Queen's Gambit
  { name: "Queen's Gambit", moves: ["d4","d5","c4"],
    url: "https://en.wikipedia.org/wiki/Queen%27s_Gambit",
    stats: { w: 39, d: 36, b: 25 } },
  { name: "Queen's Gambit Declined", moves: ["d4","d5","c4","e6"],
    url: "https://en.wikipedia.org/wiki/Queen%27s_Gambit_Declined",
    stats: { w: 38, d: 37, b: 25 } },
  { name: "Queen's Gambit Accepted", moves: ["d4","d5","c4","dxc4"],
    url: "https://en.wikipedia.org/wiki/Queen%27s_Gambit_Accepted",
    stats: { w: 40, d: 34, b: 26 } },
  { name: "Slav Defense", moves: ["d4","d5","c4","c6"],
    url: "https://en.wikipedia.org/wiki/Slav_Defense",
    stats: { w: 37, d: 37, b: 26 } },
  { name: "Semi-Slav Defense", moves: ["d4","d5","c4","c6","Nf3","Nf6","Nc3","e6"],
    url: "https://en.wikipedia.org/wiki/Semi-Slav_Defense",
    stats: { w: 36, d: 38, b: 26 } },

  // Indian Defenses
  { name: "King's Indian Defense", moves: ["d4","Nf6","c4","g6","Nc3","Bg7","e4","d6"],
    url: "https://en.wikipedia.org/wiki/King%27s_Indian_Defence",
    stats: { w: 40, d: 30, b: 30 } },
  { name: "Grünfeld Defense", moves: ["d4","Nf6","c4","g6","Nc3","d5"],
    url: "https://en.wikipedia.org/wiki/Gr%C3%BCnfeld_Defence",
    stats: { w: 38, d: 34, b: 28 } },
  { name: "Nimzo-Indian Defense", moves: ["d4","Nf6","c4","e6","Nc3","Bb4"],
    url: "https://en.wikipedia.org/wiki/Nimzo-Indian_Defence",
    stats: { w: 37, d: 36, b: 27 } },
  { name: "Queen's Indian Defense", moves: ["d4","Nf6","c4","e6","Nf3","b6"],
    url: "https://en.wikipedia.org/wiki/Queen%27s_Indian_Defense",
    stats: { w: 38, d: 37, b: 25 } },
  { name: "Bogo-Indian Defense", moves: ["d4","Nf6","c4","e6","Nf3","Bb4+"],
    url: "https://en.wikipedia.org/wiki/Bogo-Indian_Defence",
    stats: { w: 38, d: 37, b: 25 } },
  { name: "Catalan Opening", moves: ["d4","Nf6","c4","e6","g3"],
    url: "https://en.wikipedia.org/wiki/Catalan_Opening",
    stats: { w: 40, d: 36, b: 24 } },

  // Dutch
  { name: "Dutch Defense", moves: ["d4","f5"],
    url: "https://en.wikipedia.org/wiki/Dutch_Defence",
    stats: { w: 42, d: 28, b: 30 } },

  // Benoni
  { name: "Benoni Defense", moves: ["d4","Nf6","c4","c5","d5"],
    url: "https://en.wikipedia.org/wiki/Benoni_Defense",
    stats: { w: 42, d: 28, b: 30 } },

  // English
  { name: "English Opening", moves: ["c4"],
    url: "https://en.wikipedia.org/wiki/English_Opening",
    stats: { w: 37, d: 35, b: 28 } },
  { name: "English: Symmetrical", moves: ["c4","c5"],
    url: "https://en.wikipedia.org/wiki/English_Opening#Symmetrical_Variation",
    stats: { w: 36, d: 37, b: 27 } },
  { name: "English: Reversed Sicilian", moves: ["c4","e5"],
    url: "https://en.wikipedia.org/wiki/English_Opening#Reversed_Sicilian",
    stats: { w: 37, d: 34, b: 29 } },

  // Réti
  { name: "Réti Opening", moves: ["Nf3","d5","c4"],
    url: "https://en.wikipedia.org/wiki/R%C3%A9ti_Opening",
    stats: { w: 38, d: 36, b: 26 } },

  // London
  { name: "London System", moves: ["d4","d5","Nf3","Nf6","Bf4"],
    url: "https://en.wikipedia.org/wiki/London_System",
    stats: { w: 39, d: 35, b: 26 } },
  { name: "London System", moves: ["d4","Nf6","Nf3","d5","Bf4"],
    url: "https://en.wikipedia.org/wiki/London_System",
    stats: { w: 39, d: 35, b: 26 } },

  // Trompowsky
  { name: "Trompowsky Attack", moves: ["d4","Nf6","Bg5"],
    url: "https://en.wikipedia.org/wiki/Trompowsky_Attack",
    stats: { w: 41, d: 31, b: 28 } },

  // Bird
  { name: "Bird's Opening", moves: ["f4"],
    url: "https://en.wikipedia.org/wiki/Bird%27s_Opening",
    stats: { w: 36, d: 28, b: 36 } },

  // Larsen
  { name: "Larsen's Opening", moves: ["b3"],
    url: "https://en.wikipedia.org/wiki/Larsen%27s_Opening",
    stats: { w: 37, d: 30, b: 33 } },

  // Bongcloud
  { name: "Bongcloud Attack", moves: ["e4","e5","Ke2"],
    url: "https://en.wikipedia.org/wiki/Bongcloud_Attack",
    stats: { w: 25, d: 15, b: 60 } },
];
