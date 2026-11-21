/**
 * Чистая бизнес-логика: расчёт сводки счётчиков прогресса.
 * Никаких DOM, никаких хранилищ — только данные.
 */

/** @typedef {'unknown'|'hard'|'easy'|'known'} Rating */

/** @typedef {Object} KanjiItem
 * @property {string} kanji
 * @property {string} meaning
 * @property {string[]} onyomi
 * @property {string[]} kunyomi
 * @property {Example[]} examples
 */

/** @typedef {Object} SummaryCounts
 * @property {number} unknown
 * @property {number} hard
 * @property {number} easy
 * @property {number} known
 */

/**
 * Вычисляет счётчики по отметкам.
 * Карточки без прогресса считаются 'unknown'.
 * @param {KanjiItem[]} allKanji
 * @param {Object<string, Rating>} progress
 * @returns {SummaryCounts}
 */
export function computeSummary(allKanji, progress) {
  const counts = { unknown: 0, hard: 0, easy: 0, known: 0 };

  for (const rating of Object.values(progress)) {
    if (counts[rating] !== undefined) counts[rating]++;
  }

  // Карточки без прогресса считаются 'unknown'
  const withoutProgress = allKanji.length - Object.keys(progress).length;
  if (withoutProgress > 0) counts.unknown += withoutProgress;

  return counts;
}

/**
 * Форматирует сводку в строку для UI.
 * @param {SummaryCounts} counts
 * @returns {string}
 */
export function formatSummary(counts) {
  return `Не знаю: ${counts.unknown} | Трудно: ${counts.hard} | Легко: ${counts.easy} | Знаю: ${counts.known}`;
}