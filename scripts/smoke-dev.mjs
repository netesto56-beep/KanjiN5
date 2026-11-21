/**
 * Smoke-проверка dev-сервера Vite: страница и модули отдаются без ошибок.
 * Запуск: node scripts/smoke-dev.mjs [baseUrl]
 */
const base = process.argv[2] ?? 'http://127.0.0.1:5173';
const paths = ['/', '/app.js', '/supabase/client.js', '/auth/auth.service.js',
  '/repositories/progress.repository.js', '/repositories/kanji.repository.js',
  '/lib/offline-store.js'];

let failed = 0;
for (const path of paths) {
  try {
    const response = await fetch(base + path);
    const body = await response.text();
    const ok = response.ok;
    if (!ok) failed++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${response.status} ${path} (${body.length} байт)`);
    if (!ok) console.log(body.slice(0, 300));
  } catch (error) {
    failed++;
    console.log(`FAIL ${path}: ${error.message}`);
  }
}

// Убеждаемся, что Vite подставил переменные окружения в клиент Supabase.
const client = await (await fetch(base + '/supabase/client.js')).text();
console.log(client.includes('/@vite/env') || client.includes('@supabase')
  ? 'OK   импорт @supabase/supabase-js разрешён'
  : 'WARN не найден импорт supabase-js в трансформированном client.js');

process.exit(failed ? 1 : 0);
