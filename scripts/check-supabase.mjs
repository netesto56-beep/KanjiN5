/**
 * Проверка доступности Supabase с ключами из .env (без входа пользователя).
 * Запуск: node scripts/check-supabase.mjs
 */
import { readFileSync } from 'node:fs';

function parseEnv(path) {
  const result = {};
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      result[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    // .env отсутствует — ниже будет понятное сообщение
  }
  return result;
}

const env = parseEnv(new URL('../.env', import.meta.url));
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL;
const key =
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('В .env нет URL или ключа Supabase.');
  process.exit(1);
}

console.log(`URL: ${url}`);
console.log(`Ключ: ${key.slice(0, 16)}… (${key.length} символов)`);

const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function check(name, path) {
  try {
    const response = await fetch(`${url}${path}`, { headers });
    const body = await response.text();
    console.log(`\n[${name}] HTTP ${response.status}`);
    console.log(body.slice(0, 500) || '(пустой ответ)');
    // Тело уже вычитано: сохраняем текст, а не Response, иначе повторный .json() упадёт.
    return { ok: response.ok, status: response.status, body };
  } catch (error) {
    console.error(`\n[${name}] Ошибка сети: ${error.message}`);
    return null;
  }
}

await check('auth settings', '/auth/v1/settings');
const kanjiRes = await check('kanji (rest)', '/rest/v1/kanji?select=id,kanji&limit=5');

if (kanjiRes?.ok) {
  let rows = null;
  try {
    rows = JSON.parse(kanjiRes.body);
  } catch {
    rows = null;
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    console.log('\nВНИМАНИЕ: таблица kanji пуста или RLS не даёт читать — выполните supabase_seed_kanji.sql');
  }
}
