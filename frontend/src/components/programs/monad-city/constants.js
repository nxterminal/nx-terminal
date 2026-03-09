// MONAD_CITY.exe — Isometric blockchain city constants

export const TW = 30, TH = 15, GR = 26, G2 = GR / 2;

export const BUILDING_COLORS = [
  { l: '#120635', r: '#221058', top: '#3820A0', w: '#00F0FF', s: '#00F0FF' },
  { l: '#081A35', r: '#123258', top: '#1E4CA0', w: '#00FF88', s: '#00FF88' },
  { l: '#200830', r: '#401258', top: '#6820A0', w: '#FF9F1C', s: '#FF9F1C' },
  { l: '#161208', r: '#2C2412', top: '#483A20', w: '#FFE066', s: '#FFE066' },
  { l: '#051E1E', r: '#0E3C3C', top: '#1A5858', w: '#00FFCC', s: '#00F0FF' },
  { l: '#240808', r: '#481010', top: '#682222', w: '#FF3366', s: '#FF3366' },
  { l: '#120028', r: '#280050', top: '#400CA0', w: '#B8A9FF', s: '#836EF9' },
  { l: '#0A1420', r: '#162838', top: '#223C50', w: '#88CCFF', s: '#88CCFF' },
  { l: '#141400', r: '#2C2C0A', top: '#444420', w: '#CCFF66', s: '#AADD44' },
  { l: '#1A000A', r: '#340016', top: '#500028', w: '#FF66AA', s: '#FF3388' },
  { l: '#081010', r: '#142020', top: '#203030', w: '#66FFDD', s: '#44DDBB' },
  { l: '#0C0818', r: '#1A1030', top: '#2A1A4A', w: '#AA88FF', s: '#8866DD' },
];

export const WT_BEAR = [
  { n: 'STORM', i: '\u26A1', r: 1, l: true, fog: .35, wind: 2.5 },
  { n: 'THUNDER', i: '\uD83C\uDF29', r: .8, l: true, fog: .25, wind: 2 },
  { n: 'BLIZZARD', i: '\uD83C\uDF28', r: .1, l: true, fog: .5, wind: 3, snow: true },
  { n: 'DOWNPOUR', i: '\uD83C\uDF27', r: .9, l: false, fog: .3, wind: 2.2 },
  { n: 'ACID RAIN', i: '\u2622', r: .7, l: false, fog: .4, wind: 1.5, acid: true },
  { n: 'FOG', i: '\uD83C\uDF2B', r: .02, l: false, fog: .7, wind: .1 },
];

export const WT_BULL = [
  { n: 'CLEAR', i: '\u2600', r: 0, l: false, fog: 0, wind: .1 },
  { n: 'AURORA', i: '\uD83C\uDF0C', r: 0, l: false, fog: 0, wind: 0, aurora: true },
  { n: 'GOLDEN', i: '\u2728', r: 0, l: false, fog: 0, wind: .05, golden: true },
  { n: 'STARLIGHT', i: '\uD83C\uDF1F', r: 0, l: false, fog: 0, wind: .08, stars: true },
  { n: 'SUNRISE', i: '\uD83C\uDF05', r: 0, l: false, fog: 0, wind: .1, sunrise: true },
];

export const WT_NEUT = [
  { n: 'RAIN', i: '\uD83C\uDF27', r: .4, l: false, fog: .1, wind: .8 },
  { n: 'DRIZZLE', i: '\uD83C\uDF26', r: .15, l: false, fog: .05, wind: .4 },
  { n: 'HAZE', i: '\uD83C\uDF2B', r: .02, l: false, fog: .35, wind: .1 },
  { n: 'SNOW', i: '\u2744', r: 0, l: false, fog: .08, wind: .5, snow: true },
  { n: 'OVERCAST', i: '\u2601', r: .05, l: false, fog: .15, wind: .3 },
  { n: 'WINDY', i: '\uD83D\uDCA8', r: .08, l: false, fog: .05, wind: 2.8 },
];

export const EVENT_TYPES = [
  { d: 'w', t: 'WHALE_ALERT', c: '#FF9F1C' },
  { d: 't', t: 'LARGE_TX', c: '#00F0FF' },
  { d: 'g', t: 'GAS_SPIKE', c: '#FF3366' },
  { d: 'g', t: 'LIQUIDATION', c: '#FF3366' },
  { d: 'p', t: 'PROTOCOL', c: '#B8A9FF' },
  { d: 'n', t: 'NEW_DEPLOY', c: '#00FF88' },
  { d: 'p', t: 'BRIDGE_TX', c: '#836EF9' },
  { d: 'n', t: 'AAVE_VOTE', c: '#00FF88' },
  { d: 'w', t: 'FLASH_LOAN', c: '#FF9F1C' },
  { d: 't', t: 'CBBTC_BRIDGE', c: '#00F0FF' },
  { d: 'n', t: 'NFT_MINT', c: '#00FF88' },
];

export const PROTOCOLS = [
  'Aave', 'Uniswap', 'Balancer', 'Chainlink', 'Circle', 'Backpack',
  'Curvance', 'Kuru', 'Ambient', 'Pyth', 'LayerZero', 'Wormhole',
  'aPriori', 'Kintsu', 'Magma',
];

