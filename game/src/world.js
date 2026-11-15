// NEON BREAKER's world: paddle, balls, bricks, power-ups, particles and score.
// Pure simulation — no drawing, no sound calls here; step() returns event flags
// and the caller (main.js) turns them into effects. Fully deterministic for a
// fixed seed and a fixed stream of paddle moves.

import {
  BALL,
  BRICK,
  COMBO,
  FIELD,
  JUICE,
  LEVEL_COUNT,
  LEVELS,
  LIVES,
  PADDLE,
  POWERUP,
} from './config.js';
import { makeRandom, randChance, randPick } from './random.js';

/** Event flags returned by step(). */
export const EVENT_NONE = 0;
export const EVENT_BRICK = 1 << 0;
export const EVENT_TOUGH = 1 << 1;
export const EVENT_POWERUP = 1 << 2;
export const EVENT_LOSE = 1 << 3;
export const EVENT_LEVEL = 1 << 4;
export const EVENT_WIN = 1 << 5;
export const EVENT_OVER = 1 << 6;
export const EVENT_LAUNCH = 1 << 7;
export const EVENT_PADDLE = 1 << 8;

export const STATE_TITLE = 'title';
export const STATE_SERVE = 'serve';
export const STATE_PLAY = 'play';
export const STATE_LEVEL_CLEAR = 'level-clear';
export const STATE_OVER = 'over';
export const STATE_WIN = 'win';

const BRICK_COLOURS = ['brickPink', 'brickOrange', 'brickGold', 'brickGreen', 'brickBlue', 'brickPurple'];

/** Build the brick wall for a level (1-based) from its pattern rows. */
export function buildBricks(level) {
  const pattern = LEVELS[(level - 1) % LEVELS.length];
  const bricks = [];
  const rows = pattern.rows.length;
  const totalWidth = BRICK.cols * BRICK.width + (BRICK.cols - 1) * BRICK.gapX;
  const startX = (FIELD.width - totalWidth) / 2;
  for (let row = 0; row < rows; row += 1) {
    const line = pattern.rows[row];
    for (let col = 0; col < BRICK.cols; col += 1) {
      const code = line[col] || '.';
      if (code === '.') continue;
      const hp = code === '2' ? 2 : code === '3' ? 3 : 1;
      bricks.push({
        x: startX + col * (BRICK.width + BRICK.gapX),
        y: BRICK.topY + row * (BRICK.height + BRICK.gapY),
        width: BRICK.width,
        height: BRICK.height,
        hp,
        maxHp: hp,
        bonus: code === '*',
        colour: BRICK_COLOURS[(row + col) % BRICK_COLOURS.length],
        alive: true,
        flash: 0,
      });
    }
  }
  return bricks;
}

function freshBall(x, y, angle, speed) {
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: BALL.radius,
    stuck: true,
    trail: [],
  };
}

export class World {
  constructor(seed = 1) {
    this.seed = seed;
    this.reset(seed);
  }

  reset(seed = this.seed) {
    this.seed = seed;
    this.rng = makeRandom(seed);
    this.state = STATE_TITLE;
    this.score = 0;
    this.best = 0;
    this.lives = LIVES;
    this.level = 1;
    this.combo = 0;
    this.comboBest = 0;
    this.bricksBroken = 0;
    this.ballsLost = 0;
    this.time = 0;
    this.shake = 0;
    this.paddle = {
      x: (FIELD.width - PADDLE.width) / 2,
      y: PADDLE.y,
      width: PADDLE.width,
      height: PADDLE.height,
      wideUntil: 0,
      targetX: null,
    };
    this.balls = [freshBall(FIELD.width / 2, PADDLE.y - BALL.radius - 1, -Math.PI / 2, this.ballSpeed())];
    this.bricks = buildBricks(1);
    this.powerups = [];
    this.particles = [];
    this.floaters = [];
    this.stars = [];
    for (let i = 0; i < 90; i += 1) {
      this.stars.push({
        x: this.rng() * FIELD.width,
        y: this.rng() * FIELD.height,
        size: 1 + this.rng() * 2,
        twinkle: this.rng() * Math.PI * 2,
        speed: 4 + this.rng() * 14,
      });
    }
    this.message = '';
    this.messageUntil = 0;
  }

