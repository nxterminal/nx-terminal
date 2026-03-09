// CHOGPET.exe — Desktop Pet Constants
// Monad ecosystem mascots: Chog (frog), Molandak (mole), Moyaki (firebird)

// 8x8 pixel art sprite data
// Each frame is an 8x8 array where each value is a color key or null (transparent)
// Color keys map to the pet's color palette

const CHOG_SPRITES = {
  idle: [
    [null, null, 'g',  'g',  'g',  'g',  null, null],
    [null, 'g',  'W',  'g',  'g',  'W',  'g',  null],
    [null, 'g',  'W',  'B',  'B',  'W',  'g',  null],
    ['g',  'g',  'g',  'g',  'g',  'g',  'g',  'g' ],
    ['g',  'l',  'l',  'g',  'g',  'l',  'l',  'g' ],
    [null, 'g',  'g',  'p',  'p',  'g',  'g',  null],
    [null, null, 'g',  'g',  'g',  'g',  null, null],
    [null, 'd',  'd',  null, null, 'd',  'd',  null],
  ],
  blink: [
    [null, null, 'g',  'g',  'g',  'g',  null, null],
    [null, 'g',  'g',  'g',  'g',  'g',  'g',  null],
    [null, 'g',  'B',  'B',  'B',  'B',  'g',  null],
    ['g',  'g',  'g',  'g',  'g',  'g',  'g',  'g' ],
    ['g',  'l',  'l',  'g',  'g',  'l',  'l',  'g' ],
    [null, 'g',  'g',  'p',  'p',  'g',  'g',  null],
    [null, null, 'g',  'g',  'g',  'g',  null, null],
    [null, 'd',  'd',  null, null, 'd',  'd',  null],
  ],
  happy: [
    [null, null, 'g',  'g',  'g',  'g',  null, null],
    [null, 'g',  'W',  'g',  'g',  'W',  'g',  null],
    [null, 'g',  'W',  'B',  'B',  'W',  'g',  null],
    ['g',  'g',  'g',  'g',  'g',  'g',  'g',  'g' ],
    ['g',  'l',  'p',  'p',  'p',  'p',  'l',  'g' ],
    [null, 'g',  'g',  'g',  'g',  'g',  'g',  null],
    [null, null, 'g',  'g',  'g',  'g',  null, null],
    [null, 'd',  'd',  null, null, 'd',  'd',  null],
  ],
  sad: [
    [null, null, 'g',  'g',  'g',  'g',  null, null],
    [null, 'g',  'g',  'g',  'g',  'g',  'g',  null],
    [null, 'g',  'B',  'g',  'g',  'B',  'g',  null],
    ['g',  'g',  'g',  'g',  'g',  'g',  'g',  'g' ],
    ['g',  'l',  'l',  'g',  'g',  'l',  'l',  'g' ],
    [null, 'g',  'g',  'g',  'g',  'g',  'g',  null],
    [null, null, 'g',  'g',  'g',  'g',  null, null],
    [null, 'd',  null, 'd',  'd',  null, 'd',  null],
  ],
  eating: [
    [null, null, 'g',  'g',  'g',  'g',  null, null],
    [null, 'g',  'W',  'g',  'g',  'W',  'g',  null],
    [null, 'g',  'W',  'B',  'B',  'W',  'g',  null],
    ['g',  'g',  'g',  'g',  'g',  'g',  'g',  'g' ],
    ['g',  'l',  'p',  'p',  'p',  'p',  'l',  'g' ],
    [null, 'g',  'p',  'p',  'p',  'p',  'g',  null],
    [null, null, 'g',  'g',  'g',  'g',  null, null],
    [null, 'd',  'd',  null, null, 'd',  'd',  null],
  ],
};

