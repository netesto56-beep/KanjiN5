/**
 * Репозиторий прогресса пользователя в Supabase (таблица user_progress).
 *
 * В приложении прогресс — это объект { [кандзи]: rating }.
 * В таблице user_progress строки хранятся парами (user_id, kanji_id), поэтому
 * репозиторий переводит символ кандзи в kanji.id и обратно.
 */
import { supabase } from '../supabase/client.js';

/**
 * @interface IProgressRepository
 * @method get(userId) -> Promise<ProgressMap>
 * @method set(userId, progress) -> Promise<void>
 * @method updateOne(userId, kanji, rating) -> Promise<void>
 * @method ensureProfile(user) -> Promise<void>
 * @typedef {Object<string, Rating>} ProgressMap
 * @typedef {'unknown'|'hard'|'easy'|'known'} Rating
 */

const RATINGS = new Set(['unknown', 'hard', 'easy', 'known']);

function describeError(error, fallback) {
  if (!error) return fallback;
  const parts = [error.message, error.details, error.hint].filter(Boolean);
  return parts.length ? parts.join(' — ') : fallback;
}

/** Ошибка «нет профиля в public.users» (старые пользователи до триггера). */
function isMissingProfileError(error) {
  if (!error) return false;
  const text = `${error.message ?? ''} ${error.details ?? ''}`;
  return error.code === '23503' && /user_id_fkey|users/i.test(text);
}

export class SupabaseProgressRepository {
  constructor(client = supabase, options = {}) {
    if (!client) throw new Error('SupabaseProgressRepository: не передан клиент Supabase.');
    this.client = client;
    this.table = options.table ?? 'user_progress';
    this.kanjiTable = options.kanjiTable ?? 'kanji';
    this._kanjiMaps = null;
  }

  /** Ленивая загрузка соответствий id <-> кандзи из таблицы kanji. */
  async _getKanjiMaps() {
    if (this._kanjiMaps) return this._kanjiMaps;

    const { data, error } = await this.client.from(this.kanjiTable).select('id, kanji');
    if (error) {
      throw new Error(`Не удалось прочитать таблицу kanji: ${describeError(error, 'ошибка Supabase')}`);
    }
    if (!data?.length) {
      throw new Error(
        'Таблица kanji пуста, поэтому сохранять прогресс некуда. ' +
          'Выполните supabase_seed_kanji.sql в SQL Editor Supabase.'
      );
    }

    const idToKanji = new Map();
    const kanjiToId = new Map();
    for (const row of data) {
      idToKanji.set(row.id, row.kanji);
      kanjiToId.set(row.kanji, row.id);
    }

    this._kanjiMaps = { idToKanji, kanjiToId };
    return this._kanjiMaps;
  }

  /** Загрузить весь прогресс пользователя. */
  async get(userId) {
    const { idToKanji } = await this._getKanjiMaps();

    const { data, error } = await this.client
      .from(this.table)
      .select('kanji_id, rating')
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Не удалось загрузить прогресс: ${describeError(error, 'ошибка Supabase')}`);
    }

    const progress = {};
    for (const row of data ?? []) {
      const kanji = idToKanji.get(row.kanji_id);
      if (kanji && RATINGS.has(row.rating)) progress[kanji] = row.rating;
    }
    return progress;
  }

  /** Полностью сохранить карту прогресса (используется для импорта/синхронизации). */
  async set(userId, progress) {
    const { kanjiToId } = await this._getKanjiMaps();

    const rows = Object.entries(progress)
      .filter(([kanji, rating]) => kanjiToId.has(kanji) && RATINGS.has(rating))
      .map(([kanji, rating]) => ({
        user_id: userId,
        kanji_id: kanjiToId.get(kanji),
        rating,
        updated_at: new Date().toISOString()
      }));

    if (!rows.length) return;
    await this._upsertRows(userId, rows);
  }

  /** Сохранить одну отметку — основной путь при нажатии кнопки оценки. */
  async updateOne(userId, kanji, rating) {
    if (!RATINGS.has(rating)) throw new Error(`Недопустимая отметка: ${rating}`);

    const { kanjiToId } = await this._getKanjiMaps();
    const kanjiId = kanjiToId.get(kanji);
    if (!kanjiId) throw new Error(`Кандзи «${kanji}» отсутствует в таблице kanji.`);

    await this._upsertRows(userId, [
      {
        user_id: userId,
        kanji_id: kanjiId,
        rating,
        updated_at: new Date().toISOString()
      }
    ]);
  }

  async _upsertRows(userId, rows, allowProfileRetry = true) {
    const { error } = await this.client
      .from(this.table)
      .upsert(rows, { onConflict: 'user_id,kanji_id' });

    if (!error) return;

    // Пользователь зарегистрирован до создания триггера профиля — создаём строку users.
    if (allowProfileRetry && isMissingProfileError(error)) {
      await this.ensureProfile(userId);
      return this._upsertRows(userId, rows, false);
    }

    throw new Error(`Не удалось сохранить прогресс: ${describeError(error, 'ошибка Supabase')}`);
  }

  /**
   * Гарантирует наличие профиля в public.users (нужен для внешнего ключа).
   * RLS разрешает пользователю вставить/обновить только собственную строку.
   */
  async ensureProfile(user) {
    const id = typeof user === 'string' ? user : user?.id;
    if (!id) throw new Error('ensureProfile: не передан пользователь.');

    let email = typeof user === 'object' ? user?.email ?? null : null;
    if (!email) {
      const { data } = await this.client.auth.getUser();
      email = data?.user?.email ?? null;
    }

    const { error } = await this.client
      .from('users')
      .upsert({ id, email, is_anonymous: false }, { onConflict: 'id' });

    if (error) {
      throw new Error(`Не удалось создать профиль пользователя: ${describeError(error, 'ошибка Supabase')}`);
    }
  }
}

export function createProgressRepository(type = 'supabase', config = {}) {
  switch (type) {
    case 'supabase':
      return new SupabaseProgressRepository(config.client ?? supabase);
    default:
      throw new Error(`Unknown progress repository type: ${type}`);
  }
}