  ballSpeed() {
    return Math.min(BALL.maxSpeed, BALL.speed + (this.level - 1) * BALL.speedPerLevel);
  }

  get bricksLeft() {
    let count = 0;
    for (const brick of this.bricks) if (brick.alive) count += 1;
    return count;
  }

  get paddleWidth() {
    return this.time < this.paddle.wideUntil ? PADDLE.wideWidth : PADDLE.width;
  }

  startGame() {
    this.score = 0;
    this.lives = LIVES;
    this.level = 1;
    this.combo = 0;
    this.comboBest = 0;
    this.bricksBroken = 0;
    this.ballsLost = 0;
    this.bricks = buildBricks(1);
    this.powerups = [];
    this.particles = [];
    this.floaters = [];
    this.state = STATE_SERVE;
    this.serveBall();
  }

  serveBall() {
    const speed = this.ballSpeed();
    const angle = -Math.PI / 2 + (this.rng() - 0.5) * 0.9;
    this.balls = [freshBall(this.paddle.x + this.paddleWidth / 2, PADDLE.y - BALL.radius - 1, angle, speed)];
    this.paddle.targetX = null;
  }

  launchBall() {
    let launched = false;
    for (const ball of this.balls) {
      if (!ball.stuck) continue;
      ball.stuck = false;
      launched = true;
    }
    if (launched) this.state = STATE_PLAY;
    return launched;
  }

  nextLevel() {
    this.level += 1;
    if (this.level > LEVEL_COUNT) {
      this.state = STATE_WIN;
      return;
    }
    this.bricks = buildBricks(this.level);
    this.powerups = [];
    this.state = STATE_SERVE;
    this.serveBall();
  }

  showMessage(text, seconds = 1.6) {
    this.message = text;
    this.messageUntil = this.time + seconds;
  }

  addScore(points, x, y) {
    const gained = points * Math.max(1, this.combo);
    this.score += gained;
    if (this.floaters.length < JUICE.maxFloaters) {
      this.floaters.push({ x, y, text: `+${gained}`, life: 0.9, maxLife: 0.9 });
    }
    return gained;
  }