const MOLANDAK_SPRITES = {
  idle: [
    [null, null, 'b',  'b',  'b',  'b',  null, null],
    [null, 'b',  'W',  'b',  'b',  'W',  'b',  null],
    [null, 'b',  'W',  'B',  'B',  'W',  'b',  null],
    ['b',  'b',  'p',  'b',  'b',  'p',  'b',  'b' ],
    ['b',  'b',  'b',  'b',  'b',  'b',  'b',  'b' ],
    [null, 'b',  'b',  'd',  'd',  'b',  'b',  null],
    [null, 'c',  'b',  'b',  'b',  'b',  'c',  null],
    [null, 'c',  'c',  null, null, 'c',  'c',  null],
  ],
  blink: [
    [null, null, 'b',  'b',  'b',  'b',  null, null],
    [null, 'b',  'b',  'b',  'b',  'b',  'b',  null],
    [null, 'b',  'B',  'B',  'B',  'B',  'b',  null],
    ['b',  'b',  'p',  'b',  'b',  'p',  'b',  'b' ],
    ['b',  'b',  'b',  'b',  'b',  'b',  'b',  'b' ],
    [null, 'b',  'b',  'd',  'd',  'b',  'b',  null],
    [null, 'c',  'b',  'b',  'b',  'b',  'c',  null],
    [null, 'c',  'c',  null, null, 'c',  'c',  null],
  ],
  happy: [
    [null, null, 'b',  'b',  'b',  'b',  null, null],
    [null, 'b',  'W',  'b',  'b',  'W',  'b',  null],
    [null, 'b',  'W',  'B',  'B',  'W',  'b',  null],
    ['b',  'b',  'p',  'b',  'b',  'p',  'b',  'b' ],
    ['b',  'b',  'p',  'p',  'p',  'p',  'b',  'b' ],
    [null, 'b',  'b',  'b',  'b',  'b',  'b',  null],
    [null, 'c',  'b',  'b',  'b',  'b',  'c',  null],
    [null, 'c',  'c',  null, null, 'c',  'c',  null],
  ],
  sad: [
    [null, null, 'b',  'b',  'b',  'b',  null, null],
    [null, 'b',  'b',  'b',  'b',  'b',  'b',  null],
    [null, 'b',  'B',  'b',  'b',  'B',  'b',  null],
    ['b',  'b',  'p',  'b',  'b',  'p',  'b',  'b' ],
    ['b',  'b',  'b',  'b',  'b',  'b',  'b',  'b' ],
    [null, 'b',  'b',  'd',  'd',  'b',  'b',  null],
    [null, 'c',  'b',  'b',  'b',  'b',  'c',  null],
    [null, null, 'c',  null, null, 'c',  null, null],
  ],
  eating: [
    [null, null, 'b',  'b',  'b',  'b',  null, null],
    [null, 'b',  'W',  'b',  'b',  'W',  'b',  null],
    [null, 'b',  'W',  'B',  'B',  'W',  'b',  null],
    ['b',  'b',  'p',  'b',  'b',  'p',  'b',  'b' ],
    ['b',  'b',  'p',  'p',  'p',  'p',  'b',  'b' ],
    [null, 'b',  'p',  'p',  'p',  'p',  'b',  null],
    [null, 'c',  'b',  'b',  'b',  'b',  'c',  null],
    [null, 'c',  'c',  null, null, 'c',  'c',  null],
  ],
};

const MOYAKI_SPRITES = {
  idle: [
    [null, null, null, 'o',  'o',  null, null, null],
    [null, null, 'o',  'y',  'y',  'o',  null, null],
    [null, 'o',  'W',  'B',  'B',  'W',  'o',  null],
    ['w',  'o',  'o',  'o',  'o',  'o',  'o',  'w' ],
    [null, 'w',  'o',  'y',  'y',  'o',  'w',  null],
    [null, null, 'o',  'o',  'o',  'o',  null, null],
    [null, null, 'y',  null, null, 'y',  null, null],
    [null, 'r',  'o',  null, null, 'o',  'r',  null],
  ],
  blink: [
    [null, null, null, 'o',  'o',  null, null, null],
    [null, null, 'o',  'y',  'y',  'o',  null, null],
    [null, 'o',  'o',  'B',  'B',  'o',  'o',  null],
    ['w',  'o',  'o',  'o',  'o',  'o',  'o',  'w' ],
    [null, 'w',  'o',  'y',  'y',  'o',  'w',  null],
    [null, null, 'o',  'o',  'o',  'o',  null, null],
    [null, null, 'y',  null, null, 'y',  null, null],
    [null, 'r',  'o',  null, null, 'o',  'r',  null],
  ],
  happy: [
    [null, null, null, 'o',  'o',  null, null, null],
    [null, null, 'o',  'y',  'y',  'o',  null, null],
    [null, 'o',  'W',  'B',  'B',  'W',  'o',  null],
    ['w',  'o',  'o',  'o',  'o',  'o',  'o',  'w' ],
    ['w',  'w',  'o',  'y',  'y',  'o',  'w',  'w' ],
    [null, null, 'o',  'o',  'o',  'o',  null, null],
    [null, null, 'y',  null, null, 'y',  null, null],
    [null, 'r',  'o',  null, null, 'o',  'r',  null],
  ],
  sad: [
    [null, null, null, 'o',  'o',  null, null, null],
    [null, null, 'o',  'o',  'o',  'o',  null, null],
    [null, 'o',  'B',  'o',  'o',  'B',  'o',  null],
    [null, 'o',  'o',  'o',  'o',  'o',  'o',  null],
    [null, null, 'o',  'o',  'o',  'o',  null, null],
    [null, null, 'o',  'o',  'o',  'o',  null, null],
    [null, null, 'y',  null, null, 'y',  null, null],
    [null, null, 'o',  null, null, 'o',  null, null],
  ],
  eating: [
    [null, null, null, 'o',  'o',  null, null, null],
    [null, null, 'o',  'y',  'y',  'o',  null, null],
    [null, 'o',  'W',  'B',  'B',  'W',  'o',  null],
    ['w',  'o',  'o',  'o',  'o',  'o',  'o',  'w' ],
    [null, 'w',  'o',  'r',  'r',  'o',  'w',  null],
    [null, null, 'o',  'r',  'r',  'o',  null, null],
    [null, null, 'y',  null, null, 'y',  null, null],
    [null, 'r',  'o',  null, null, 'o',  'r',  null],
  ],
};