export const SIGN_NAMES = [
  'MON', 'DEFI', 'GMX', 'AAVE', 'UNI', 'LIDO', 'PYTH',
  'KURU', 'LINK', 'ZK', 'NFT', 'DAO', 'APR', 'ETH',
];

export const CAR_COLORS = [
  '#FF3366', '#00F0FF', '#FFE066', '#00FF88', '#FF9F1C', '#836EF9',
  '#FFF', '#88CCFF', '#FF66AA', '#AAFF66', '#6666FF', '#DD8844',
  '#FF8800', '#44DDFF',
];

export const SKIN_COLORS = ['#FFD4A0', '#C8A070', '#906040', '#FFE0C0', '#B08060', '#E8C8A0'];
export const SHIRT_COLORS = [
  '#FF3366', '#00F0FF', '#FFE066', '#00FF88', '#836EF9', '#FF9F1C',
  '#FFF', '#4488FF', '#FF88AA', '#88FF88', '#AA66FF', '#FF6600',
];

export const DISTRICTS = [
  { id: 'map', label: 'MAP', cls: '' },
  { id: 'defi', label: 'DeFi District', cls: 'df', gxRange: [1, 8], gyRange: [1, 8] },
  { id: 'lending', label: 'Lending Quarter', cls: 'ln', gxRange: [1, 8], gyRange: [9, 16] },
  { id: 'derivatives', label: 'Derivatives Row', cls: 'dv', gxRange: [9, 16], gyRange: [1, 8] },
  { id: 'options', label: 'Options Alley', cls: 'op', gxRange: [9, 16], gyRange: [9, 16] },
  { id: 'yield', label: 'Yield Gardens', cls: '', gxRange: [17, 25], gyRange: [1, 8] },
  { id: 'bridge', label: 'Bridge District', cls: 'br', gxRange: [17, 25], gyRange: [9, 16] },
  { id: 'nft', label: 'NFT & Gaming', cls: 'nf', gxRange: [1, 8], gyRange: [17, 25] },
  { id: 'infra', label: 'Infra Hub', cls: '', gxRange: [9, 16], gyRange: [17, 25] },
  { id: 'parallel', label: 'Parallel Lane', cls: '', gxRange: [17, 25], gyRange: [17, 25] },
  { id: 'staking', label: 'Staking Heights', cls: '', gxRange: [1, 12], gyRange: [10, 14] },
  { id: 'social', label: 'Social Hub', cls: '', gxRange: [14, 25], gyRange: [10, 14] },
  { id: 'ai', label: 'AI Analytics', cls: '', gxRange: [10, 16], gyRange: [4, 10] },
  { id: 'perps', label: 'Perps Row', cls: '', gxRange: [10, 16], gyRange: [16, 22] },
];

export const FOOTER_BRANDS = [
  { name: 'MONAD', color: '#836EF9' },
  { name: 'DUNE', color: '#00F0FF' },
  { name: 'LAYERZERO', color: '#B8A9FF' },
  { name: 'PYTH', color: '#FF9F1C' },
  { name: 'WORMHOLE', color: '#00FF88' },
  { name: 'CHAINLINK', color: '#FF3366' },
];

// Generate city layout grid
export function generateLayout() {
  const L = [];
  for (let y = 0; y < GR; y++) {
    L[y] = [];
    for (let x = 0; x < GR; x++) {
      L[y][x] = (x % 3 === 0 || y % 3 === 0) ? 1 : 0;
    }
  }
  // Parks
  [[1,1],[1,2],[2,1],[2,2],[7,16],[7,17],[8,16],[8,17],[22,4],[22,5],[23,4],[23,5],
   [4,22],[5,22],[4,23],[5,23],[13,1],[13,2],[14,1],[14,2],[1,13],[2,13],[1,14],[2,14],
   [19,19],[19,20],[20,19],[20,20],[10,7],[10,8],[11,7],[11,8]].forEach(([y, x]) => {
    if (y < GR && x < GR) L[y][x] = 2;
  });
  // Plazas
  [[12,12],[12,13],[13,12],[13,13],[6,6],[6,7],[7,6],[7,7],[18,18],[18,19],[19,18],[19,19],
   [4,10],[4,11],[5,10],[5,11],[16,4],[16,5],[17,4],[17,5],[10,19],[10,20],[11,19],[11,20]].forEach(([y, x]) => {
    if (y < GR && x < GR) L[y][x] = 3;
  });
  // Water
  [[1,23],[1,24],[2,23],[2,24],[23,1],[23,2],[24,1],[24,2],[13,24],[13,25],[14,24],[14,25]].forEach(([y, x]) => {
    if (y < GR && x < GR) L[y][x] = 4;
  });
  return L;
}

export function pickWeather(sentiment) {
  if (sentiment > 50) return WT_BULL[Math.floor(Math.random() * WT_BULL.length)];
  if (sentiment < 35) return WT_BEAR[Math.floor(Math.random() * WT_BEAR.length)];
  return WT_NEUT[Math.floor(Math.random() * WT_NEUT.length)];
}
