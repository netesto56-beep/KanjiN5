/**
 * Проверка Row Level Security двумя тестовыми аккаунтами.
 *
 * Зачем отдельный скрипт: интерфейс сам всегда подставляет свой user_id,
 * поэтому «в браузере всё выглядит раздельно» ещё не доказывает, что RLS включён.
 * Скрипт говорит с PostgREST напрямую и пытается читать/писать ЧУЖИЕ строки.
 *
 * Запуск:
 *   pnpm check:rls                 # нужны RLS_USER_A_* и RLS_USER_B_*
 *   pnpm check:rls -- --anon-only  # только гостевые проверки, без аккаунтов
 *
 * Переменные (в .env или в окружении):
 *   RLS_USER_A_EMAIL / RLS_USER_A_PASSWORD
 *   RLS_USER_B_EMAIL / RLS_USER_B_PASSWORD
 *
 * Код выхода 0 — все проверки прошли, 1 — есть провалы.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function parseEnv(path) {
  const result = {};
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      result[match[1]] = match[2].replace(/^["']|["']$/g, '').trim();
    }
  } catch {
    // .env может отсутствовать — значения можно передать через окружение
  }
  return result;
}

const env = parseEnv(new URL('../.env', import.meta.url));
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL;
const key =
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  env.VITE_SUPABASE_ANON_KEY ||
  env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error('В .env нет URL или publishable/anon-ключа Supabase.');
  process.exit(1);
}

const flag = name => process.argv.slice(2).includes(name);
const anonOnly = flag('--anon-only');

const account = label => ({
  email: process.env[`RLS_USER_${label}_EMAIL`] || env[`RLS_USER_${label}_EMAIL`] || '',
  password: process.env[`RLS_USER_${label}_PASSWORD`] || env[`RLS_USER_${label}_PASSWORD`] || ''
});

let failed = 0;
let passed = 0;

function check(name, ok, detail = '') {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

function describe(error) {
  if (!error) return '';
  return [error.code, error.message].filter(Boolean).join(': ');
}

function makeClient() {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

function finish() {
  console.log(`\nИтого: ${passed} OK, ${failed} FAIL`);
  if (failed) console.log('RLS настроен неполно — смотрите строки FAIL выше.');
  process.exit(failed ? 1 : 0);
}

console.log(`Проект: ${url}`);
console.log(`Ключ:   ${key.slice(0, 16)}… (${key.length} символов)`);

// ============================================================
// 1. Гость без сессии: не должен ни читать, ни писать прогресс
// ============================================================
console.log('\n=== Гость (без входа) ===');
{
  const guest = makeClient();

  const { data, error } = await guest.from('user_progress').select('*').limit(5);
  check(
    'гость не читает user_progress',
    Boolean(error) || (data?.length ?? 0) === 0,
    error ? describe(error) : `${data?.length ?? 0} строк`
  );

  const insert = await guest
    .from('user_progress')
    .insert({ user_id: '00000000-0000-0000-0000-000000000000', kanji_id: 1, rating: 'easy' });
  check('гость не пишет в user_progress', Boolean(insert.error), describe(insert.error));

  const usersRead = await guest.from('users').select('id, email').limit(5);
  check(
    'гость не читает профили users',
    Boolean(usersRead.error) || (usersRead.data?.length ?? 0) === 0,
    usersRead.error ? describe(usersRead.error) : `${usersRead.data?.length ?? 0} строк`
  );

  const kanjiRead = await guest.from('kanji').select('id, kanji').limit(3);
  check(
    'гость читает kanji (так и задумано)',
    !kanjiRead.error && (kanjiRead.data?.length ?? 0) > 0,
    kanjiRead.error ? describe(kanjiRead.error) : `${kanjiRead.data.length} строк`
  );
}

if (anonOnly) finish();

// ============================================================
// 2. Два реальных аккаунта
// ============================================================
const accA = account('A');
const accB = account('B');

if (!accA.email || !accA.password || !accB.email || !accB.password) {
  console.error(
    '\nНе заданы RLS_USER_A_* / RLS_USER_B_*. Задайте их в .env или в окружении, ' +
      'либо запустите с флагом --anon-only.'
  );
  process.exit(1);
}

const clientA = makeClient();
const clientB = makeClient();

async function signIn(client, user, label) {
  const { data, error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password
  });
  if (error) {
    console.error(`\nНе удалось войти как ${label} (${user.email}): ${error.message}`);
    console.error('Проверьте, что аккаунт существует и email подтверждён.');
    process.exit(1);
  }
  return data.user;
}

console.log('\n=== Вход тестовыми аккаунтами ===');
const userA = await signIn(clientA, accA, 'A');
const userB = await signIn(clientB, accB, 'B');
console.log(`A: ${userA.email} — ${userA.id}`);
console.log(`B: ${userB.email} — ${userB.id}`);

if (userA.id === userB.id) {
  console.error('Оба логина ведут в один аккаунт — тест не имеет смысла.');
  process.exit(1);
}

// Берём любой кандзи из общей таблицы и запоминаем текущую отметку A,
// чтобы в конце вернуть её как было.
const { data: kanjiRows, error: kanjiError } = await clientA
  .from('kanji')
  .select('id, kanji')
  .limit(1);

if (kanjiError || !kanjiRows?.length) {
  console.error(`\nНе удалось прочитать kanji: ${describe(kanjiError)}`);
  process.exit(1);
}

const kanji = kanjiRows[0];
console.log(`Тестовый кандзи: ${kanji.kanji} (id ${kanji.id})`);

const { data: beforeRows } = await clientA
  .from('user_progress')
  .select('rating')
  .eq('user_id', userA.id)
  .eq('kanji_id', kanji.id)
  .limit(1);
const previousRating = beforeRows?.[0]?.rating ?? null;

async function readProgress(client, userId) {
  return client
    .from('user_progress')
    .select('user_id, kanji_id, rating')
    .eq('user_id', userId);
}

/**
 * Возвращает строку A в исходное состояние.
 * Нужно и для чистоты эксперимента: если RLS сломан и B записал строку,
 * удаление/перезапись здесь её тоже уберёт.
 */
