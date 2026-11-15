// All canvas drawing: the neon playfield, HUD, and every screen (title, serve,
// level clear, game over, victory). The renderer never changes the world; it
// only reads it, so a screenshot is exactly one frame of real play.

import { COMBO, FIELD, FONT, FONT_DISPLAY, LEVEL_COUNT, LEVELS, PALETTE, PADDLE } from './config.js';
import { STATE_LEVEL_CLEAR, STATE_OVER, STATE_PLAY, STATE_SERVE, STATE_TITLE, STATE_WIN } from './world.js';

export const SCREEN_TITLE = STATE_TITLE;
export const SCREEN_PLAY = STATE_PLAY;
export const SCREEN_SERVE = STATE_SERVE;
export const SCREEN_LEVEL_CLEAR = STATE_LEVEL_CLEAR;
export const SCREEN_OVER = STATE_OVER;
export const SCREEN_WIN = STATE_WIN;

const POWERUP_STYLE = {
  wide: { label: 'W', colour: '#22e6ff', name: 'WIDE' },
  multi: { label: 'M', colour: '#ff2e88', name: 'MULTI' },
  slow: { label: 'S', colour: '#2eff8f', name: 'SLOW' },
  life: { label: '+', colour: '#ffd94d', name: 'LIFE' },
};

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function glowText(ctx, text, x, y, font, colour, glowColour, glow = 18) {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = glowColour;
  ctx.shadowBlur = glow;
  ctx.fillStyle = colour;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawBackground(ctx, world) {
  const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  gradient.addColorStop(0, PALETTE.backdropTop);
  gradient.addColorStop(0.55, PALETTE.backdrop);
  gradient.addColorStop(1, PALETTE.backdropBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  // Twinkling starfield, drifting slowly downward.
  for (const star of world.stars) {
    const alpha = 0.35 + 0.35 * Math.sin(star.twinkle);
    ctx.globalAlpha = Math.max(0.08, alpha);
    ctx.fillStyle = PALETTE.star;
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
  ctx.globalAlpha = 1;

  // Faint perspective grid on the lower half.
  ctx.strokeStyle = PALETTE.grid;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  for (let x = 0; x <= FIELD.width; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 420);
    ctx.lineTo(FIELD.width / 2 + (x - FIELD.width / 2) * 1.7, FIELD.height);
    ctx.stroke();
  }
  for (let y = 430; y < FIELD.height; y += 34) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(FIELD.width, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Side rails.
  ctx.fillStyle = PALETTE.panelEdge;
  ctx.fillRect(0, 64, 10, FIELD.height - 64);
  ctx.fillRect(FIELD.width - 10, 64, 10, FIELD.height - 64);
}

function drawBricks(ctx, world) {
  for (const brick of world.bricks) {
    if (!brick.alive) continue;
    const base = PALETTE[brick.colour] || PALETTE.brickPink;
    const isTough = brick.maxHp > 1;
    ctx.save();
    ctx.shadowColor = base;
    ctx.shadowBlur = brick.flash > 0 ? 26 : 12;
    ctx.fillStyle = isTough ? PALETTE.brickTough : base;
    roundRect(ctx, brick.x, brick.y, brick.width, brick.height, 6);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Glassy top highlight.
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    roundRect(ctx, brick.x + 3, brick.y + 3, brick.width - 6, 10, 5);
    ctx.fill();
    if (isTough) {
      // Inner core shows how many hits are left.
      ctx.fillStyle = PALETTE.brickToughCore;
      const coreWidth = (brick.width - 16) * (brick.hp / brick.maxHp);
      roundRect(ctx, brick.x + 8, brick.y + brick.height / 2 - 4, Math.max(6, coreWidth), 8, 4);
      ctx.fill();
    }
    if (brick.bonus) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 16px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', brick.x + brick.width / 2, brick.y + brick.height / 2 + 1);
    }
    ctx.restore();
  }
}

function drawPaddle(ctx, world) {
  const paddle = world.paddle;
  const wide = world.time < paddle.wideUntil;
  ctx.save();
  ctx.shadowColor = PALETTE.paddleGlow;
  ctx.shadowBlur = 22;
  const gradient = ctx.createLinearGradient(paddle.x, 0, paddle.x + paddle.width, 0);
  gradient.addColorStop(0, '#00b3ff');
  gradient.addColorStop(0.5, '#7df9ff');
  gradient.addColorStop(1, '#00b3ff');
  ctx.fillStyle = gradient;
  roundRect(ctx, paddle.x, paddle.y, paddle.width, paddle.height, 9);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  roundRect(ctx, paddle.x + 8, paddle.y + 3, paddle.width - 16, 5, 3);
  ctx.fill();
  if (wide) {
    ctx.font = `bold 12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText('WIDE', paddle.x + paddle.width / 2, paddle.y - 12);
  }
  ctx.restore();
}

function drawBalls(ctx, world) {
  for (const ball of world.balls) {
    // Motion trail.
    for (let i = 0; i < ball.trail.length; i += 1) {
      const point = ball.trail[i];
      ctx.globalAlpha = (i / ball.trail.length) * 0.35;
      ctx.fillStyle = PALETTE.ballGlow;
      ctx.beginPath();
      ctx.arc(point.x, point.y, ball.radius * (0.4 + 0.6 * (i / ball.trail.length)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.shadowColor = PALETTE.ballGlow;
    ctx.shadowBlur = 20;
    ctx.fillStyle = PALETTE.ball;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawPowerups(ctx, world) {
  for (const powerup of world.powerups) {
    const style = POWERUP_STYLE[powerup.type];
    const wobble = Math.sin(powerup.spin) * 3;
    ctx.save();
    ctx.translate(powerup.x + wobble, powerup.y);
    ctx.shadowColor = style.colour;
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#0d0620';
    ctx.strokeStyle = style.colour;
    ctx.lineWidth = 2;
    roundRect(ctx, -14, -14, 28, 28, 8);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = style.colour;
    ctx.font = `bold 17px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(style.label, 0, 1);
    ctx.restore();
  }
}

function drawParticles(ctx, world) {
  for (const particle of world.particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.colour;
    ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
  }
  ctx.globalAlpha = 1;
}

function drawFloaters(ctx, world) {
  ctx.save();
  ctx.font = `bold 18px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const floater of world.floaters) {
    ctx.globalAlpha = Math.max(0, floater.life / floater.maxLife);
    ctx.shadowColor = PALETTE.gold;
    ctx.shadowBlur = 10;
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText(floater.text, floater.x, floater.y);
  }
  ctx.restore();
}

function drawHud(ctx, world, best) {
  // Top bar.
  ctx.fillStyle = 'rgba(10,4,28,0.85)';
  ctx.fillRect(0, 0, FIELD.width, 64);
  ctx.fillStyle = PALETTE.panelEdge;
  ctx.fillRect(0, 62, FIELD.width, 2);

  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.font = `bold 15px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.textAlign = 'left';
  ctx.fillText('SCORE', 28, 22);
  ctx.fillText('LEVEL', 300, 22);
  ctx.fillText('BEST', 560, 22);
  ctx.font = `bold 26px ${FONT}`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(String(world.score), 28, 46);
  ctx.fillText(`${world.level} / ${LEVEL_COUNT}`, 300, 46);
  ctx.fillText(String(Math.max(best, world.score)), 560, 46);
  ctx.textAlign = 'right';
  ctx.font = `bold 15px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('LIVES', FIELD.width - 28, 22);
  // Lives as glowing hearts.
  for (let i = 0; i < world.lives; i += 1) {
    const x = FIELD.width - 40 - i * 30;
    ctx.save();
    ctx.shadowColor = PALETTE.danger;
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ff3b5c';
    ctx.font = '22px sans-serif';
    ctx.fillText('♥', x, 46);
    ctx.restore();
  }
  ctx.restore();

  // Combo badge.
  if (world.combo >= COMBO.step) {
    const mult = Math.min(COMBO.max, 1 + Math.floor(world.combo / COMBO.step));
    glowText(ctx, `COMBO x${mult}`, FIELD.width / 2, 92, `bold 20px ${FONT}`, PALETTE.gold, PALETTE.gold, 14);
  }

  // Transient centre message (power-up, level clear bonus).
  if (world.message && world.time < world.messageUntil) {
    const alpha = Math.min(1, (world.messageUntil - world.time) / 0.4);
    ctx.save();
    ctx.globalAlpha = alpha;
    glowText(ctx, world.message, FIELD.width / 2, 330, `bold 34px ${FONT_DISPLAY}`, PALETTE.gold, PALETTE.gold, 20);
    ctx.restore();
  }
}

function drawPanel(ctx, x, y, width, height) {
  ctx.save();
  ctx.fillStyle = 'rgba(13,6,32,0.88)';
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 2;
  ctx.shadowColor = PALETTE.panelEdge;
  ctx.shadowBlur = 24;
  roundRect(ctx, x, y, width, height, 18);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawTitle(ctx, world, best) {
  // Big logo over a live demo wall of bricks.
  glowText(ctx, 'NEON', FIELD.width / 2, 210, `92px ${FONT_DISPLAY}`, '#22e6ff', '#00b3ff', 34);
  glowText(ctx, 'BREAKER', FIELD.width / 2, 300, `92px ${FONT_DISPLAY}`, '#ff2e88', '#ff2e88', 34);
  ctx.save();
  ctx.font = `bold 22px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.fillText('Smash every brick. Keep the ball alive. Clear 5 levels to win.', FIELD.width / 2, 380);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `18px ${FONT}`;
  ctx.fillText('← → or mouse to move   •   SPACE / click to launch   •   P to pause   •   M to mute', FIELD.width / 2, 416);
  ctx.fillText('★ bricks drop power-ups:  W wide paddle   M multi-ball   S slow ball   + extra life', FIELD.width / 2, 446);
  ctx.restore();

  const pulse = 0.75 + 0.25 * Math.sin(world.time * 4);
  ctx.save();
  ctx.globalAlpha = pulse;
  glowText(ctx, 'CLICK OR PRESS SPACE TO PLAY', FIELD.width / 2, 520, `bold 26px ${FONT}`, PALETTE.gold, PALETTE.gold, 16);
  ctx.restore();

  if (best > 0) {
    ctx.save();
    ctx.font = `bold 18px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`BEST SCORE  ${best}`, FIELD.width / 2, 566);
    ctx.restore();
  }
}

function drawServeHint(ctx, world) {
  const pulse = 0.75 + 0.25 * Math.sin(world.time * 5);
  ctx.save();
  ctx.globalAlpha = pulse;
  glowText(
    ctx,
    world.level === 1 ? 'CLICK OR PRESS SPACE TO LAUNCH' : `LEVEL ${world.level} — ${LEVELS[world.level - 1].name}`,
    FIELD.width / 2,
    420,
    `bold 26px ${FONT}`,
    PALETTE.text,
    '#22e6ff',
    14,
  );
  ctx.restore();
}

function drawLevelClear(ctx, world) {
  drawPanel(ctx, FIELD.width / 2 - 330, 220, 660, 250);
  glowText(ctx, `LEVEL ${world.level} CLEAR!`, FIELD.width / 2, 290, `bold 44px ${FONT_DISPLAY}`, PALETTE.gold, PALETTE.gold, 22);
  ctx.save();
  ctx.font = `20px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(`Score ${world.score}   •   Lives ${world.lives}   •   Next: ${LEVELS[world.level].name}`, FIELD.width / 2, 350);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `18px ${FONT}`;
  ctx.fillText('Click or press SPACE for the next level', FIELD.width / 2, 408);
  ctx.restore();
}

function drawGameOver(ctx, world, best) {
  drawPanel(ctx, FIELD.width / 2 - 330, 190, 660, 300);
  glowText(ctx, 'GAME OVER', FIELD.width / 2, 262, `bold 56px ${FONT_DISPLAY}`, '#ff3b5c', '#ff3b5c', 26);
  ctx.save();
  ctx.font = `22px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(`Score  ${world.score}`, FIELD.width / 2, 330);
  ctx.fillText(`Best  ${Math.max(best, world.score)}`, FIELD.width / 2, 364);
  ctx.fillText(`Bricks smashed  ${world.bricksBroken}   •   Best combo  ${world.comboBest}`, FIELD.width / 2, 398);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `18px ${FONT}`;
  ctx.fillText('Press R or click to play again', FIELD.width / 2, 448);
  ctx.restore();
}

function drawVictory(ctx, world, best) {
  drawPanel(ctx, FIELD.width / 2 - 360, 170, 720, 330);
  glowText(ctx, '★ YOU WIN! ★', FIELD.width / 2, 244, `bold 54px ${FONT_DISPLAY}`, PALETTE.gold, PALETTE.gold, 28);
  ctx.save();
  ctx.font = `bold 24px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.fillText('All 5 levels cleared — the neon wall is yours!', FIELD.width / 2, 306);
  ctx.font = `22px ${FONT}`;
  ctx.fillText(`Final score  ${world.score}   •   Best  ${Math.max(best, world.score)}`, FIELD.width / 2, 348);
  ctx.fillText(`Bricks smashed  ${world.bricksBroken}   •   Balls lost  ${world.ballsLost}`, FIELD.width / 2, 382);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `18px ${FONT}`;
  ctx.fillText('Press R or click to play again', FIELD.width / 2, 446);
  ctx.restore();
}

function drawPaused(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(4,1,8,0.6)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  glowText(ctx, 'PAUSED', FIELD.width / 2, FIELD.height / 2 - 10, `bold 64px ${FONT_DISPLAY}`, PALETTE.text, '#22e6ff', 24);
  ctx.font = `20px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('Press P to resume', FIELD.width / 2, FIELD.height / 2 + 44);
  ctx.restore();
}

/**
 * Draw one frame. `screen` is the UI screen to overlay; the world itself is
 * always drawn underneath (title shows the demo wall, end screens show the
 * final field).
 */
export function draw(ctx, world, screen, best, paused) {
  ctx.save();
  ctx.clearRect(0, 0, FIELD.width, FIELD.height);
  if (world.shake > 0.2) {
    const magnitude = world.shake;
    ctx.translate((Math.random() - 0.5) * magnitude, (Math.random() - 0.5) * magnitude);
  }
  drawBackground(ctx, world);
  drawBricks(ctx, world);
  drawPowerups(ctx, world);
  drawParticles(ctx, world);
  if (screen !== SCREEN_TITLE) drawPaddle(ctx, world);
  drawBalls(ctx, world);
  drawFloaters(ctx, world);
  drawHud(ctx, world, best);
  ctx.restore();

  if (screen === SCREEN_TITLE) drawTitle(ctx, world, best);
  else if (screen === SCREEN_SERVE) drawServeHint(ctx, world);
  else if (screen === SCREEN_LEVEL_CLEAR) drawLevelClear(ctx, world);
  else if (screen === SCREEN_OVER) drawGameOver(ctx, world, best);
  else if (screen === SCREEN_WIN) drawVictory(ctx, world, best);
  if (paused) drawPaused(ctx);
}
