/**
 * Player preferences and the start-up options read from the page address.
 */
import { MAX_DEAL, normalizeDrawCount } from './board.js';

/** @typedef {{ drawCount: 1|3, winnableOnly: boolean }} Settings */

/** @type {Readonly<Settings>} */
export const DEFAULT_SETTINGS = Object.freeze({ drawCount: 1, winnableOnly: false });

/**
 * Turns a stored value into valid settings; anything unexpected becomes the default.
 * @param {unknown} raw
 * @returns {Settings}
 */
export function normalizeSettings(raw) {
  const value = raw !== null && typeof raw === 'object' ? raw : DEFAULT_SETTINGS;
  return {
    drawCount: normalizeDrawCount(value.drawCount),
    winnableOnly: value.winnableOnly === true,
  };
}

/**
 * Parses a deal number typed by the player or given in the address.
 * @param {unknown} text
 * @returns {number | null} an integer in 1..MAX_DEAL, or null
 */
export function parseDealNumber(text) {
  const digits = String(text ?? '').trim();
  if (!/^\d{1,7}$/.test(digits)) return null;
  const deal = Number(digits);
  return deal >= 1 && deal <= MAX_DEAL ? deal : null;
}

/**
 * Reads the start-up options: `?demo` shows the fixed screenshot layout and
 * `?deal=123` (with an optional `&draw=3`) replays a deal.
 * @param {string} search a query string such as `location.search`
 * @returns {{ demo: boolean, deal: number | null, drawCount: 1|3|null }}
 */
export function parseLaunchOptions(search) {
  const params = new URLSearchParams(search);
  return {
    demo: params.has('demo'),
    deal: parseDealNumber(params.get('deal')),
    drawCount: params.has('draw') ? normalizeDrawCount(Number(params.get('draw'))) : null,
  };
}
