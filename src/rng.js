/**
 * Seeded randomness. Every shuffle goes through an injectable `random`
 * function, so a deal number always produces the same layout and tests
 * stay deterministic.
 */

/**
 * Creates a seeded pseudo-random generator (mulberry32).
 * @param {number} seed any number; it is reduced to an unsigned 32-bit integer
 * @returns {() => number} generator returning floats in [0, 1)
 */
export function createRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Returns a shuffled copy of `items` (Fisher-Yates); the input is not changed.
 * @template T
 * @param {T[]} items
 * @param {() => number} random generator returning floats in [0, 1)
 * @returns {T[]}
 */
export function shuffle(items, random) {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
