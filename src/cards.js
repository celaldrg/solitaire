/**
 * Card encoding shared by every module.
 *
 * A card is an integer 0..51: `suit * 13 + (rank - 1)`, with suits
 * 0 clubs, 1 diamonds, 2 hearts, 3 spades and ranks 1 (Ace) .. 13 (King).
 * Plain integers keep boards small, cheap to copy and easy to compare.
 */

export const DECK_SIZE = 52;
export const RANKS_PER_SUIT = 13;
export const ACE = 1;
export const KING = 13;

export const CLUBS = 0;
export const DIAMONDS = 1;
export const HEARTS = 2;
export const SPADES = 3;

/** ASCII rank codes indexed by `rank - 1` (the UI prints i18n.rankLabel). */
const RANK_CODES = Object.freeze([
  'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K',
]);

const SUIT_LETTERS = 'CDHS';
const CODE_PATTERN = /^(A|[2-9]|10|J|Q|K)([CDHS])$/;

/**
 * Builds a card from a suit id and a rank.
 * @param {number} suit 0 clubs, 1 diamonds, 2 hearts, 3 spades
 * @param {number} rank 1 (Ace) .. 13 (King)
 * @returns {number}
 */
export function makeCard(suit, rank) {
  return suit * RANKS_PER_SUIT + rank - 1;
}

/**
 * @param {number} card
 * @returns {number} suit id 0..3
 */
export function suitOf(card) {
  return Math.floor(card / RANKS_PER_SUIT);
}

/**
 * @param {number} card
 * @returns {number} rank 1 (Ace) .. 13 (King)
 */
export function rankOf(card) {
  return (card % RANKS_PER_SUIT) + 1;
}

/**
 * @param {number} card
 * @returns {boolean} true for diamonds and hearts
 */
export function isRed(card) {
  const suit = suitOf(card);
  return suit === DIAMONDS || suit === HEARTS;
}

/**
 * ASCII code such as "10H" or "QS" (rank label + suit letter C, D, H or S).
 * @param {number} card
 * @returns {string}
 */
export function cardCode(card) {
  return RANK_CODES[rankOf(card) - 1] + SUIT_LETTERS[suitOf(card)];
}

/**
 * Parses a code made by cardCode.
 * @param {string} code
 * @returns {number}
 * @throws {RangeError} when the code is not a card
 */
export function parseCard(code) {
  const match = CODE_PATTERN.exec(code);
  if (!match) throw new RangeError(`Unknown card code: ${code}`);
  return makeCard(SUIT_LETTERS.indexOf(match[2]), RANK_CODES.indexOf(match[1]) + 1);
}

/**
 * A full deck in a fixed order (clubs Ace..King, then diamonds, hearts, spades).
 * @returns {number[]}
 */
export function createDeck() {
  return Array.from({ length: DECK_SIZE }, (_, card) => card);
}
