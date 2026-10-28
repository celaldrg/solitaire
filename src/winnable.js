/**
 * "Winnable deals only": tries deal numbers one solver run at a time and
 * awaits a pause between runs, so the page stays responsive while it searches.
 */
import { MAX_DEAL } from './board.js';
import { findWinnableDeal } from './solver.js';

/**
 * Finds the first deal from `firstDeal` upwards (wrapping after MAX_DEAL) that
 * the solver wins within its node limit.
 * @param {number} firstDeal deal number in 1..MAX_DEAL
 * @param {Object} [options]
 * @param {number} [options.drawCount=1]
 * @param {number} [options.nodeLimit=10000] per deal
 * @param {number} [options.maxAttempts=20]
 * @param {() => Promise<void>} [options.pause] awaited between two attempts
 * @param {() => boolean} [options.isCancelled] checked before every attempt
 * @returns {Promise<{ deal: number, solved: boolean, attempts: number } | null>}
 *   null when cancelled; when no deal is solved, `deal` is `firstDeal`
 */
export async function searchWinnableDeal(firstDeal, {
  drawCount = 1,
  nodeLimit = 10000,
  maxAttempts = 20,
  pause = () => Promise.resolve(),
  isCancelled = () => false,
} = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) await pause();
    if (isCancelled()) return null;
    const deal = wrapDeal(firstDeal + attempt);
    if (findWinnableDeal(deal, { drawCount, nodeLimit, maxAttempts: 1 }).solved) {
      return { deal, solved: true, attempts: attempt + 1 };
    }
  }
  return { deal: firstDeal, solved: false, attempts: maxAttempts };
}

function wrapDeal(deal) {
  return deal > MAX_DEAL ? deal - MAX_DEAL : deal;
}
