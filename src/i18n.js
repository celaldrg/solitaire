/**
 * Every user-facing string in English and Turkish, plus the formatter for the
 * game clock. Placeholders look like `{name}`.
 */

export const LANGUAGES = Object.freeze(['en', 'tr']);
export const DEFAULT_LANGUAGE = 'en';

const EN = Object.freeze({
  title: 'Klondike Solitaire',
  newDeal: 'New deal',
  newDealTip: 'Deal a new game (N)',
  restart: 'Restart',
  restartTip: 'Restart this deal (R)',
  undo: 'Undo',
  undoTip: 'Undo the last move (U)',
  hint: 'Hint',
  hintTip: 'Show a useful move (H)',
  drawGroup: 'Cards per draw',
  drawOne: 'Draw 1',
  drawThree: 'Draw 3',
  winnable: 'Winnable deals only',
  winnableTip: 'New deals are checked by the solver first',
  help: 'How to play',
  switchLanguage: 'TR – switch to Turkish',
  deal: 'Deal',
  dealTip: 'Play a deal by its number',
  verified: 'winnable',
  verifiedTip: 'The solver found a way to win this deal',
  score: 'Score',
  moves: 'Moves',
  time: 'Time',
  table: 'Card table',
  autoComplete: 'Auto-complete',
  noHint: 'No useful move found. Undo or try a new deal.',
  hintDraw: 'Draw from the stock.',
  hintRecycle: 'Turn the waste back over.',
  searching: 'Looking for a winnable deal…',
  notFound: 'No winnable deal found quickly, so this one is random.',
  drawLater: 'Draw {count} starts with the next deal.',
  winnableLater: 'Winnable deals start with the next deal.',
  winTitle: 'You won!',
  winStats: '{score} points · {moves} moves · {time}',
  playAgain: 'Play again',
  dealTitle: 'Play a deal by number',
  dealLabel: 'Deal number (1–999999)',
  play: 'Play',
  cancel: 'Cancel',
  helpTitle: 'How to play',
  helpGoal: 'Move all 52 cards to the four foundations, building each suit up from Ace to King.',
  helpTableau: 'On the seven piles, build down in alternating colors. '
    + 'Only a King, or a run led by a King, fills an empty pile.',
  helpTouch: 'Tap or click a card to send it to its best spot (its foundation whenever it can go up), '
    + 'or drag a card or a whole run. A double-tap or double-click counts as one tap, so the card that turns up stays put.',
  helpStock: 'Tap the stock to draw; when it runs out, tap it again to turn the waste over.',
  helpScore: 'Score: waste to pile 5, to a foundation 10, turning a card over 5, '
    + 'foundation back to a pile −15.',
  helpKeys: 'Keyboard',
  capSpace: 'Space',
  capEnter: 'Enter',
  capEsc: 'Esc',
  keyArrows: 'Move between piles; ↑ and ↓ take more or fewer cards',
  keySpace: 'Pick up, then put down',
  keyEnter: 'Best move for the selected cards',
  keyFoundation: 'Send to a foundation',
  keyDraw: 'Draw from the stock',
  keyUndo: 'Undo',
  keyHint: 'Hint',
  keyDeal: 'New deal / restart',
  keyAuto: 'Auto-complete',
  keyCancel: 'Put the cards back',
  close: 'Close',
  footer: 'MIT · Source on GitHub',
});

