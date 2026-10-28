/**
 * Entry point: connects the game, the table view, the header and the input
 * handlers. The rules live in the pure modules; this file decides what a tap,
 * a drag or a key does and keeps the page in step with the game.
 */
import { ACE, KING, createDeck } from './cards.js';
import { FOUNDATION_IDS, TABLEAU_IDS, pileCards, randomDealNumber } from './board.js';
import { isLegalMove } from './rules.js';
import { createGame } from './game.js';
import { createDemoGame } from './demo.js';
import { createRng } from './rng.js';
import { computeLayout, dropZones, pickDropTarget } from './layout.js';
import { createTableView } from './view.js';
import { attachGestures } from './pointer.js';
import { grabAt } from './controls.js';
import { createKeyboard } from './keyboard.js';
import { createHud } from './hud.js';
import { createCelebration } from './celebrate.js';
import { searchWinnableDeal } from './winnable.js';
import { DEFAULT_LANGUAGE, normalizeLanguage, otherLanguage } from './i18n.js';
import { normalizeSettings, parseDealNumber, parseLaunchOptions } from './prefs.js';
import { readValue, writeValue } from './storage.js';

const AUTO_STEP_MS = 110;
const HINT_MS = 2600;
const TICK_MS = 250;

const byId = (id) => document.getElementById(id);
const dom = {
  wrap: byId('table-wrap'),
  table: byId('table'),
  fx: byId('fx'),
  newDeal: byId('new-deal'),
  restart: byId('restart'),
  undo: byId('undo'),
  hint: byId('hint'),
  auto: byId('auto'),
  playAgain: byId('play-again'),
  draw1: byId('draw-1'),
  draw3: byId('draw-3'),
  winnable: byId('winnable'),
  lang: byId('lang'),
  help: byId('help'),
  helpDialog: byId('help-dialog'),
  dealChip: byId('deal-number'),
  dealDialog: byId('deal-dialog'),
  dealForm: byId('deal-form'),
  dealInput: byId('deal-input'),
  dealCancel: byId('deal-cancel'),
};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const view = createTableView(dom.table);
const hud = createHud(document);
const celebration = createCelebration(dom.fx);

/**
 * How the game on the table was set up, so Restart and the draw buttons can set
 * it up again from its start.
 * @typedef {Object} Setup
 * @property {(drawCount: 1|3) => import('./game.js').Game} create
 * @property {StartOptions} options
 *
 * @typedef {Object} StartOptions
 * @property {boolean} [verified] the solver won this deal
 * @property {boolean} [instant] no dealing animation
 * @property {boolean} [holdClock] the clock waits for the first move (the demo)
 */

const app = {
  /** @type {import('./game.js').Game | null} */
  game: null,
  /** @type {Setup | null} */
  setup: null,
  /** @type {import('./layout.js').Layout | null} */
  layout: null,
  area: { width: 0, height: 0 },
  settings: normalizeSettings(readValue('settings', null)),
  language: normalizeLanguage(readValue('language', DEFAULT_LANGUAGE)),
  verified: false,
  searching: false,
  searchToken: 0,
  autoTimer: 0,
  hintTimer: 0,
  /** The demo keeps its clock still until the first move. */
  clockHeld: false,
  celebrated: false,
};

const keyboard = createKeyboard(document, {
  board: () => (isPlayable() ? app.game.getState().board : null),
  play: (move) => run(() => (app.game.move(move) ? move : null)),
  playBest: (pile, count) => run(() => app.game.autoMove(pile, count)),
  toFoundation: (pile) => run(() => app.game.moveToFoundation(pile)),
  shake: (cards) => view.shake(cards),
  render: () => render(),
  commands: {
    draw,
    undo,
    hint: showHint,
    newDeal: () => newDeal(),
    restart,
    autoComplete: startAuto,
  },
});

// ---- drawing ----

/** The whole deck in the stock, shown while the first deal is being looked for. */
function waitingBoard() {
  return {
    drawCount: app.settings.drawCount,
    stock: createDeck(),
    waste: [],
    foundations: FOUNDATION_IDS.map(() => []),
    tableau: TABLEAU_IDS.map(() => ({ cards: [], faceDown: 0 })),
  };
}

