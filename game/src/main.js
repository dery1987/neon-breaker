// NEON BREAKER boot + game loop. A fixed-step simulation (60 updates a second)
// drives the world; the renderer draws the current frame. Keyboard and mouse
// both steer the paddle. `?shot=start|play|end|win&seed=1` renders one scene
// deterministically for screenshots, with no input needed.

import { BEST_KEY, FIELD, STEP } from './config.js';
import { Input } from './input.js';
import { SoundFX } from './audio.js';
import {
  EVENT_BRICK,
  EVENT_LEVEL,
  EVENT_LOSE,
  EVENT_OVER,
  EVENT_PADDLE,
  EVENT_POWERUP,
  EVENT_TOUGH,
  EVENT_WIN,
  STATE_LEVEL_CLEAR,
  STATE_OVER,
  STATE_PLAY,
  STATE_SERVE,
  STATE_TITLE,
  STATE_WIN,
  World,
} from './world.js';
import { draw } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const statusLine = document.getElementById('status');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number.parseInt(params.get('seed') || '1', 10) || 1;

const world = new World(seed);
const input = new Input(canvas);
const sound = new SoundFX();

let best = 0;
try {
  best = Number.parseInt(window.localStorage.getItem(BEST_KEY) || '0', 10) || 0;
} catch {
  best = 0;
}
world.best = best;

let paused = false;
let screen = STATE_TITLE;
let shotMode = false;
let shotBest = 0;

// Test hook (harmless in play): lets automated checks read the live state.
window.__neonBreaker = {
  world,
  get screen() {
    return screen;
  },
  get paused() {
    return paused;
  },
};

function saveBest() {
  if (world.score <= best) return;
  best = world.score;
  world.best = best;
  try {
    window.localStorage.setItem(BEST_KEY, String(best));
  } catch {
    // Private mode or blocked storage: best score just lives for this visit.
  }
}

function announce(text) {
  if (statusLine) statusLine.textContent = text;
}

function playEvents(events) {
  if (events & EVENT_PADDLE) sound.paddle();
  if (events & EVENT_BRICK) sound.brick(world.combo);
  if (events & EVENT_TOUGH) sound.toughHit();
  if (events & EVENT_POWERUP) sound.powerup();
  if (events & EVENT_LOSE) sound.loseLife();
  if (events & EVENT_LEVEL) {
    sound.levelClear();
    announce(`Level ${world.level} clear! Score ${world.score}.`);
  }
  if (events & EVENT_WIN) {
    sound.victory();
    saveBest();
    announce(`You win! Final score ${world.score}.`);
  }
  if (events & EVENT_OVER) {
    sound.gameOver();
    saveBest();
    announce(`Game over. Score ${world.score}. Press R to play again.`);
  }
}

function primaryAction() {
  sound.unlock();
  if (screen === STATE_TITLE) {
    sound.click();
    world.startGame();
    screen = STATE_SERVE;
    announce('Level 1. Click or press Space to launch the ball.');
  } else if (screen === STATE_SERVE) {
    if (world.launchBall()) {
      sound.launch();
      screen = STATE_PLAY;
    }
  } else if (screen === STATE_LEVEL_CLEAR) {
    sound.click();
    world.nextLevel();
    screen = world.state === STATE_WIN ? STATE_WIN : STATE_SERVE;
    if (screen === STATE_WIN) saveBest();
  } else if (screen === STATE_OVER || screen === STATE_WIN) {
    sound.click();
    world.reset(world.seed);
    world.startGame();
    screen = STATE_SERVE;
  }
}

function restart() {
  sound.unlock();
  world.reset(world.seed);
  world.startGame();
  screen = STATE_SERVE;
  paused = false;
  announce('New game. Level 1.');
}

input.onKeyDown = (code) => {
  if (code === 'KeyM') {
    const muted = sound.toggleMute();
    announce(muted ? 'Sound muted.' : 'Sound on.');
    return;
  }
  if (code === 'KeyP' && (screen === STATE_PLAY || screen === STATE_SERVE)) {
    paused = !paused;
    announce(paused ? 'Paused.' : 'Resumed.');
    return;
  }
  if (code === 'KeyR' && screen !== STATE_TITLE) {
    restart();
    return;
  }
  if (code === 'Space' || code === 'Enter') primaryAction();
};
input.onPointerDown = () => {
  if (shotMode) return;
  primaryAction();
};

function resize() {
  const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
  canvas.width = Math.round(FIELD.width * scale);
  canvas.height = Math.round(FIELD.height * scale);
  canvas.style.width = `${canvas.width}px`;
  canvas.style.height = `${canvas.height}px`;
}

window.addEventListener('resize', resize);
resize();
input.attach();

// Screenshot mode: stage one deterministic scene and freeze on it.
if (shotName) {
  shotMode = true;
  const staged = stageShot(shotName, world);
  screen = staged.screen;
  shotBest = staged.best;
  best = Math.max(best, staged.best);
  draw(ctx, world, screen, best, false);
  document.title = `NEON BREAKER — ${shotName}`;
} else {
  // Normal play: fixed-step loop with an accumulator.
  let last = performance.now();
  let accumulator = 0;
  function frame(now) {
    const elapsed = Math.min(0.1, (now - last) / 1000);
    last = now;
    accumulator += elapsed;
    while (accumulator >= STEP) {
      accumulator -= STEP;
      if (!paused) {
        const move = input.moveDirection();
        const pointerX = input.pointerDown || input.pointerX !== null ? input.pointerX : null;
        const events = world.step(STEP, move, pointerX);
        if (events) playEvents(events);
        screen = world.state;
        if (world.score > best) saveBest();
      }
      // P is handled in Input.onKeyDown the moment it is pressed; nothing to
      // consume here, or the pause would toggle twice per press.
    }
    draw(ctx, world, screen, best, paused);
    input.endFrame();
    requestAnimationFrame(frame);
  }
  announce('NEON BREAKER. Click or press Space to play.');
  requestAnimationFrame(frame);
}
