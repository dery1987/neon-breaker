// NEON BREAKER — every tuning number, colour and level layout in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Paddle: wide neon bar the player slides along the bottom. */
export const PADDLE = {
  width: 150,
  height: 18,
  y: 668,
  speed: 820,
  wideWidth: 230,
  wideSeconds: 12,
  shrinkStep: 8,
};

/** Ball: starts glued to the paddle, launches on click / Space. */
export const BALL = {
  radius: 9,
  speed: 430,
  speedPerLevel: 22,
  maxSpeed: 640,
  maxBalls: 5,
};

/** Bricks: a wall of glowing blocks; each level is a different pattern. */
export const BRICK = {
  width: 92,
  height: 30,
  gapX: 10,
  gapY: 10,
  marginX: 42,
  topY: 96,
  cols: 12,
  /** Points per hit, before the combo multiplier. */
  hitPoints: 10,
  breakPoints: 50,
  toughPoints: 100,
};

/** Lives, and how many levels make a full run (clear level 5 to win). */
export const LIVES = 3;
export const LEVEL_COUNT = 5;

/** Power-up capsules that fall from broken bonus bricks. */
export const POWERUP = {
  size: 26,
  fallSpeed: 170,
  /** Chance a broken brick drops a capsule. */
  dropChance: 0.22,
  types: ['wide', 'multi', 'slow', 'life'],
};

/** Juice: particles, floating score text and screen shake. */
export const JUICE = {
  particlesPerBreak: 14,
  particleLife: 0.7,
  shakeOnBreak: 3,
  shakeOnTough: 5,
  shakeOnLose: 9,
  shakeDecay: 26,
  maxParticles: 320,
  maxFloaters: 24,
};

/** Combo: consecutive brick hits without the ball touching the paddle raise the multiplier. */
export const COMBO = { step: 6, max: 5 };

export const PALETTE = {
  backdrop: '#070312',
  backdropTop: '#12082e',
  backdropBottom: '#040108',
  grid: '#1b1140',
  star: '#cfc4ff',
  paddle: '#22e6ff',
  paddleGlow: '#00b3ff',
  ball: '#ffffff',
  ballGlow: '#7df9ff',
  brickPink: '#ff2e88',
  brickOrange: '#ff7a1a',
  brickGold: '#ffc21a',
  brickGreen: '#2eff8f',
  brickBlue: '#2e7dff',
  brickPurple: '#a64dff',
  brickTough: '#e8e8f2',
  brickToughCore: '#8f8fb2',
  text: '#f4f2ff',
  muted: '#9d94c9',
  danger: '#ff3b5c',
  panel: '#150b33',
  panelEdge: '#3d2a7a',
  gold: '#ffd94d',
};

export const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';
export const FONT_DISPLAY = '"Arial Black", "Segoe UI", system-ui, sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'neon-breaker.best';

/**
 * Level patterns: each row is a string of brick codes, one character per column
 * (12 columns). `.` empty, `1` normal, `2` tough (2 hits), `*` bonus (drops a
 * power-up), `3` hard (3 hits). Rows are centred under the HUD.
 */
export const LEVELS = [
  {
    name: 'FIRST LIGHT',
    rows: [
      '............',
      '.1111111111.',
      '.1111111111.',
      '..*111111*..',
      '............',
    ],
  },
  {
    name: 'NEON RAIN',
    rows: [
      '.2222222222.',
      '.1111111111.',
      '111111111111',
      '.1*111111*1.',
      '..11111111..',
    ],
  },
  {
    name: 'CROSSFIRE',
    rows: [
      '1..........1',
      '.11......11.',
      '..12111121..',
      '...1*11*1...',
      '....1111....',
    ],
  },
  {
    name: 'THE GRID',
    rows: [
      '121212121212',
      '212121212121',
      '111111111111',
      '.2*111111*2.',
      '..33333333..',
    ],
  },
  {
    name: 'FINAL VOLT',
    rows: [
      '333333333333',
      '222222222222',
      '111111111111',
      '.3*222222*3.',
      '..11111111..',
      '............',
    ],
  },
];