/** Draws the table and updates the header. */
function render(options = {}) {
  const state = app.game?.getState() ?? null;
  const board = state?.board ?? waitingBoard();
  app.area = { width: dom.wrap.clientWidth, height: dom.wrap.clientHeight };
  app.layout = computeLayout(app.area, board);
  view.render(app.layout, board, { ...options, lifted: keyboard.lifted(board) });
  view.showCursor(keyboard.cursorRect(app.layout, board));
  hud.showStats(state, app.verified);
  dom.undo.disabled = !state?.canUndo || state.won || app.searching;
  dom.auto.hidden = !state?.canAutoComplete || app.autoTimer !== 0 || app.searching;
}

const topCards = (pile, count) => pileCards(app.game.getState().board, pile).slice(-count);

// ---- playing ----

/** The table takes moves: a game is on, not won, and nothing runs by itself. */
function isPlayable() {
  return app.game !== null && !app.searching && app.autoTimer === 0 && !app.game.getState().won;
}

/**
 * Runs a game command; when it moved cards, the page follows.
 * @param {() => import('./rules.js').Move | null} command
 * @returns {boolean} true when cards moved
 */
function run(command) {
  if (!isPlayable()) return false;
  const move = command();
  if (move) afterMove();
  return Boolean(move);
}

function afterMove() {
  app.clockHeld = false;
  clearHint();
  keyboard.settle();
  render();
  const state = app.game.getState();
  if (state.won && !app.celebrated) celebrate(state);
}

function draw() {
  run(() => app.game.drawFromStock());
}

function undo() {
  stopAuto();
  if (!isPlayable() || !app.game.undo()) return;
  clearHint();
  keyboard.settle();
  render();
}

function showHint() {
  if (!isPlayable()) return;
  const move = app.game.hint();
  const { board } = app.game.getState();
  if (!move) {
    hud.toast('noHint');
  } else if (move.from === 'stock' || move.to === 'stock') {
    if (move.from === 'stock') hud.toast('hintDraw');
    else hud.toast('hintRecycle');
    markHint({ cards: board.stock.slice(-1), slots: ['stock'] });
  } else {
    const target = pileCards(board, move.to);
    markHint({
      cards: [...pileCards(board, move.from).slice(-move.count), ...target.slice(-1)],
      slots: target.length === 0 ? [move.to] : [],
    });
  }
}

function markHint(targets) {
  clearTimeout(app.hintTimer);
  view.mark('hint', targets);
  app.hintTimer = setTimeout(clearHint, HINT_MS);
}

function clearHint() {
  clearTimeout(app.hintTimer);
  view.mark('hint');
}

function startAuto() {
  if (!isPlayable() || !app.game.getState().canAutoComplete) return;
  clearHint();
  keyboard.hide();
  app.autoTimer = setTimeout(stepAuto, 0);
  render();
}

function stepAuto() {
  const move = app.game.autoCompleteStep();
  app.autoTimer = move && !app.game.getState().won ? setTimeout(stepAuto, AUTO_STEP_MS) : 0;
  if (move) afterMove();
  else render();
}

function stopAuto() {
  clearTimeout(app.autoTimer);
  app.autoTimer = 0;
}

/** Cards leap off the foundations; with reduced motion only the panel shows. */
function celebrate(state) {
  app.celebrated = true;
  keyboard.hide();
  view.showCursor(null);
  hud.showWin(state);
  if (reducedMotion.matches) return;
  const launches = [];
  for (let rank = KING; rank >= ACE; rank -= 1) {
    FOUNDATION_IDS.forEach((id, index) => {
      const { x, y } = app.layout.slots[id];
      launches.push({ card: state.board.foundations[index][rank - 1], x, y });
    });
  }
  celebration.start({
    launches,
    cardWidth: app.layout.cardWidth,
    cardHeight: app.layout.cardHeight,
    rankSize: app.layout.rankSize,
    random: createRng(state.deal),
  });
}

// ---- deals ----

/**
 * Puts a new game on the table, played with the current draw count.
 * @param {Setup['create']} create
 * @param {StartOptions} [options]
 */
