/**
 * Чистая бизнес-логика: выбор следующей карточки с учётом весов отметок.
 * Никаких DOM, никаких хранилищ, никаких побочных эффектов — только данные.
 */

/** @typedef {'unknown'|'hard'|'easy'|'known'} Rating */

/** @typedef {Object} KanjiItem
 * @property {string} kanji
 * @property {string} meaning
 * @property {string[]} onyomi
 * @property {string[]} kunyomi
 * @property {Example[]} examples
 */

/** @typedef {Object} Example
 * @property {string} word
 * @property {string} reading
 * @property {string} meaning
 */

/** @typedef {Object} Candidate
 * @property {number} index
 * @property {string} kanji
 * @property {Rating} rating
 */

/** Веса отметок: чем выше, тем чаще попадается */
export const WEIGHTS = {
  unknown: 4,
  hard: 3,
  easy: 2,
  known: 1
};

/**
 * Фильтрует кандзи по текущему фильтру и добавляет рейтинг из прогресса.
 * @param {KanjiItem[]} allKanji
 * @param {Object<string, Rating>} progress
 * @param {'all'|'unknown'|'hard'|'easy'|'known'} filter
 * @returns {Candidate[]}
 */
export function getFilteredCandidates(allKanji, progress, filter) {
  return allKanji
    .map((k, i) => ({
      index: i,
      kanji: k.kanji,
      rating: progress[k.kanji] || 'unknown'
    }))
    .filter(item => filter === 'all' || item.rating === filter);
}

/**
 * Взвешенный случайный выбор индекса следующей карточки.
 * @param {Candidate[]} candidates
 * @param {number} lastShownIndex - индекс последней показанной карточки (для защиты от дублей)
 * @returns {number} индекс в исходном массиве allKanji, или -1 если кандидатов нет
 */
export function pickNextIndex(candidates, lastShownIndex = -1) {
  if (candidates.length === 0) return -1;

  // Если только одна карточка — возвращаем её
  if (candidates.length === 1) return candidates[0].index;

  // Взвешенный выбор
  const totalWeight = candidates.reduce((sum, c) => sum + WEIGHTS[c.rating], 0);
  let random = Math.random() * totalWeight;

  for (const c of candidates) {
    random -= WEIGHTS[c.rating];
    if (random <= 0) {
      // Защита от дубля подряд
      if (c.index === lastShownIndex && candidates.length > 1) {
        const others = candidates.filter(x => x.index !== lastShownIndex);
        const otherWeights = others.reduce((s, x) => s + WEIGHTS[x.rating], 0);
        let r2 = Math.random() * otherWeights;
        for (const o of others) {
          r2 -= WEIGHTS[o.rating];
          if (r2 <= 0) return o.index;
        }
        return others[0].index; // фоллбэк
      }
      return c.index;
    }
  }

  return candidates[0].index; // фоллбэк (не должно случиться)
}

/**
 * Главная функция: выбрать следующий кандзи.
 * @param {Object} params
 * @param {KanjiItem[]} params.allKanji
 * @param {Object<string, Rating>} params.progress
 * @param {'all'|'unknown'|'hard'|'easy'|'known'} params.filter
 * @param {number} params.lastShownIndex
 * @returns {number} индекс в allKanji, или -1
 */
export function selectNextKanji({ allKanji, progress, filter, lastShownIndex }) {
  const candidates = getFilteredCandidates(allKanji, progress, filter);
  return pickNextIndex(candidates, lastShownIndex);
}