// PHARES.exe — Prediction Markets on Pharos
// All mock data — TODO: fetch from /api/phares/markets

export const TABS = [
  { id: 'markets', label: 'Active Markets', count: 12 },
  { id: 'positions', label: 'My Positions', count: 3 },
  { id: 'resolved', label: 'Resolved', count: null },
  { id: 'leaderboard', label: 'Leaderboard', count: null },
];

export const CATEGORIES = ['all', 'crypto', 'tech', 'economy', 'sports', 'pharos'];

export const CATEGORY_COLORS = {
  crypto: '#d49a2a',
  tech: '#3d7ef5',
  economy: '#8b6cc7',
  sports: '#c96830',
  pharos: '#00c96a',
};

export const OPTION_COLORS = {
  g: '#00c96a',
  r: '#e83e52',
  b: '#3d7ef5',
  o: '#c96830',
  p: '#8b6cc7',
};

export const MARKETS = [
  {
    id: 0,
    category: 'crypto',
    question: 'Will BTC be above $100,000 on March 31?',
    timeLeft: '3d 14h 22m',
    source: 'CoinGecko',
    pool: '14,500 NXT',
    traders: 187,
    options: [
      { name: 'YES', color: 'g', pct: 68, multiplier: 1.47 },
      { name: 'NO', color: 'r', pct: 32, multiplier: 3.13 },
    ],
  },
  {
    id: 1,
    category: 'tech',
    question: 'Will OpenAI launch GPT-5 before June 2026?',
    timeLeft: '28d 6h 41m',
    source: 'Official',
    pool: '8,200 NXT',
    traders: 94,
    options: [
      { name: 'YES', color: 'g', pct: 61, multiplier: 1.64 },
      { name: 'NO', color: 'r', pct: 39, multiplier: 2.56 },
    ],
  },
  {
    id: 2,
    category: 'sports',
    question: 'Boca Juniors vs River Plate — March 15',
    timeLeft: '2d 8h 15m',
    source: 'ESPN',
    pool: '22,100 NXT',
    traders: 312,
    options: [
      { name: 'BOCA', color: 'b', pct: 45, multiplier: 2.22 },
      { name: 'DRAW', color: 'p', pct: 22, multiplier: 4.55 },
      { name: 'RIVER', color: 'o', pct: 33, multiplier: 3.03 },
    ],
  },
  {
    id: 3,
    category: 'economy',
    question: 'Will the Fed cut interest rates at the next FOMC meeting?',
    timeLeft: '11d 2h 30m',
    source: 'Federal Reserve',
    pool: '31,800 NXT',
    traders: 256,
    options: [
      { name: 'YES', color: 'g', pct: 41, multiplier: 2.44 },
      { name: 'NO', color: 'r', pct: 59, multiplier: 1.69 },
    ],
  },
  {
    id: 4,
    category: 'pharos',
    question: 'Will Pharos mainnet launch before April 30, 2026?',
    timeLeft: '24d 18h 5m',
    source: 'Pharos Official',
    pool: '45,600 NXT',
    traders: 518,
    options: [
      { name: 'YES', color: 'g', pct: 73, multiplier: 1.37 },
      { name: 'NO', color: 'r', pct: 27, multiplier: 3.70 },
    ],
  },
];

export const MOCK_POSITIONS = [
  { marketId: 4, side: 'YES', amount: 500, potential: 685, question: 'Pharos mainnet before April 30?' },
  { marketId: 0, side: 'NO', amount: 200, potential: 512, question: 'ETH above $5K in March?' },
  { marketId: 3, side: 'YES', amount: 300, potential: 732, question: 'Fed rate cut next meeting?' },
];

export const MOCK_RESOLVED = [
  {
    id: 100,
    question: 'Will ETH be above $4,000 on March 1?',
    result: 'YES',
    won: true,
    settled: 'March 1, 2026',
    pool: '28,400 NXT',
    winners: 89,
  },
  {
    id: 101,
    question: 'Will Pharos testnet reach 1M transactions?',
    result: 'YES',
    won: true,
    settled: 'Feb 28, 2026',
    pool: '15,200 NXT',
    winners: 134,
  },
  {
    id: 102,
    question: 'Will BTC drop below $80K in February?',
    result: 'NO',
    won: false,
    settled: 'Feb 28, 2026',
    pool: '42,100 NXT',
    winners: 201,
  },
];

export const MOCK_LEADERBOARD = [
  { rank: 1, address: '0x8f3a...d21c', markets: 47, winRate: 72, wagered: '85,400 NXT', pnl: '+12,450 NXT' },
  { rank: 2, address: '0x2b7e...a93f', markets: 38, winRate: 68, wagered: '62,300 NXT', pnl: '+8,920 NXT' },
  { rank: 3, address: '0xd41a...7e28', markets: 52, winRate: 65, wagered: '91,200 NXT', pnl: '+6,310 NXT' },
  { rank: 4, address: '0x19cf...b445', markets: 29, winRate: 62, wagered: '34,800 NXT', pnl: '+4,180 NXT' },
  { rank: 5, address: '0xa62d...1f73', markets: 41, winRate: 59, wagered: '55,600 NXT', pnl: '+3,720 NXT' },
  { rank: 6, address: '0x7c91...e4a2', markets: 33, winRate: 55, wagered: '42,100 NXT', pnl: '+2,890 NXT' },
  { rank: 7, address: '0x3f28...9b7d', markets: 26, winRate: 50, wagered: '28,500 NXT', pnl: '+1,640 NXT' },
  { rank: 8, address: '0xb5e3...2c8f', markets: 44, winRate: 48, wagered: '71,900 NXT', pnl: '+980 NXT' },
  { rank: 9, address: '0x6a4d...f301', markets: 19, winRate: 42, wagered: '15,200 NXT', pnl: '-1,230 NXT' },
  { rank: 10, address: '0xe812...7a5c', markets: 35, winRate: 37, wagered: '48,700 NXT', pnl: '-3,450 NXT' },
];

export const HEADER_METRICS = {
  markets: 12,
  volume: '847,200 NXT',
  traders: '1,243',
};
