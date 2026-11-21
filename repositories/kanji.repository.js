/**
 * Репозиторий кандзи — абстракция над источником справочных данных.
 * Основной источник — таблица kanji в Supabase; kanji.json используется
 * как резерв, если таблица ещё не заполнена или сеть недоступна.
 */
import { supabase } from '../supabase/client.js';

/**
 * @interface IKanjiRepository
 * @method getAll() -> Promise<Kanji[]>
 * @typedef {Object} Kanji
 * @property {string} kanji
 * @property {string} meaning
 * @property {string[]} onyomi
 * @property {string[]} kunyomi
 * @property {Example[]} examples
 * @typedef {Object} Example
 * @property {string} word
 * @property {string} reading
 * @property {string} meaning
 */

function asStringArray(value) {
  if (Array.isArray(value)) return value.filter(v => typeof v === 'string');
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(v => typeof v === 'string') : [value];
    } catch {
      return [value];
    }
  }
  return [];
}

function normalizeExamples(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(ex => ex && typeof ex === 'object')
    .map(ex => ({
      word: String(ex.word ?? ''),
      reading: String(ex.reading ?? ''),
      meaning: String(ex.meaning ?? '')
    }));
}

/** Приводим строку из Supabase (jsonb) к форме kanji.json. */
export function normalizeKanjiRow(row) {
  return {
    kanji: String(row.kanji ?? ''),
    meaning: String(row.meaning ?? ''),
    onyomi: asStringArray(row.onyomi),
    kunyomi: asStringArray(row.kunyomi),
    examples: normalizeExamples(row.examples)
  };
}

// === Реализация: статический JSON (резервный источник) ===
export class StaticKanjiRepository {
  constructor(jsonUrl = 'kanji.json') {
    this.jsonUrl = jsonUrl;
    this._cache = null;
  }

  async getAll() {
    if (this._cache) return this._cache;

    const res = await fetch(this.jsonUrl);
    if (!res.ok) {
      throw new Error(`Failed to load kanji data: HTTP ${res.status}`);
    }
    this._cache = await res.json();
    return this._cache;
  }

  clearCache() {
    this._cache = null;
  }
}

// === Реализация: Supabase (таблица kanji) с откатом на kanji.json ===
export class SupabaseKanjiRepository {
  constructor(client = supabase, options = {}) {
    this.client = client;
    this.table = options.table ?? 'kanji';
    this.fallbackUrl = options.fallbackUrl ?? 'kanji.json';
    this._cache = null;
  }

  async getAll() {
    if (this._cache) return this._cache;

    const fromCloud = await this._loadFromSupabase();
    if (fromCloud?.length) {
      this._cache = fromCloud;
      return this._cache;
    }

    const fallback = await this._loadFromJson();
    this._cache = fallback;
    return this._cache;
  }

  async _loadFromSupabase() {
    if (!this.client) return null;

    try {
      const { data, error } = await this.client
        .from(this.table)
        .select('kanji, meaning, onyomi, kunyomi, examples')
        .order('id', { ascending: true });

      if (error) throw error;

      const rows = (data ?? []).map(normalizeKanjiRow).filter(row => row.kanji);
      if (!rows.length) {
        console.warn('[KanjiRepository] Таблица kanji пуста — используется kanji.json.');
        return null;
      }
      return rows;
    } catch (error) {
      console.warn('[KanjiRepository] Supabase недоступен, используется kanji.json:', error?.message ?? error);
      return null;
    }
  }

  async _loadFromJson() {
    const res = await fetch(this.fallbackUrl);
    if (!res.ok) throw new Error(`Failed to load kanji fallback: HTTP ${res.status}`);
    return (await res.json()).map(row => normalizeKanjiRow(row));
  }

  clearCache() {
    this._cache = null;
  }
}

export function createKanjiRepository(type = 'static', config = {}) {
  switch (type) {
    case 'static':
      return new StaticKanjiRepository(config.jsonUrl);
    case 'supabase':
      return new SupabaseKanjiRepository(config.client ?? supabase, config);
    default:
      throw new Error(`Unknown kanji repository type: ${type}`);
  }
}
