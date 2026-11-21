/**
 * Локальный слой устойчивости к ошибкам сети.
 *
 * Это НЕ основное хранилище (оно теперь в Supabase), а страховка:
 *  - кэш последнего успешно загруженного прогресса, чтобы интерфейс не пустел;
 *  - очередь несохранённых отметок, которые отправятся в облако позже.
 *
 * Ошибки localStorage (приватный режим, переполнение) не должны ломать приложение,
 * поэтому все операции обёрнуты в try/catch.
 */

const CACHE_PREFIX = 'kanji-n5-cache-';
const PENDING_PREFIX = 'kanji-n5-pending-';

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.warn(`[OfflineStore] Не удалось прочитать ${key}:`, error);
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`[OfflineStore] Не удалось записать ${key}:`, error);
    return false;
  }
}

export function readProgressCache(userId) {
  return readJson(CACHE_PREFIX + userId, {});
}

export function writeProgressCache(userId, progress) {
  if (!userId) return;
  writeJson(CACHE_PREFIX + userId, progress ?? {});
}

/** Очередь: { [кандзи]: rating } — только последняя несохранённая отметка. */
export function readPending(userId) {
  return readJson(PENDING_PREFIX + userId, {});
}

export function writePending(userId, pending) {
  if (!userId) return;
  if (pending && Object.keys(pending).length) {
    writeJson(PENDING_PREFIX + userId, pending);
  } else {
    try {
      localStorage.removeItem(PENDING_PREFIX + userId);
    } catch (error) {
      console.warn('[OfflineStore] Не удалось очистить очередь:', error);
    }
  }
}