function startGame(create, options = {}) {
  cancelSearch();
  stopAuto();
  celebration.stop();
  hud.hideWin();
  clearHint();
  keyboard.settle();
  app.setup = { create, options };
  app.game = create(app.settings.drawCount);
  app.verified = options.verified === true;
  app.clockHeld = options.holdClock === true;
  app.celebrated = false;
  render(options.instant ? { instant: true } : { deal: true });
}

/** Sets up a numbered deal. */
const dealNumber = (deal) => (drawCount) => createGame({ deal, drawCount });

function cancelSearch() {
  app.searchToken += 1;
  app.searching = false;
}

/** Deals a random game, or looks for a winnable one first when that option is on. */
async function newDeal() {
  const { drawCount, winnableOnly } = app.settings;
  const first = randomDealNumber();
  if (!winnableOnly) {
    startGame(dealNumber(first));
    return;
  }
  cancelSearch();
  stopAuto();
  const token = app.searchToken;
  app.searching = true;
  hud.toast('searching');
  render({ instant: app.game === null });
  const found = await searchWinnableDeal(first, {
    drawCount,
    pause: nextTask,
    isCancelled: () => token !== app.searchToken,
  });
  if (!found) return;
  startGame(dealNumber(found.deal), { verified: found.solved });
  if (found.solved) hud.hideToast();
  else hud.toast('notFound');
}

/** Lets the browser paint and handle input between two solver runs. */
function nextTask() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/** Sets the game up again from its start: a deal from its first card, the demo from its layout. */
function restart() {
  if (app.setup) startGame(app.setup.create, app.setup.options);
}

// ---- settings ----

function saveSettings(settings) {
  app.settings = settings;
  writeValue('settings', settings);
  syncSettings();
}

function syncSettings() {
  dom.draw1.setAttribute('aria-pressed', String(app.settings.drawCount === 1));
  dom.draw3.setAttribute('aria-pressed', String(app.settings.drawCount === 3));
  dom.winnable.checked = app.settings.winnableOnly;
}

/**
 * Nothing has been played on this table yet (the demo starts mid-game but
 * untouched), so a changed setting can apply at once.
 */
function isFresh() {
  return app.searching || (app.game !== null && !app.game.getState().canUndo);
}

/**
 * The game on the table always follows the draw buttons: a new draw count
 * starts the deal again with it. A deal the solver checked was only checked
 * for the old count, so with "winnable deals only" a new one is looked for.
 */
function setDrawCount(drawCount) {
  if (drawCount === app.settings.drawCount) return;
  const playing = !isFresh();
  saveSettings({ ...app.settings, drawCount });
  if (app.settings.winnableOnly || !app.setup) {
    newDeal();
    return;
  }
  startGame(app.setup.create, { ...app.setup.options, verified: false });
  if (playing) hud.toast('drawRestart', { count: drawCount });
}

function setWinnableOnly(winnableOnly) {
  saveSettings({ ...app.settings, winnableOnly });
  if (!winnableOnly) {
    if (app.searching) newDeal();
  } else if (isFresh()) {
    newDeal();
  } else {
    hud.toast('winnableLater');
  }
}

function setLanguage(language) {
  app.language = language;
  writeValue('language', language);
  hud.setLanguage(language);
}

function openDealDialog() {
  dom.dealInput.value = app.game ? String(app.game.getState().deal) : '';
  dom.dealInput.removeAttribute('aria-invalid');
  dom.dealDialog.showModal();
  dom.dealInput.select();
}

function submitDeal(event) {
  const deal = parseDealNumber(dom.dealInput.value);
  if (deal === null) {
    event.preventDefault();
    dom.dealInput.setAttribute('aria-invalid', 'true');
    dom.dealInput.focus();
    return;
  }
  startGame(dealNumber(deal));
}

// ---- pointer ----

/**
 * What a press takes hold of: a card with the cards it would carry, or a slot.
 * @param {EventTarget} target
 */
function grabTarget(target) {
  if (!isPlayable()) return null;
  const hit = view.locate(target);
  if (!hit) return null;
  if (keyboard.hide()) render();
  if ('pile' in hit) return { pile: hit.pile, card: null, take: null };
  const spot = app.layout.cards[hit.card];
  const take = grabAt(app.game.getState().board, spot.pile, spot.index);
  return { pile: spot.pile, card: hit.card, take };
}