const TR = Object.freeze({
  title: 'Klondike Solitaire',
  newDeal: 'Yeni el',
  newDealTip: 'Yeni bir el dağıt (N)',
  restart: 'Baştan',
  restartTip: 'Bu eli baştan başlat (R)',
  undo: 'Geri al',
  undoTip: 'Son hamleyi geri al (U)',
  hint: 'İpucu',
  hintTip: 'Yararlı bir hamle göster (H)',
  drawGroup: 'Her çekişte kart sayısı',
  drawOne: '1 kart',
  drawThree: '3 kart',
  winnable: 'Yalnız çözülebilir eller',
  winnableTip: 'Yeni eller önce çözücüyle denenir',
  help: 'Nasıl oynanır',
  switchLanguage: 'EN – İngilizceye geç',
  deal: 'El',
  dealTip: 'Numarasıyla bir el oyna',
  verified: 'çözülebilir',
  verifiedTip: 'Çözücü bu eli kazanmanın bir yolunu buldu',
  score: 'Puan',
  moves: 'Hamle',
  time: 'Süre',
  table: 'Kart masası',
  autoComplete: 'Otomatik bitir',
  noHint: 'Yararlı hamle bulunamadı. Geri al ya da yeni bir el dene.',
  hintDraw: 'Desteden kart çek.',
  hintRecycle: 'Açık kartları desteye çevir.',
  searching: 'Çözülebilir bir el aranıyor…',
  notFound: 'Kısa sürede çözülebilir el bulunamadı; bu el rastgele.',
  drawLater: 'Her çekişte {count} kart bir sonraki elde başlar.',
  winnableLater: 'Çözülebilir eller bir sonraki elde başlar.',
  winTitle: 'Kazandın!',
  winStats: '{score} puan · {moves} hamle · {time}',
  playAgain: 'Tekrar oyna',
  dealTitle: 'Numarayla el oyna',
  dealLabel: 'El numarası (1–999999)',
  play: 'Oyna',
  cancel: 'Vazgeç',
  helpTitle: 'Nasıl oynanır',
  helpGoal: '52 kartın hepsini dört temele taşı; her türü As\'tan Papaz\'a kadar sırayla diz.',
  helpTableau: 'Yedi sütunda kartları büyükten küçüğe, renkleri değiştirerek diz. '
    + 'Boş sütuna yalnızca Papaz ya da Papazla başlayan bir dizi konur.',
  helpTouch: 'Bir karta dokun ya da tıkla, en iyi yerine gitsin (temele çıkabiliyorsa temeline); '
    + 'istersen kartı ya da diziyi sürükle. Çift dokunuş ya da çift tıklama tek dokunuş sayılır, altından açılan kart yerinde kalır.',
  helpStock: 'Kart çekmek için desteye dokun; deste bitince açık kartları çevirmek için yine dokun.',
  helpScore: 'Puan: açık karttan sütuna 5, temele 10, kapalı kartı açmak 5, temelden sütuna −15.',
  helpKeys: 'Klavye',
  capSpace: 'Boşluk',
  capEnter: 'Enter',
  capEsc: 'Esc',
  keyArrows: 'Sütunlar arasında gez; ↑ ve ↓ daha çok ya da daha az kart alır',
  keySpace: 'Kartı al, sonra bırak',
  keyEnter: 'Seçili kartlar için en iyi hamle',
  keyFoundation: 'Temele gönder',
  keyDraw: 'Desteden çek',
  keyUndo: 'Geri al',
  keyHint: 'İpucu',
  keyDeal: 'Yeni el / baştan',
  keyAuto: 'Otomatik bitir',
  keyCancel: 'Kartları geri bırak',
  close: 'Kapat',
  footer: 'MIT · Kaynak kodu GitHub\'da',
});

/** Strings by language code. */
export const STRINGS = Object.freeze({ en: EN, tr: TR });

/**
 * Card indices by language, indexed by `rank - 1`. Turkish decks print
 * V (Vale), K (Kız) and P (Papaz) for the jack, queen and king.
 */
const RANK_INDICES = Object.freeze({
  en: Object.freeze(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']),
  tr: Object.freeze(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'K', 'P']),
});

/**
 * The index printed on a card of this rank.
 * @param {string} language
 * @param {number} rank 1 (Ace) .. 13 (King)
 * @returns {string}
 */
export function rankLabel(language, rank) {
  return RANK_INDICES[normalizeLanguage(language)][rank - 1];
}

/**
 * @param {unknown} value a stored or requested language code
 * @returns {'en'|'tr'} the code when supported, otherwise English
 */
export function normalizeLanguage(value) {
  return LANGUAGES.includes(value) ? value : DEFAULT_LANGUAGE;
}

/**
 * The language the toggle button switches to.
 * @param {string} language
 * @returns {'en'|'tr'}
 */
export function otherLanguage(language) {
  return normalizeLanguage(language) === 'en' ? 'tr' : 'en';
}

/**
 * Looks up a string and fills in its `{name}` placeholders.
 * @param {string} language
 * @param {string} key
 * @param {Object<string, string|number>} [params]
 * @returns {string} the English text when the key is missing in `language`, the key when unknown
 */
export function translate(language, key, params = {}) {
  const text = STRINGS[normalizeLanguage(language)][key] ?? EN[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

/**
 * Formats a duration for the game clock: "4:07", or "1:02:03" from one hour on.
 * @param {number} seconds
 * @returns {string}
 */
export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total / 60) % 60;
  const rest = String(total % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}
