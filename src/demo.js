/**
 * The fixed mid-game layout shown with the `?demo` query parameter (used for
 * the README screenshot): long alternating runs, a few hidden cards left and
 * eleven cards already on the foundations.
 */
import { boardFromCodes } from './board.js';
import { createGame } from './game.js';

/** Deal number shown with the demo layout. */
export const DEMO_DEAL = 2026;

const DEMO_LAYOUT = Object.freeze({
  stock: ['7C', '3D', 'JS', '9H', '6D', 'KC', '5S'],
  waste: ['8S', 'QH', '4C'],
  foundations: [
    ['AH', '2H', '3H', '4H'],
    ['AS', '2S', '3S'],
    ['AD', '2D'],
    ['AC', '2C'],
  ],
  tableau: [
    { up: ['KS', 'QD', 'JC', '10H', '9S', '8H'] },
    { up: ['KH', 'QC', 'JD', '10C'] },
    { down: ['6H'], up: ['9D', '8C'] },
    { down: ['10D'], up: ['QS', 'JH', '10S'] },
    { down: ['3C', '8D'], up: ['7D', '6S'] },
    { down: ['7S', '4D', '9C'], up: ['5H'] },
    { down: ['5D', '4S', '7H', '6C', '5C'], up: ['KD'] },
  ],
});

/**
 * The demo board (a new copy on every call).
 * @param {number} [drawCount=1] 1 or 3
 * @returns {import('./board.js').Board}
 */
export function createDemoBoard(drawCount = 1) {
  return boardFromCodes({ ...DEMO_LAYOUT, drawCount });
}

/**
 * A game on the demo board with plausible score, moves and time; still playable.
 * @param {number} [drawCount=1] 1 or 3
 * @returns {import('./game.js').Game}
 */
export function createDemoGame(drawCount = 1) {
  return createGame({
    deal: DEMO_DEAL,
    board: createDemoBoard(drawCount),
    score: 175,
    moves: 64,
    elapsed: 287,
  });
}
