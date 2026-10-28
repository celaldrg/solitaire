/**
 * Win celebration: the cards leap off the foundations one after another and
 * bounce across the table, leaving trails on a canvas that is sized to its
 * container at the device pixel ratio.
 */
import { isRed, rankOf, suitOf } from './cards.js';
import { rankLabel } from './i18n.js';
import { SUIT_PATHS } from './suits.js';

/** Seconds between two launches. */
const LAUNCH_EVERY = 0.2;
/** Gravity in canvas heights per second squared. */
const GRAVITY = 2.4;
/** Share of the vertical speed a card keeps when it bounces. */
const BOUNCE = 0.74;
/** Longest time step, so a hidden tab does not make cards jump. */
const MAX_STEP = 0.05;
const FACE = '#f8fafc';
const EDGE = 'rgba(15, 23, 42, 0.35)';
const INK = Object.freeze({ red: '#c81e3a', black: '#0f172a' });
const COURT_FONT = 'Georgia, "Times New Roman", serif';
const INDEX_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/**
 * @typedef {Object} Launch
 * @property {number} card
 * @property {number} x where the card starts, in table pixels
 * @property {number} y
 *
 * @typedef {Object} CelebrationOptions
 * @property {Launch[]} launches in launch order
 * @property {number} cardWidth
 * @property {number} cardHeight
 * @property {number} rankSize font size of the corner index
 * @property {() => number} random seeded generator for the throws
 * @property {string} language prints the card indices in this language
 */

/**
 * Prepares the celebration on a canvas laid over the table.
 * @param {HTMLCanvasElement} canvas
 * @returns {{ start: (options: CelebrationOptions) => void, stop: () => void }}
 */
export function createCelebration(canvas) {
  const context = canvas.getContext('2d');
  const suits = SUIT_PATHS.map((path) => new Path2D(path));
  let frame = 0;

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    canvas.classList.remove('on');
  }

  function start(options) {
    stop();
    canvas.classList.add('on');
    const size = fitCanvas(canvas, context);
    const sprites = new Map();
    const spriteOf = (card) => {
      if (!sprites.has(card)) sprites.set(card, paintCard(card, options, size.ratio, suits));
      return sprites.get(card);
    };
    let flyers = [];
    let launched = 0;
    let clock = 0;
    let last = null;
    const step = (time) => {
      const dt = last === null ? 0 : Math.min(MAX_STEP, (time - last) / 1000);
      last = time;
      clock += dt;
      while (launched < options.launches.length && clock >= launched * LAUNCH_EVERY) {
        flyers.push(throwCard(options.launches[launched], size, options.random));
        launched += 1;
      }
      for (const flyer of flyers) {
        advance(flyer, dt, size, options.cardHeight);
        context.drawImage(spriteOf(flyer.card), flyer.x, flyer.y, options.cardWidth, options.cardHeight);
      }
      flyers = flyers.filter((flyer) => flyer.x + options.cardWidth > 0 && flyer.x < size.width);
      const busy = launched < options.launches.length || flyers.length > 0;
      frame = busy ? requestAnimationFrame(step) : 0;
    };
    frame = requestAnimationFrame(step);
  }

  return { start, stop };
}

function fitCanvas(canvas, context) {
  const { width, height } = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { width, height, ratio };
}

/** Throws a card sideways, mostly towards the wider side of the table. */
function throwCard({ card, x, y }, size, random) {
  const leftward = random() < (x > size.width / 2 ? 0.8 : 0.2);
  return {
    card,
    x,
    y,
    vx: (leftward ? -1 : 1) * (0.14 + random() * 0.2) * size.width,
    vy: -(0.05 + random() * 0.45) * size.height,
  };
}

function advance(flyer, dt, size, cardHeight) {
  flyer.vy += GRAVITY * size.height * dt;
  flyer.x += flyer.vx * dt;
  flyer.y += flyer.vy * dt;
  const floor = size.height - cardHeight;
  if (flyer.y > floor) {
    flyer.y = floor;
    flyer.vy = -Math.abs(flyer.vy) * BOUNCE;
  }
}

/** Draws a card face once into a small canvas at the device pixel ratio. */
function paintCard(card, { cardWidth: width, cardHeight: height, rankSize, language }, ratio, suits) {
  const sprite = document.createElement('canvas');
  sprite.width = Math.ceil(width * ratio);
  sprite.height = Math.ceil(height * ratio);
  const g = sprite.getContext('2d');
  g.scale(ratio, ratio);
  roundedRect(g, 0.5, 0.5, width - 1, height - 1, Math.max(4, width * 0.08));
  g.fillStyle = FACE;
  g.fill();
  g.strokeStyle = EDGE;
  g.stroke();
  g.fillStyle = isRed(card) ? INK.red : INK.black;
  g.font = `700 ${rankSize}px ${INDEX_FONT}`;
  g.textBaseline = 'top';
  const label = rankLabel(language, rankOf(card));
  g.fillText(label, width * 0.07, height * 0.05);
  const corner = rankSize * 0.8;
  const suit = suits[suitOf(card)];
  drawSuit(g, suit, width * 0.93 - corner, height * 0.06, corner);
  if (rankOf(card) > 10) {
    g.font = `700 ${width * 0.4}px ${COURT_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(label, width / 2, height * 0.62);
  } else {
    const big = width * 0.56;
    drawSuit(g, suit, (width - big) / 2, height * 0.6 - big / 2, big);
  }
  return sprite;
}

function drawSuit(g, path, x, y, size) {
  g.save();
  g.translate(x, y);
  g.scale(size / 100, size / 100);
  g.fill(path);
  g.restore();
}

function roundedRect(g, x, y, width, height, radius) {
  g.beginPath();
  g.moveTo(x + radius, y);
  g.arcTo(x + width, y, x + width, y + height, radius);
  g.arcTo(x + width, y + height, x, y + height, radius);
  g.arcTo(x, y + height, x, y, radius);
  g.arcTo(x, y, x + width, y, radius);
  g.closePath();
}
