// MONADGOTCHI.exe — Desktop Pet Constants
// Monad ecosystem mascots: Chog (frog), Molandak (mole), Moyaki (firebird)

// 12x12 pixel art sprite data
// Each frame is a 12x12 array where each value is a color key or null (transparent)
// Color keys map to the pet's color palette

const CHOG_SPRITES = {
  idle: [
    [null, null, null, 'g',  'g',  'g',  'g',  'g',  'g',  null, null, null],
    [null, null, 'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  null, null],
    [null, 'g',  'g',  'W',  'W',  'g',  'g',  'W',  'W',  'g',  'g',  null],
    [null, 'g',  'g',  'W',  'B',  'g',  'g',  'W',  'B',  'g',  'g',  null],
    ['g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g' ],
    ['g',  'g',  'l',  'l',  'l',  'g',  'g',  'l',  'l',  'l',  'g',  'g' ],
    ['g',  'g',  'l',  'l',  'l',  'g',  'g',  'l',  'l',  'l',  'g',  'g' ],
    [null, 'g',  'g',  'g',  'p',  'p',  'p',  'p',  'g',  'g',  'g',  null],
    [null, 'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  null],
    [null, null, 'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  null, null],
    [null, 'd',  'd',  'd',  null, null, null, null, 'd',  'd',  'd',  null],
    [null, 'd',  null, 'd',  null, null, null, null, 'd',  null, 'd',  null],
  ],
  blink: [
    [null, null, null, 'g',  'g',  'g',  'g',  'g',  'g',  null, null, null],
    [null, null, 'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  null, null],
    [null, 'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  null],
    [null, 'g',  'g',  'B',  'B',  'g',  'g',  'B',  'B',  'g',  'g',  null],
    ['g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g' ],
    ['g',  'g',  'l',  'l',  'l',  'g',  'g',  'l',  'l',  'l',  'g',  'g' ],
    ['g',  'g',  'l',  'l',  'l',  'g',  'g',  'l',  'l',  'l',  'g',  'g' ],
    [null, 'g',  'g',  'g',  'p',  'p',  'p',  'p',  'g',  'g',  'g',  null],
    [null, 'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  null],
    [null, null, 'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  null, null],
    [null, 'd',  'd',  'd',  null, null, null, null, 'd',  'd',  'd',  null],
    [null, 'd',  null, 'd',  null, null, null, null, 'd',  null, 'd',  null],
  ],
  happy: [
    [null, null, null, 'g',  'g',  'g',  'g',  'g',  'g',  null, null, null],
    [null, null, 'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  null, null],
    [null, 'g',  'g',  'W',  'W',  'g',  'g',  'W',  'W',  'g',  'g',  null],
    [null, 'g',  'g',  'W',  'B',  'g',  'g',  'W',  'B',  'g',  'g',  null],
    ['g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g' ],
    ['g',  'g',  'l',  'p',  'p',  'p',  'p',  'p',  'p',  'l',  'g',  'g' ],
    ['g',  'g',  'l',  'l',  'p',  'p',  'p',  'p',  'l',  'l',  'g',  'g' ],
    [null, 'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  null],
    [null, 'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  null],
    [null, null, 'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  null, null],
    [null, 'd',  'd',  'd',  null, null, null, null, 'd',  'd',  'd',  null],
    [null, 'd',  null, 'd',  null, null, null, null, 'd',  null, 'd',  null],
  ],
  sad: [
    [null, null, null, 'g',  'g',  'g',  'g',  'g',  'g',  null, null, null],
    [null, null, 'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  null, null],
    [null, 'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  null],
    [null, 'g',  'g',  'B',  'B',  'g',  'g',  'B',  'B',  'g',  'g',  null],
    ['g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g' ],
    ['g',  'g',  'l',  'l',  'l',  'g',  'g',  'l',  'l',  'l',  'g',  'g' ],
    ['g',  'g',  'l',  'l',  'l',  'g',  'g',  'l',  'l',  'l',  'g',  'g' ],
    [null, 'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  null],
    [null, 'g',  'g',  'g',  'g',  'p',  'p',  'g',  'g',  'g',  'g',  null],
    [null, null, 'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  null, null],
    [null, 'd',  'd',  null, null, null, null, null, null, 'd',  'd',  null],
    [null, null, 'd',  null, 'd',  null, null, 'd',  null, 'd',  null, null],
  ],
  eating: [
    [null, null, null, 'g',  'g',  'g',  'g',  'g',  'g',  null, null, null],
    [null, null, 'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  null, null],
    [null, 'g',  'g',  'W',  'W',  'g',  'g',  'W',  'W',  'g',  'g',  null],
    [null, 'g',  'g',  'W',  'B',  'g',  'g',  'W',  'B',  'g',  'g',  null],
    ['g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g' ],
    ['g',  'g',  'l',  'l',  'l',  'g',  'g',  'l',  'l',  'l',  'g',  'g' ],
    ['g',  'g',  'l',  'p',  'p',  'p',  'p',  'p',  'p',  'l',  'g',  'g' ],
    [null, 'g',  'g',  'p',  'p',  'p',  'p',  'p',  'p',  'g',  'g',  null],
    [null, 'g',  'g',  'g',  'p',  'p',  'p',  'p',  'g',  'g',  'g',  null],
    [null, null, 'g',  'g',  'g',  'g',  'g',  'g',  'g',  'g',  null, null],
    [null, 'd',  'd',  'd',  null, null, null, null, 'd',  'd',  'd',  null],
    [null, 'd',  null, 'd',  null, null, null, null, 'd',  null, 'd',  null],
  ],
};

const MOLANDAK_SPRITES = {
  idle: [
    [null, null, 'b',  'b',  null, null, null, null, 'b',  'b',  null, null],
    [null, 'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  null],
    [null, 'b',  'd',  'W',  'W',  'b',  'b',  'W',  'W',  'd',  'b',  null],
    [null, 'b',  'd',  'W',  'B',  'b',  'b',  'W',  'B',  'd',  'b',  null],
    ['b',  'b',  'b',  'b',  'p',  'p',  'p',  'p',  'b',  'b',  'b',  'b' ],
    ['b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b' ],
    [null, 'b',  'b',  'b',  'b',  'd',  'd',  'b',  'b',  'b',  'b',  null],
    [null, 'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  null],
    [null, null, 'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  null, null],
    [null, 'c',  'c',  'b',  'b',  'b',  'b',  'b',  'b',  'c',  'c',  null],
    [null, 'c',  'c',  'c',  null, null, null, null, 'c',  'c',  'c',  null],
    [null, null, 'c',  null, null, null, null, null, null, 'c',  null, null],
  ],
  blink: [
    [null, null, 'b',  'b',  null, null, null, null, 'b',  'b',  null, null],
    [null, 'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  null],
    [null, 'b',  'd',  'b',  'b',  'b',  'b',  'b',  'b',  'd',  'b',  null],
    [null, 'b',  'd',  'B',  'B',  'b',  'b',  'B',  'B',  'd',  'b',  null],
    ['b',  'b',  'b',  'b',  'p',  'p',  'p',  'p',  'b',  'b',  'b',  'b' ],
    ['b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b' ],
    [null, 'b',  'b',  'b',  'b',  'd',  'd',  'b',  'b',  'b',  'b',  null],
    [null, 'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  null],
    [null, null, 'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  null, null],
    [null, 'c',  'c',  'b',  'b',  'b',  'b',  'b',  'b',  'c',  'c',  null],
    [null, 'c',  'c',  'c',  null, null, null, null, 'c',  'c',  'c',  null],
    [null, null, 'c',  null, null, null, null, null, null, 'c',  null, null],
  ],
  happy: [
    [null, null, 'b',  'b',  null, null, null, null, 'b',  'b',  null, null],
    [null, 'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  null],
    [null, 'b',  'd',  'W',  'W',  'b',  'b',  'W',  'W',  'd',  'b',  null],
    [null, 'b',  'd',  'W',  'B',  'b',  'b',  'W',  'B',  'd',  'b',  null],
    ['b',  'b',  'b',  'b',  'p',  'p',  'p',  'p',  'b',  'b',  'b',  'b' ],
    ['b',  'b',  'b',  'p',  'p',  'p',  'p',  'p',  'p',  'b',  'b',  'b' ],
    [null, 'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  null],
    [null, 'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  null],
    [null, null, 'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  null, null],
    [null, 'c',  'c',  'b',  'b',  'b',  'b',  'b',  'b',  'c',  'c',  null],
    [null, 'c',  'c',  'c',  null, null, null, null, 'c',  'c',  'c',  null],
    [null, null, 'c',  null, null, null, null, null, null, 'c',  null, null],
  ],
  sad: [
    [null, null, 'b',  'b',  null, null, null, null, 'b',  'b',  null, null],
    [null, 'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  null],
    [null, 'b',  'd',  'b',  'b',  'b',  'b',  'b',  'b',  'd',  'b',  null],
    [null, 'b',  'd',  'B',  'B',  'b',  'b',  'B',  'B',  'd',  'b',  null],
    ['b',  'b',  'b',  'b',  'p',  'p',  'p',  'p',  'b',  'b',  'b',  'b' ],
    ['b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b' ],
    [null, 'b',  'b',  'b',  'b',  'd',  'd',  'b',  'b',  'b',  'b',  null],
    [null, 'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  null],
    [null, null, 'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  null, null],
    [null, 'c',  'c',  'b',  'b',  'b',  'b',  'b',  'b',  'c',  'c',  null],
    [null, null, 'c',  'c',  null, null, null, null, 'c',  'c',  null, null],
    [null, null, null, 'c',  null, null, null, null, 'c',  null, null, null],
  ],
  eating: [
    [null, null, 'b',  'b',  null, null, null, null, 'b',  'b',  null, null],
    [null, 'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  null],
    [null, 'b',  'd',  'W',  'W',  'b',  'b',  'W',  'W',  'd',  'b',  null],
    [null, 'b',  'd',  'W',  'B',  'b',  'b',  'W',  'B',  'd',  'b',  null],
    ['b',  'b',  'b',  'b',  'p',  'p',  'p',  'p',  'b',  'b',  'b',  'b' ],
    ['b',  'b',  'b',  'p',  'p',  'p',  'p',  'p',  'p',  'b',  'b',  'b' ],
    [null, 'b',  'b',  'b',  'p',  'p',  'p',  'p',  'b',  'b',  'b',  null],
    [null, 'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  null],
    [null, null, 'b',  'b',  'b',  'b',  'b',  'b',  'b',  'b',  null, null],
    [null, 'c',  'c',  'b',  'b',  'b',  'b',  'b',  'b',  'c',  'c',  null],
    [null, 'c',  'c',  'c',  null, null, null, null, 'c',  'c',  'c',  null],
    [null, null, 'c',  null, null, null, null, null, null, 'c',  null, null],
  ],
};

const MOYAKI_SPRITES = {
  idle: [
    [null, null, null, null, 'r',  'o',  'o',  'r',  null, null, null, null],
    [null, null, null, 'o',  'y',  'y',  'y',  'y',  'o',  null, null, null],
    [null, null, 'o',  'o',  'y',  'y',  'y',  'y',  'o',  'o',  null, null],
    [null, null, 'o',  'W',  'W',  'o',  'o',  'W',  'W',  'o',  null, null],
    [null, null, 'o',  'W',  'B',  'o',  'o',  'W',  'B',  'o',  null, null],
    ['w',  'w',  'o',  'o',  'o',  'y',  'y',  'o',  'o',  'o',  'w',  'w' ],
    [null, 'w',  'w',  'o',  'o',  'o',  'o',  'o',  'o',  'w',  'w',  null],
    [null, null, 'o',  'o',  'o',  'o',  'o',  'o',  'o',  'o',  null, null],
    [null, null, null, 'o',  'o',  'o',  'o',  'o',  'o',  null, null, null],
    [null, null, null, 'y',  'y',  null, null, 'y',  'y',  null, null, null],
    [null, null, 'r',  'o',  'o',  null, null, 'o',  'o',  'r',  null, null],
    [null, 'r',  'r',  null, null, null, null, null, null, 'r',  'r',  null],
  ],
  blink: [
    [null, null, null, null, 'r',  'o',  'o',  'r',  null, null, null, null],
    [null, null, null, 'o',  'y',  'y',  'y',  'y',  'o',  null, null, null],
    [null, null, 'o',  'o',  'y',  'y',  'y',  'y',  'o',  'o',  null, null],
    [null, null, 'o',  'o',  'o',  'o',  'o',  'o',  'o',  'o',  null, null],
    [null, null, 'o',  'B',  'B',  'o',  'o',  'B',  'B',  'o',  null, null],
    ['w',  'w',  'o',  'o',  'o',  'y',  'y',  'o',  'o',  'o',  'w',  'w' ],
    [null, 'w',  'w',  'o',  'o',  'o',  'o',  'o',  'o',  'w',  'w',  null],
    [null, null, 'o',  'o',  'o',  'o',  'o',  'o',  'o',  'o',  null, null],
    [null, null, null, 'o',  'o',  'o',  'o',  'o',  'o',  null, null, null],
    [null, null, null, 'y',  'y',  null, null, 'y',  'y',  null, null, null],
    [null, null, 'r',  'o',  'o',  null, null, 'o',  'o',  'r',  null, null],
    [null, 'r',  'r',  null, null, null, null, null, null, 'r',  'r',  null],
  ],
  happy: [
    [null, null, null, null, 'r',  'o',  'o',  'r',  null, null, null, null],
    [null, null, null, 'o',  'y',  'y',  'y',  'y',  'o',  null, null, null],
    [null, null, 'o',  'o',  'y',  'y',  'y',  'y',  'o',  'o',  null, null],
    [null, null, 'o',  'W',  'W',  'o',  'o',  'W',  'W',  'o',  null, null],
    [null, null, 'o',  'W',  'B',  'o',  'o',  'W',  'B',  'o',  null, null],
    ['w',  'w',  'o',  'o',  'y',  'y',  'y',  'y',  'o',  'o',  'w',  'w' ],
    ['w',  'w',  'w',  'o',  'o',  'o',  'o',  'o',  'o',  'w',  'w',  'w' ],
    [null, null, 'o',  'o',  'o',  'o',  'o',  'o',  'o',  'o',  null, null],
    [null, null, null, 'o',  'o',  'o',  'o',  'o',  'o',  null, null, null],
    [null, null, null, 'y',  'y',  null, null, 'y',  'y',  null, null, null],
    [null, null, 'r',  'o',  'o',  null, null, 'o',  'o',  'r',  null, null],
    [null, 'r',  'r',  null, null, null, null, null, null, 'r',  'r',  null],
  ],
  sad: [
    [null, null, null, null, 'r',  'o',  'o',  'r',  null, null, null, null],
    [null, null, null, 'o',  'o',  'o',  'o',  'o',  'o',  null, null, null],
    [null, null, 'o',  'o',  'o',  'o',  'o',  'o',  'o',  'o',  null, null],
    [null, null, 'o',  'B',  'B',  'o',  'o',  'B',  'B',  'o',  null, null],
    [null, null, 'o',  'o',  'o',  'o',  'o',  'o',  'o',  'o',  null, null],
    [null, null, 'o',  'o',  'o',  'o',  'o',  'o',  'o',  'o',  null, null],
    [null, null, null, 'o',  'o',  'o',  'o',  'o',  'o',  null, null, null],
    [null, null, null, 'o',  'o',  'o',  'o',  'o',  'o',  null, null, null],
    [null, null, null, null, 'o',  'o',  'o',  'o',  null, null, null, null],
    [null, null, null, 'y',  null, null, null, null, 'y',  null, null, null],
    [null, null, null, 'o',  null, null, null, null, 'o',  null, null, null],
    [null, null, null, null, null, null, null, null, null, null, null, null],
  ],
  eating: [
    [null, null, null, null, 'r',  'o',  'o',  'r',  null, null, null, null],
    [null, null, null, 'o',  'y',  'y',  'y',  'y',  'o',  null, null, null],
    [null, null, 'o',  'o',  'y',  'y',  'y',  'y',  'o',  'o',  null, null],
    [null, null, 'o',  'W',  'W',  'o',  'o',  'W',  'W',  'o',  null, null],
    [null, null, 'o',  'W',  'B',  'o',  'o',  'W',  'B',  'o',  null, null],
    ['w',  'w',  'o',  'o',  'o',  'r',  'r',  'o',  'o',  'o',  'w',  'w' ],
    [null, 'w',  'w',  'o',  'o',  'r',  'r',  'o',  'o',  'w',  'w',  null],
    [null, null, 'o',  'o',  'o',  'r',  'r',  'o',  'o',  'o',  null, null],
    [null, null, null, 'o',  'o',  'o',  'o',  'o',  'o',  null, null, null],
    [null, null, null, 'y',  'y',  null, null, 'y',  'y',  null, null, null],
    [null, null, 'r',  'o',  'o',  null, null, 'o',  'o',  'r',  null, null],
    [null, 'r',  'r',  null, null, null, null, null, null, 'r',  'r',  null],
  ],
};

// LCD Tamagotchi palette
export const LCD = {
  bg: '#8b956d',
  dark: '#2d3020',
  light: '#a3ad8a',
  shellDark: '#606060',
  shellLight: '#d0d0d0',
  shellMid: '#a0a0a0',
};

// Daily interaction limits
export const DAILY_LIMITS = {
  maxFeeds: 8,
  maxPets: 15,
  maxTipXP: 10,
};

export const PET_TYPES = {
  chog: {
    name: 'Chog',
    icon: '[C]',
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
    icon: '[M]',
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
    icon: '[Y]',
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
  "Chain ID 10143 \u2014 Monad Testnet is fully EVM-compatible!",
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
  dailyFeeds: 0,
  dailyPets: 0,
  dailyTipXP: 0,
  lastDayReset: new Date().toDateString(),
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
