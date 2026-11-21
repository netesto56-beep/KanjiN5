/**
 * Проверка локального кэша и очереди (lib/offline-store.js) с подменой localStorage.
 * Запуск: node scripts/smoke-offline-store.mjs
 */
const store = new Map();
globalThis.localStorage = {
  getItem: key => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: key => store.delete(key)
};

const { readProgressCache, writeProgressCache, readPending, writePending } = await import(
  '../lib/offline-store.js'
);

let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

writeProgressCache('user-1', { 日: 'known', 月: 'hard' });
check('кэш прогресса читается', readProgressCache('user-1')['日'] === 'known');
check('кэш другого пользователя пуст', Object.keys(readProgressCache('user-2')).length === 0);

writePending('user-1', { 火: 'easy' });
check('очередь читается', readPending('user-1')['火'] === 'easy');

writePending('user-1', {});
check('пустая очередь удаляет ключ', readPending('user-1')['火'] === undefined && !store.has('kanji-n5-pending-user-1'));

store.set('kanji-n5-cache-user-1', '{битый json');
check('битый JSON не ломает чтение', Object.keys(readProgressCache('user-1')).length === 0);

// localStorage недоступен (приватный режим) — операции не должны бросать исключения
globalThis.localStorage = {
  getItem() { throw new Error('denied'); },
  setItem() { throw new Error('denied'); },
  removeItem() { throw new Error('denied'); }
};
let threw = false;
try {
  writeProgressCache('user-1', { 日: 'known' });
  readProgressCache('user-1');
} catch {
  threw = true;
}
check('ошибки localStorage не пробрасываются', threw === false);

process.exit(failed ? 1 : 0);
