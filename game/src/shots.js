// The screenshot scenes behind ?shot=start|play|end|win. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by
// an autopilot that tracks the lowest falling ball and slides the paddle under
// it — so the frame is what a short game really looks like, and the same seed
// always gives the same frame. The end scene's pilot is deliberately clumsy
// (it reacts late and never chases), so the ball drops and the game ends.

import { FIELD, STEP } from './config.js';
import { EVENT_LEVEL, EVENT_OVER, EVENT_WIN, STATE_OVER, STATE_WIN } from './world.js';
import { SCREEN_LEVEL_CLEAR, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 4;
const PLAY_SECONDS = 24;
const END_LIMIT_SECONDS = 240;
const WIN_LIMIT_SECONDS = 900;
const SAMPLE = 1 / 30;

/**
 * Where the paddle should be to catch `ball`: the x where the ball crosses the
 * paddle line, assuming it keeps falling at its current velocity.
 */
function interceptX(ball, paddleY) {
  if (ball.vy <= 0) return ball.x;
  const time = (paddleY - ball.y) / ball.vy;
  let x = ball.x + ball.vx * time;
  // Reflect off the side walls, so the prediction stays honest.
  const width = FIELD.width;
  x = ((x % (2 * width)) + 2 * width) % (2 * width);
  if (x > width) x = 2 * width - x;
  return x;
}

/** -1, 0 or 1: slide the paddle toward the lowest live ball's landing spot. */
function autopilot(world, reaction, aim = false) {
  const paddle = world.paddle;
  const centre = paddle.x + paddle.width / 2;
  let ball = null;
  for (const candidate of world.balls) {
    if (candidate.stuck) continue;
    if (ball === null || candidate.y > ball.y) ball = candidate;
  }
  if (ball === null) return 0;
  const target = interceptX(ball, paddle.y);
  // Aiming: when the ball is falling toward the paddle, steer the rebound at
  // the nearest surviving brick, so the ball never falls into a dead vertical
  // loop through a cleared column. The bounce angle follows the hit offset on
  // the paddle (see world.js), so shift the paddle by the offset that gives
  // the wanted rebound direction.
  let wanted = target;
  if (aim && ball.vy > 0) {
    let brick = null;
    for (const candidate of world.bricks) {
      if (!candidate.alive) continue;
      if (brick === null || candidate.y > brick.y || (candidate.y === brick.y && candidate.x < brick.x)) brick = candidate;
    }
    if (brick !== null) {
      const bx = brick.x + brick.width / 2;
      const by = brick.y + brick.height / 2;
      const dx = bx - target;
      const dy = by - paddle.y;
      const angle = Math.atan2(dx, -dy); // 0 = straight up, +/-1.15 = full tilt
      const offset = Math.max(-0.9, Math.min(0.9, angle / 1.15));
      wanted = target - offset * (paddle.width / 2);
    }
  }
  const error = wanted - centre;
  if (Math.abs(error) < reaction) return 0;
  return error > 0 ? 1 : -1;
}

/**
 * Advance the world `seconds` of play with the given autopilot reaction.
 * With `rescue`, a ball that breaks nothing for 20 simulated seconds is
 * re-served from the paddle with a fresh angle, breaking periodic orbits.
 */
function playForward(world, seconds, reaction, launch = true, aim = false, rescue = false) {
  let events = 0;
  const steps = Math.floor(seconds / STEP);
  let lastBricks = world.bricksLeft;
  let stall = 0;
  for (let i = 0; i < steps; i += 1) {
    if (world.state === 'serve' && launch) world.launchBall();
    const move = autopilot(world, reaction, aim);
    events |= world.step(STEP, move, null);
    if (events & (EVENT_OVER | EVENT_WIN | EVENT_LEVEL)) break;
    if (rescue) {
      const left = world.bricksLeft;
      if (left < lastBricks) {
        lastBricks = left;
        stall = 0;
      } else {
        stall += STEP;
        if (stall > 20 && world.state === 'play') {
          world.serveBall();
          world.launchBall();
          stall = 0;
        }
      }
    }
  }
  return events;
}

/**
 * Set `world` to the named scene (start, play, end, win; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end' && name !== 'win') {
    world.state = 'title';
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, 0, null);
    return { screen: SCREEN_TITLE, best: 0 };
  }

  world.startGame();
  if (name === 'play') {
    playForward(world, PLAY_SECONDS, 6);
    return { screen: SCREEN_PLAY, best: world.score };
  }

  if (name === 'end') {
    // A clumsy pilot (wide dead zone) lets the ball drop; repeat serves until
    // the lives run out.
    let guard = 0;
    while (world.state !== STATE_OVER && guard < 6) {
      playForward(world, END_LIMIT_SECONDS, 400);
      if (world.state === 'serve') world.launchBall();
      guard += 1;
    }
    return { screen: SCREEN_OVER, best: world.score };
  }

  // Win: a sharp, aiming pilot clears all five levels; each level clear advances.
  let guard = 0;
  while (world.state !== STATE_WIN && guard < 12) {
    const events = playForward(world, WIN_LIMIT_SECONDS, 4, true, true, true);
    if (events & EVENT_LEVEL) world.nextLevel();
    else if (world.state === 'serve') world.launchBall();
    else break;
    guard += 1;
  }
  const won = world.state === STATE_WIN;
  const screen = won ? SCREEN_WIN : world.state === 'level-clear' ? SCREEN_LEVEL_CLEAR : SCREEN_PLAY;
  return { screen, best: world.score };
}