  burst(x, y, colour, count, speed = 260) {
    for (let i = 0; i < count && this.particles.length < JUICE.maxParticles; i += 1) {
      const angle = this.rng() * Math.PI * 2;
      const velocity = (0.3 + this.rng() * 0.7) * speed;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 60,
        life: JUICE.particleLife * (0.5 + this.rng() * 0.5),
        maxLife: JUICE.particleLife,
        size: 2 + this.rng() * 4,
        colour,
      });
    }
  }

  dropPowerup(x, y) {
    const type = randPick(this.rng, POWERUP.types);
    this.powerups.push({ x, y, type, size: POWERUP.size, vy: POWERUP.fallSpeed, spin: 0 });
  }

  applyPowerup(type) {
    if (type === 'wide') {
      this.paddle.wideUntil = this.time + PADDLE.wideSeconds;
      this.showMessage('WIDE PADDLE!');
    } else if (type === 'multi') {
      const speed = this.ballSpeed();
      const sources = this.balls.filter((b) => !b.stuck).slice(0, 2);
      for (const source of sources) {
        if (this.balls.length >= BALL.maxBalls) break;
        for (const offset of [-0.5, 0.5]) {
          if (this.balls.length >= BALL.maxBalls) break;
          const angle = Math.atan2(source.vy, source.vx) + offset;
          const ball = freshBall(source.x, source.y, angle, speed);
          ball.stuck = false;
          this.balls.push(ball);
        }
      }
      this.showMessage('MULTI-BALL!');
    } else if (type === 'slow') {
      for (const ball of this.balls) {
        const factor = 0.72;
        ball.vx *= factor;
        ball.vy *= factor;
      }
      this.showMessage('SLOW BALL!');
    } else if (type === 'life') {
      this.lives += 1;
      this.showMessage('EXTRA LIFE!');
    }
  }

  /** Move the paddle: `direction` -1/0/1 from keys, `pointerX` overrides with the mouse. */
  movePaddle(direction, pointerX, dt) {
    const width = this.paddleWidth;
    if (pointerX !== null && pointerX !== undefined) {
      this.paddle.x = Math.max(0, Math.min(FIELD.width - width, pointerX - width / 2));
    } else if (direction !== 0) {
      this.paddle.x = Math.max(
        0,
        Math.min(FIELD.width - width, this.paddle.x + direction * PADDLE.speed * dt),
      );
    }
    this.paddle.width = width;
    for (const ball of this.balls) {
      if (ball.stuck) {
        ball.x = this.paddle.x + width / 2;
        ball.y = PADDLE.y - ball.radius - 1;
      }
    }
  }

  /** One fixed simulation step. `move` is -1/0/1, `pointerX` a mouse target or null. */
  step(dt, move, pointerX) {
    this.time += dt;
    let events = EVENT_NONE;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - JUICE.shakeDecay * dt);

    for (const star of this.stars) {
      star.y += star.speed * dt;
      if (star.y > FIELD.height) {
        star.y = -4;
        star.x = this.rng() * FIELD.width;
      }
      star.twinkle += dt * 2;
    }
    for (const brick of this.bricks) if (brick.flash > 0) brick.flash -= dt;
    for (const floater of this.floaters) {
      floater.life -= dt;
      floater.y -= 42 * dt;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 320 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    if (this.state === STATE_TITLE) return events;
    this.movePaddle(move, pointerX, dt);
    if (this.state !== STATE_PLAY) return events;

    // Falling power-up capsules.
    for (const powerup of this.powerups) {
      powerup.y += powerup.vy * dt;
      powerup.spin += dt * 5;
      const caught =
        powerup.y + powerup.size / 2 >= this.paddle.y &&
        powerup.y - powerup.size / 2 <= this.paddle.y + this.paddle.height &&
        powerup.x >= this.paddle.x - powerup.size / 2 &&
        powerup.x <= this.paddle.x + this.paddle.width + powerup.size / 2;
      if (caught) {
        this.applyPowerup(powerup.type);
        this.burst(powerup.x, powerup.y, '#ffd94d', 10, 180);
        powerup.caught = true;
        events |= EVENT_POWERUP;
      }
    }
    this.powerups = this.powerups.filter((p) => !p.caught && p.y < FIELD.height + 40);

    // Balls.
    const speed = this.ballSpeed();
    for (const ball of this.balls) {
      if (ball.stuck) continue;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      ball.trail.push({ x: ball.x, y: ball.y });
      if (ball.trail.length > 10) ball.trail.shift();

      // Walls.
      if (ball.x - ball.radius < 0) {
        ball.x = ball.radius;
        ball.vx = Math.abs(ball.vx);
      } else if (ball.x + ball.radius > FIELD.width) {
        ball.x = FIELD.width - ball.radius;
        ball.vx = -Math.abs(ball.vx);
      }
      if (ball.y - ball.radius < 64) {
        ball.y = 64 + ball.radius;
        ball.vy = Math.abs(ball.vy);
      }

      // Paddle: bounce angle depends on where the ball lands on the paddle.
      if (
        ball.vy > 0 &&
        ball.y + ball.radius >= this.paddle.y &&
        ball.y - ball.radius <= this.paddle.y + this.paddle.height &&
        ball.x >= this.paddle.x - ball.radius &&
        ball.x <= this.paddle.x + this.paddle.width + ball.radius
      ) {
        const offset = (ball.x - (this.paddle.x + this.paddle.width / 2)) / (this.paddle.width / 2);
        const angle = -Math.PI / 2 + Math.max(-1.15, Math.min(1.15, offset * 1.15));
        const currentSpeed = Math.min(BALL.maxSpeed, Math.hypot(ball.vx, ball.vy));
        ball.vx = Math.cos(angle) * currentSpeed;
        ball.vy = Math.sin(angle) * currentSpeed;
        ball.y = this.paddle.y - ball.radius - 0.5;
        this.combo = 0;
        events |= EVENT_PADDLE;
      }

      // Bricks: circle-vs-rectangle, bounce off the shallowest side.
      for (const brick of this.bricks) {
        if (!brick.alive) continue;
        const nearestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.width));
        const nearestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.height));
        const dx = ball.x - nearestX;
        const dy = ball.y - nearestY;
        if (dx * dx + dy * dy > ball.radius * ball.radius) continue;
        const overlapX = ball.radius - Math.abs(dx);
        const overlapY = ball.radius - Math.abs(dy);
        if (overlapX < overlapY) {
          ball.vx = dx > 0 ? Math.abs(ball.vx) : -Math.abs(ball.vx);
        } else {
          ball.vy = dy > 0 ? Math.abs(ball.vy) : -Math.abs(ball.vy);
        }
        brick.hp -= 1;
        brick.flash = 0.18;
        this.combo += 1;
        this.comboBest = Math.max(this.comboBest, this.combo);
        this.addScore(BRICK.hitPoints, brick.x + brick.width / 2, brick.y);
        if (brick.hp <= 0) {
          brick.alive = false;
          this.bricksBroken += 1;
          this.addScore(BRICK.breakPoints, brick.x + brick.width / 2, brick.y + brick.height / 2);
          this.burst(brick.x + brick.width / 2, brick.y + brick.height / 2, '#ff2e88', JUICE.particlesPerBreak);
          this.shake = Math.max(this.shake, JUICE.shakeOnBreak);
          events |= EVENT_BRICK;
          if (brick.maxHp > 1) this.addScore(BRICK.toughPoints - BRICK.breakPoints, brick.x, brick.y);
          if (brick.bonus || randChance(this.rng, POWERUP.dropChance)) this.dropPowerup(brick.x + brick.width / 2, brick.y);
        } else {
          this.shake = Math.max(this.shake, JUICE.shakeOnTough);
          events |= EVENT_TOUGH;
        }
        break;
      }
    }

    // Balls that fell past the paddle are gone; lose a life when the last one drops.
    const aliveBalls = this.balls.filter((b) => b.y - b.radius < FIELD.height + 30);
    const lost = this.balls.length - aliveBalls.length;
    if (lost > 0) this.ballsLost += lost;
    this.balls = aliveBalls;
    if (this.balls.length === 0) {
      this.lives -= 1;
      this.combo = 0;
      this.shake = JUICE.shakeOnLose;
      events |= EVENT_LOSE;
      if (this.lives <= 0) {
        this.state = STATE_OVER;
        events |= EVENT_OVER;
        return events;
      }
      this.state = STATE_SERVE;
      this.serveBall();
      return events;
    }

    // Level cleared: every brick gone.
    if (this.bricksLeft === 0) {
      const bonus = 250 * this.level + 100 * this.lives;
      this.score += bonus;
      this.showMessage(`LEVEL ${this.level} CLEAR!  +${bonus}`, 2.2);
      if (this.level >= LEVEL_COUNT) {
        this.state = STATE_WIN;
        events |= EVENT_WIN;
      } else {
        this.state = STATE_LEVEL_CLEAR;
        events |= EVENT_LEVEL;
      }
    }
    return events;
  }
}
