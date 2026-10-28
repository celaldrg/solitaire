/**
 * The only door to localStorage. Every access is wrapped in try/catch, so a
 * private window, blocked storage or a full quota never breaks the game: reads
 * fall back to a default and writes are skipped.
 */

const PREFIX = 'solitaire:';

/** The page's localStorage, looked up on use and never at import time. */
function pageStorage() {
  return globalThis.localStorage;
}

/**
 * Reads a JSON value.
 * @template T
 * @param {string} key
 * @param {T} fallback returned when the value is missing, unreadable or storage fails
 * @param {Pick<Storage, 'getItem'>} [backend] defaults to localStorage
 * @returns {T | unknown} the stored value (callers validate it) or `fallback`
 */
export function readValue(key, fallback, backend) {
  try {
    const raw = (backend ?? pageStorage()).getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Writes a JSON value.
 * @param {string} key
 * @param {unknown} value
 * @param {Pick<Storage, 'setItem'>} [backend] defaults to localStorage
 * @returns {boolean} false when storage is unavailable
 */
export function writeValue(key, value, backend) {
  try {
    (backend ?? pageStorage()).setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