function tapOn(held) {
  if (held.pile === 'stock') {
    draw();
  } else if (held.take) {
    const { pile, count } = held.take;
    if (!run(() => app.game.autoMove(pile, count))) view.shake(topCards(pile, count));
  }
}

/**
 * The second tap of a double-tap. The first tap already sent the card to its
 * best place, which is its foundation whenever it may go up, so only the stock
 * answers (a second draw); on a card it would move another card by accident.
 */
function secondTapOn(held) {
  if (held.pile === 'stock') draw();
}

/** The pile the dragged cards would land on, if the move is legal there. */
function dropTarget(held, dx, dy) {
  const { board } = app.game.getState();
  const { pile: from, count } = held.take;
  const spot = app.layout.cards[held.card];
  const rect = { x: spot.x + dx, y: spot.y + dy, width: app.layout.cardWidth, height: app.layout.cardHeight };
  const accepts = (to) => to !== from && isLegalMove(board, { from, to, count });
  return pickDropTarget(rect, dropZones(app.layout), accepts);
}

function dragTo(held, dx, dy) {
  clearHint();
  view.drag(topCards(held.take.pile, held.take.count), app.layout, dx, dy);
  const target = dropTarget(held, dx, dy);
  if (target === null) {
    view.mark('drop');
    return;
  }
  const cards = topCards(target, 1);
  view.mark('drop', cards.length > 0 ? { cards } : { slots: [target] });
}

function dropAt(held, dx, dy) {
  view.mark('drop');
  const to = dropTarget(held, dx, dy);
  const move = { from: held.take.pile, to, count: held.take.count };
  if (to === null || !run(() => (app.game.move(move) ? move : null))) render();
}

attachGestures(dom.table, {
  grab: grabTarget,
  canDrag: (held) => held.take !== null,
  tap: tapOn,
  doubleTap: secondTapOn,
  drag: dragTo,
  drop: dropAt,
  cancel() {
    view.mark('drop');
    render();
  },
});

// ---- page ----

dom.newDeal.addEventListener('click', () => newDeal());
dom.restart.addEventListener('click', restart);
dom.undo.addEventListener('click', undo);
dom.hint.addEventListener('click', showHint);
dom.auto.addEventListener('click', startAuto);
dom.playAgain.addEventListener('click', () => newDeal());
dom.draw1.addEventListener('click', () => setDrawCount(1));
dom.draw3.addEventListener('click', () => setDrawCount(3));
dom.winnable.addEventListener('change', () => setWinnableOnly(dom.winnable.checked));
dom.lang.addEventListener('click', () => setLanguage(otherLanguage(app.language)));
dom.help.addEventListener('click', () => dom.helpDialog.showModal());
dom.dealChip.addEventListener('click', openDealDialog);
dom.dealForm.addEventListener('submit', submitDeal);
dom.dealCancel.addEventListener('click', () => dom.dealDialog.close());

// Re-fit inside the observer callback itself, so the new layout is painted in
// the same frame as the size change.
new ResizeObserver(() => {
  const same = dom.wrap.clientWidth === app.area.width && dom.wrap.clientHeight === app.area.height;
  if (!same) render({ instant: true });
}).observe(dom.wrap);

let lastTick = performance.now();
setInterval(() => {
  const now = performance.now();
  const seconds = (now - lastTick) / 1000;
  lastTick = now;
  if (!app.game || app.clockHeld || document.hidden) return;
  app.game.update(seconds);
  hud.showTime(app.game.getState().elapsed);
}, TICK_MS);

function start() {
  hud.setLanguage(app.language);
  const launch = parseLaunchOptions(window.location.search);
  if (launch.drawCount !== null) app.settings = { ...app.settings, drawCount: launch.drawCount };
  syncSettings();
  if (launch.demo) {
    startGame(createDemoGame, { instant: true, holdClock: true });
  } else if (launch.deal !== null) {
    startGame(dealNumber(launch.deal));
  } else {
    newDeal();
  }
}

start();
