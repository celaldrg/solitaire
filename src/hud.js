/**
 * Everything written around the table: the translated page texts, the header
 * stats and deal number, the toast and the win panel.
 *
 * Static texts carry `data-i18n` (text), `data-i18n-title` (tooltip) or
 * `data-i18n-label` (aria-label) with a key from i18n.js.
 */
import { formatTime, otherLanguage, translate } from './i18n.js';

const TOAST_MS = 2800;

/**
 * Finds the text elements of the page by id.
 * @param {Document} doc
 */
export function createHud(doc) {
  const byId = (id) => doc.getElementById(id);
  const el = {
    score: byId('score'),
    moves: byId('moves'),
    time: byId('time'),
    deal: byId('deal-value'),
    verified: byId('verified'),
    lang: byId('lang'),
    toast: byId('toast'),
    win: byId('win'),
    winStats: byId('win-stats'),
  };
  let language = 'en';
  let winState = null;
  let toastTimer = 0;

  function hideToast() {
    clearTimeout(toastTimer);
    el.toast.classList.remove('on');
  }

  function writeWinStats() {
    el.winStats.textContent = translate(language, 'winStats', {
      score: winState.score,
      moves: winState.moves,
      time: formatTime(winState.elapsed),
    });
  }

  function translatePage() {
    doc.documentElement.lang = language;
    doc.title = translate(language, 'title');
    for (const node of doc.querySelectorAll('[data-i18n]')) {
      node.textContent = translate(language, node.dataset.i18n);
    }
    for (const node of doc.querySelectorAll('[data-i18n-title]')) {
      node.title = translate(language, node.dataset.i18nTitle);
    }
    for (const node of doc.querySelectorAll('[data-i18n-label]')) {
      node.setAttribute('aria-label', translate(language, node.dataset.i18nLabel));
    }
    el.lang.textContent = otherLanguage(language).toUpperCase();
  }

  return {
    /**
     * Shows the page in a language.
     * @param {'en'|'tr'} next
     */
    setLanguage(next) {
      language = next;
      translatePage();
      hideToast();
      if (winState) writeWinStats();
    },

    /**
     * Updates score, moves, time and the deal number.
     * @param {import('./game.js').GameState | null} state null before the first deal
     * @param {boolean} verified the solver has won this deal
     */
    showStats(state, verified) {
      el.score.textContent = String(state?.score ?? 0);
      el.moves.textContent = String(state?.moves ?? 0);
      el.time.textContent = formatTime(state?.elapsed ?? 0);
      el.deal.textContent = state ? `#${state.deal}` : '#…';
      el.verified.hidden = !verified;
    },

    /**
     * Updates only the clock.
     * @param {number} seconds
     */
    showTime(seconds) {
      const text = formatTime(seconds);
      if (el.time.textContent !== text) el.time.textContent = text;
    },

    /**
     * Shows a short message under the table.
     * @param {string} key i18n key
     * @param {Object<string, string|number>} [params]
     */
    toast(key, params) {
      clearTimeout(toastTimer);
      el.toast.textContent = translate(language, key, params);
      el.toast.classList.add('on');
      toastTimer = setTimeout(hideToast, TOAST_MS);
    },

    hideToast,

    /**
     * Opens the win panel.
     * @param {import('./game.js').GameState} state
     */
    showWin(state) {
      winState = state;
      writeWinStats();
      el.win.hidden = false;
    },

    hideWin() {
      winState = null;
      el.win.hidden = true;
    },
  };
}