async function restoreA() {
  if (previousRating) {
    await clientA
      .from('user_progress')
      .upsert(
        { user_id: userA.id, kanji_id: kanji.id, rating: previousRating },
        { onConflict: 'user_id,kanji_id' }
      );
  } else {
    await clientA.from('user_progress').delete().eq('user_id', userA.id).eq('kanji_id', kanji.id);
  }
}

try {
  // --- Подготовка ---
  console.log('\n=== Подготовка данных ===');
  {
    const { error } = await clientA
      .from('users')
      .upsert({ id: userA.id, email: userA.email, is_anonymous: false }, { onConflict: 'id' });
    check('A создаёт/обновляет свой профиль', !error, describe(error));
  }
  {
    const { error } = await clientA.from('user_progress').upsert(
      {
        user_id: userA.id,
        kanji_id: kanji.id,
        rating: 'easy',
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id,kanji_id' }
    );
    check('A сохраняет свою отметку «easy»', !error, describe(error));
  }

  // --- B читает ---
  console.log('\n=== B пытается читать данные A ===');
  {
    const { data, error } = await readProgress(clientA, userA.id);
    const row = data?.find(r => r.kanji_id === kanji.id);
    check('A видит свою отметку', !error && row?.rating === 'easy', error ? describe(error) : row?.rating);
  }
  {
    const { data, error } = await clientB.from('user_progress').select('user_id, kanji_id, rating');
    const foreign = (data ?? []).filter(r => r.user_id !== userB.id);
    check(
      'B без фильтра получает только свои строки',
      !error && foreign.length === 0,
      error ? describe(error) : `своих ${data?.length ?? 0}, чужих ${foreign.length}`
    );
  }
  {
    const { data, error } = await readProgress(clientB, userA.id);
    check(
      'B не видит строки A по явному запросу user_id=A',
      !error && (data?.length ?? 0) === 0,
      error ? describe(error) : `${data?.length ?? 0} строк`
    );
  }
  {
    const { data, error } = await clientB.from('users').select('id, email').eq('id', userA.id);
    check(
      'B не видит профиль A',
      !error && (data?.length ?? 0) === 0,
      error ? describe(error) : `${data?.length ?? 0} строк`
    );
  }

  // --- B пишет ---
  console.log('\n=== B пытается менять данные A ===');
  {
    const { error } = await clientB
      .from('user_progress')
      .insert({ user_id: userA.id, kanji_id: kanji.id, rating: 'known' });
    check('B не может вставить строку с user_id=A', Boolean(error), describe(error));
  }
  {
    const { data, error } = await clientB
      .from('user_progress')
      .update({ rating: 'known' })
      .eq('user_id', userA.id)
      .select();
    check(
      'B не может обновить строки A',
      !error && (data?.length ?? 0) === 0,
      error ? describe(error) : `обновлено ${data?.length ?? 0}`
    );
  }
  {
    const { data, error } = await readProgress(clientA, userA.id);
    const row = data?.find(r => r.kanji_id === kanji.id);
    check(
      'отметка A не изменилась',
      !error && row?.rating === 'easy',
      error ? describe(error) : row?.rating
    );
  }
  {
    const { data, error } = await clientB
      .from('user_progress')
      .delete()
      .eq('user_id', userA.id)
      .select();
    check(
      'B не может удалить строки A',
      !error && (data?.length ?? 0) === 0,
      error ? describe(error) : `удалено ${data?.length ?? 0}`
    );
  }
  {
    const { data, error } = await readProgress(clientA, userA.id);
    const row = data?.find(r => r.kanji_id === kanji.id);
    check(
      'строка A уцелела после удаления',
      !error && row?.rating === 'easy',
      error ? describe(error) : row?.rating
    );
  }
  {
    const { data, error } = await clientB
      .from('users')
      .update({ email: 'hijacked@example.com' })
      .eq('id', userA.id)
      .select();
    check(
      'B не может обновить профиль A',
      !error && (data?.length ?? 0) === 0,
      error ? describe(error) : `обновлено ${data?.length ?? 0}`
    );
  }
  {
    const { error } = await clientB
      .from('users')
      .insert({ id: userA.id, email: 'hijacked@example.com', is_anonymous: false });
    check('B не может вставить профиль с id=A', Boolean(error), describe(error));
  }
  {
    const { data, error } = await clientA.from('users').select('email').eq('id', userA.id).limit(1);
    check(
      'профиль A не испорчен',
      !error && data?.[0]?.email !== 'hijacked@example.com',
      error ? describe(error) : data?.[0]?.email
    );
  }

  // --- Второй круг: B пишет своё, A это не видит ---
  console.log('\n=== B пишет своё, A не должен это увидеть ===');
  {
    const { error } = await clientB.from('user_progress').upsert(
      {
        user_id: userB.id,
        kanji_id: kanji.id,
        rating: 'hard',
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id,kanji_id' }
    );
    check('B сохраняет свою отметку', !error, describe(error));
  }
  {
    const { data, error } = await readProgress(clientA, userB.id);
    check(
      'A не видит строки B',
      !error && (data?.length ?? 0) === 0,
      error ? describe(error) : `${data?.length ?? 0} строк`
    );
  }
} finally {
  await restoreA();
  console.log(`\nЧистка: отметка A для ${kanji.kanji} возвращена в исходное состояние`);
}

finish();
