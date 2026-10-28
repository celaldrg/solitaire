import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACE, CLUBS, DECK_SIZE, DIAMONDS, HEARTS, KING, RANK_LABELS, SPADES, SUIT_SYMBOLS,
  cardCode, cardLabel, createDeck, isRed, makeCard, parseCard, rankOf, suitOf,
} from '../src/cards.js';

test('a deck holds 52 distinct cards, Ace to King in every suit', () => {
  const deck = createDeck();
  assert.equal(deck.length, DECK_SIZE);
  assert.equal(new Set(deck).size, DECK_SIZE);
  for (const suit of [CLUBS, DIAMONDS, HEARTS, SPADES]) {
    const ranks = deck.filter((card) => suitOf(card) === suit).map(rankOf);
    assert.deepEqual(ranks, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  }
});

test('makeCard, suitOf and rankOf round-trip', () => {
  for (const suit of [CLUBS, DIAMONDS, HEARTS, SPADES]) {
    for (let rank = ACE; rank <= KING; rank += 1) {
      const card = makeCard(suit, rank);
      assert.equal(suitOf(card), suit);
      assert.equal(rankOf(card), rank);
    }
  }
});

test('diamonds and hearts are red, clubs and spades are black', () => {
  assert.equal(isRed(makeCard(DIAMONDS, 5)), true);
  assert.equal(isRed(makeCard(HEARTS, KING)), true);
  assert.equal(isRed(makeCard(CLUBS, ACE)), false);
  assert.equal(isRed(makeCard(SPADES, 10)), false);
});

test('rank labels and suit symbols are indexed by rank - 1 and suit id', () => {
  assert.deepEqual([...SUIT_SYMBOLS], ['♣', '♦', '♥', '♠']);
  assert.equal(RANK_LABELS.length, 13);
  assert.equal(RANK_LABELS[ACE - 1], 'A');
  assert.equal(RANK_LABELS[KING - 1], 'K');
});

test('labels use suit symbols, codes use suit letters', () => {
  assert.equal(cardLabel(makeCard(HEARTS, 10)), '10♥');
  assert.equal(cardLabel(makeCard(SPADES, ACE)), 'A♠');
  assert.equal(cardCode(makeCard(CLUBS, 12)), 'QC');
  assert.equal(cardCode(makeCard(DIAMONDS, 7)), '7D');
});

test('parseCard reads every code and rejects anything else', () => {
  for (const card of createDeck()) assert.equal(parseCard(cardCode(card)), card);
  for (const bad of ['', '1H', '11S', 'KX', 'qh', '10', 'H10', ' AS']) {
    assert.throws(() => parseCard(bad), RangeError, bad);
  }
});