export const PET_TYPES = {
  chog: {
    name: 'Chog',
    icon: '\u{1F438}',
    description: 'A mysterious frog from the Monad swamps. Loves parallel execution.',
    colors: {
      g: '#30FF60',  // green body
      d: '#1a8a35',  // dark green (feet/accents)
      l: '#7aff9a',  // light green (belly)
      p: '#7B2FBE',  // purple (mouth/accents)
      B: '#000000',  // black (pupils)
      W: '#FFFFFF',  // white (eyes)
    },
    sprites: CHOG_SPRITES,
  },
  molandak: {
    name: 'Molandak',
    icon: '\u{1F9A1}',
    description: 'A determined mole-badger. Digs through blocks at 400ms speed.',
    colors: {
      b: '#8B6914',  // brown body
      d: '#5c4a1a',  // dark brown
      c: '#6b5210',  // claws
      p: '#7B2FBE',  // purple (nose stripes)
      B: '#000000',  // black (pupils)
      W: '#FFFFFF',  // white (eyes)
    },
    sprites: MOLANDAK_SPRITES,
  },
  moyaki: {
    name: 'Moyaki',
    icon: '\u{1F525}',
    description: 'A blazing firebird. Burns through transactions with parallel flames.',
    colors: {
      o: '#FF6600',  // orange body
      y: '#FFD700',  // yellow (highlights)
      r: '#FF3333',  // red (fire tail)
      w: '#FF9944',  // warm orange (wings)
      B: '#000000',  // black (pupils)
      W: '#FFFFFF',  // white (eyes)
    },
    sprites: MOYAKI_SPRITES,
  },
};

export const LEVELS = [
  { name: 'BABY',   xpRequired: 0,    spriteSize: 48 },
  { name: 'YOUNG',  xpRequired: 100,  spriteSize: 56 },
  { name: 'TEEN',   xpRequired: 300,  spriteSize: 64 },
  { name: 'ADULT',  xpRequired: 600,  spriteSize: 64 },
  { name: 'ELDER',  xpRequired: 1000, spriteSize: 64 },
];

export const HUNGER_DECAY_MS = 60000;     // -1 hunger per minute
export const HAPPINESS_DECAY_MS = 120000; // -0.5 happiness per 2 min
export const TIP_INTERVAL_MIN = 45000;
export const TIP_INTERVAL_MAX = 60000;
export const WALK_INTERVAL_MIN = 8000;
export const WALK_INTERVAL_MAX = 15000;
export const BLINK_INTERVAL = 3000;
export const FEED_XP = 5;
export const PET_XP = 1;
export const TIP_XP = 2;
export const FEED_HUNGER = 25;
export const PET_HAPPINESS = 10;
export const BUBBLE_DURATION = 8000;

export const MONAD_TIPS = [
  "Did you know? Monad processes transactions in parallel across multiple execution lanes!",
  "MON is the native gas token of Monad. Block time: just 400ms!",
  "MonadBFT uses a 4-stage pipeline: PROPOSE \u2192 VOTE \u2192 FINALIZE \u2192 EXECUTE",
  "Monad achieves ~10,000 TPS through optimistic parallel execution!",
  "Chain ID 143 \u2014 Monad Mainnet is fully EVM-compatible!",
  "Monad uses optimistic concurrency: execute in parallel, detect conflicts, re-execute if needed.",
  "MonadDb is a custom state database optimized for parallel read/write access.",
  "Monad's finality is ~800ms \u2014 approximately 2 block times!",
  "Transactions on Monad are grouped into blocks every 400ms. That's fast!",
  "Monad validators run MonadBFT consensus \u2014 a pipelined HotStuff variant.",
  "RaptorCast is Monad's block propagation protocol for fast data availability.",
  "Deferred execution means consensus and execution happen in different stages on Monad.",
  "Monad supports ~175 validators in the active set. Decentralized AND fast!",
  "Smart contracts on Monad work just like on Ethereum \u2014 deploy your Solidity code directly!",
  "Parallel execution doesn't change smart contract semantics \u2014 same results, faster processing.",
  "Monad's gas limit per block is 150M \u2014 enabling high-throughput applications.",
  "The Monad ecosystem includes Chog, Molandak, and Moyaki \u2014 the community mascots!",
];

export const DEFAULT_PET_STATE = {
  petType: 'chog',
  name: 'Chog',
  hunger: 80,
  happiness: 80,
  xp: 0,
  isActive: true,
  helperMode: true,
  position: { x: 200, y: null },
  lastFed: Date.now(),
  lastInteraction: Date.now(),
};

export function getLevel(xp) {
  let level = LEVELS[0];
  for (const l of LEVELS) {
    if (xp >= l.xpRequired) level = l;
    else break;
  }
  return level;
}

export function getNextLevel(xp) {
  for (const l of LEVELS) {
    if (xp < l.xpRequired) return l;
  }
  return null;
}
