/**
 * Suit artwork shared by the card faces (SVG) and the win animation (canvas):
 * one SVG path per suit in a 100 x 100 box, indexed by suit id
 * (0 clubs, 1 diamonds, 2 hearts, 3 spades). All subpaths wind the same way,
 * so the default non-zero fill rule fills every overlap.
 */
export const SUIT_PATHS = Object.freeze([
  // Clubs: three leaves, a filler between them and a flared stem.
  'M31 27A19 19 0 1 0 69 27A19 19 0 1 0 31 27Z'
    + 'M9 58A19 19 0 1 0 47 58A19 19 0 1 0 9 58Z'
    + 'M53 58A19 19 0 1 0 91 58A19 19 0 1 0 53 58Z'
    + 'M50 40L38 56L50 64L62 56Z'
    + 'M46 55C46 75 42 86 34 95L66 95C58 86 54 75 54 55Z',
  // Diamonds: a lozenge with gently curved sides.
  'M50 4C60 22 72 36 88 50C72 64 60 78 50 96C40 78 28 64 12 50C28 36 40 22 50 4Z',
  // Hearts.
  'M50 90C46 84 6 58 6 32C6 17 17 7 30 7C39 7 46 12 50 21'
    + 'C54 12 61 7 70 7C83 7 94 17 94 32C94 58 54 84 50 90Z',
  // Spades: an upturned heart on a flared stem.
  'M50 5C58 22 92 38 92 60C92 74 82 82 70 82C62 82 56 78 53 72C54 82 58 89 66 95L34 95'
    + 'C42 89 46 82 47 72C44 78 38 82 30 82C18 82 8 74 8 60C8 38 42 22 50 5Z',
]);
