/**
 * Проверка структуры kanji.json до заливки в Supabase.
 * Запуск: node scripts/validate-kanji.mjs  (или pnpm validate:kanji)
 *
 * Проверяет: валидность JSON, обязательные поля, один символ-кандзи,
 * уникальность, катакану в onyomi, хирагану в kunyomi и примерах,
 * наличие кандзи внутри слова-примера.
 */
import { readFileSync } from 'node:fs';

const REQUIRED_KEYS = ['kanji', 'meaning', 'onyomi', 'kunyomi', 'examples'];
const EXAMPLE_KEYS = ['word', 'reading', 'meaning'];
const KATAKANA = /^[\u30A0-\u30FF\u30FC\u30FB]+$/u; // катакана, ー, ・
const HIRAGANA = /^[\u3040-\u309F\u30FC]+$/u; // хирагана, ー
const KANJI_CHAR = /^\p{Script=Han}$/u;

const problems = [];
const warnings = [];

const fail = (path, message) => problems.push(`${path}: ${message}`);
const warn = (path, message) => warnings.push(`${path}: ${message}`);

let data;
try {
  data = JSON.parse(readFileSync(new URL('../kanji.json', import.meta.url), 'utf8'));
} catch (error) {
  console.error(`✗ kanji.json не парсится как JSON: ${error.message}`);
  process.exit(1);
}

if (!Array.isArray(data)) {
  console.error('✗ Корень kanji.json должен быть массивом.');
  process.exit(1);
}
if (data.length === 0) {
  console.error('✗ Массив кандзи пуст.');
  process.exit(1);
}

const seenKanji = new Map();

data.forEach((item, index) => {
  const at = `[${index}] ${item?.kanji ?? '?'}`;

  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    fail(at, 'элемент должен быть объектом');
    return;
  }

  const keys = Object.keys(item);
  for (const key of REQUIRED_KEYS) {
    if (!keys.includes(key)) fail(at, `нет поля "${key}"`);
  }
  for (const key of keys) {
    if (!REQUIRED_KEYS.includes(key)) fail(at, `лишнее поле "${key}"`);
  }

  // kanji
  if (typeof item.kanji !== 'string' || !KANJI_CHAR.test(item.kanji)) {
    fail(at, '"kanji" должен быть строкой из одного иероглифа');
  } else if (seenKanji.has(item.kanji)) {
    fail(at, `дубликат "${item.kanji}" — уже есть в [${seenKanji.get(item.kanji)}]`);
  } else {
    seenKanji.set(item.kanji, index);
  }

  // meaning
  if (typeof item.meaning !== 'string' || !item.meaning.trim()) {
    fail(at, '"meaning" должен быть непустой строкой');
  }

  // onyomi
  if (!Array.isArray(item.onyomi)) {
    fail(at, '"onyomi" должен быть массивом');
  } else {
    item.onyomi.forEach((reading, i) => {
      if (typeof reading !== 'string' || !reading.trim()) {
        fail(at, `onyomi[${i}] должен быть непустой строкой`);
      } else if (!KATAKANA.test(reading)) {
        fail(at, `onyomi[${i}] "${reading}" должен быть катаканой`);
      }
    });
  }

  // kunyomi
  if (!Array.isArray(item.kunyomi)) {
    fail(at, '"kunyomi" должен быть массивом (может быть пустым)');
  } else {
    item.kunyomi.forEach((reading, i) => {
      if (typeof reading !== 'string' || !reading.trim()) {
        fail(at, `kunyomi[${i}] должен быть непустой строкой`);
      } else if (!HIRAGANA.test(reading)) {
        fail(at, `kunyomi[${i}] "${reading}" должен быть хираганой`);
      } else if (reading.includes('.')) {
        warn(at, `kunyomi[${i}] "${reading}" содержит точку — в проекте принято без точки`);
      }
    });
  }

  // examples
  if (!Array.isArray(item.examples) || item.examples.length === 0) {
    fail(at, '"examples" должен быть непустым массивом');
    return;
  }

  item.examples.forEach((example, i) => {
    const exAt = `${at} → examples[${i}]`;
    if (!example || typeof example !== 'object' || Array.isArray(example)) {
      fail(exAt, 'пример должен быть объектом');
      return;
    }
    for (const key of EXAMPLE_KEYS) {
      if (!(key in example)) fail(exAt, `нет поля "${key}"`);
    }
    for (const key of Object.keys(example)) {
      if (!EXAMPLE_KEYS.includes(key)) fail(exAt, `лишнее поле "${key}"`);
    }
    for (const key of EXAMPLE_KEYS) {
      if (typeof example[key] !== 'string' || !example[key].trim()) {
        fail(exAt, `"${key}" должен быть непустой строкой`);
      }
    }
    if (typeof example.reading === 'string' && example.reading && !HIRAGANA.test(example.reading)) {
      fail(exAt, `reading "${example.reading}" должен быть хираганой`);
    }
    if (
      typeof example.word === 'string' &&
      typeof item.kanji === 'string' &&
      example.word &&
      !example.word.includes(item.kanji)
    ) {
      fail(exAt, `слово "${example.word}" не содержит кандзи "${item.kanji}"`);
    }
  });

  // первое слово — подсказка на лицевой стороне
  const firstWord = item.examples[0]?.word;
  if (firstWord === item.kanji) {
    warn(at, 'первый пример — сам кандзи; лицeвая сторона потеряет подсказку');
  }
});

const totalExamples = data.reduce((sum, item) => sum + (item.examples?.length ?? 0), 0);

console.log(`Кандзи: ${data.length}, примеров: ${totalExamples}`);
for (const w of warnings) console.log(`⚠ ${w}`);
for (const p of problems) console.log(`✗ ${p}`);

if (problems.length) {
  console.error(`\nПроверка не пройдена: ${problems.length} ошибк(и).`);
  process.exit(1);
}
console.log(`\n✓ Структура kanji.json корректна${warnings.length ? ` (${warnings.length} предупреждений)` : ''}.`);
