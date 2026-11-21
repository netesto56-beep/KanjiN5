/**
 * Генерирует supabase_seed_kanji.sql из kanji.json.
 * Запуск: node scripts/generate-seed-sql.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const kanji = JSON.parse(readFileSync(new URL('kanji.json', root), 'utf8'));

const q = value => `'${String(value).replace(/'/g, "''")}'`;
const jsonb = value => `${q(JSON.stringify(value ?? []))}::jsonb`;

const values = kanji
  .map(
    item =>
      `  (${q(item.kanji)}, ${q(item.meaning)}, ${jsonb(item.onyomi)}, ${jsonb(
        item.kunyomi
      )}, ${jsonb(item.examples)})`
  )
  .join(',\n');

const sql = `-- ============================================================
-- Seed таблицы public.kanji данными из kanji.json
-- Сгенерировано scripts/generate-seed-sql.mjs — не редактируйте вручную.
-- Запустите этот файл в Supabase → SQL Editor.
-- ============================================================

begin;

-- 1. Кандзи (идемпотентно: повторный запуск обновит существующие строки)
insert into public.kanji (kanji, meaning, onyomi, kunyomi, examples)
values
${values}
on conflict (kanji) do update
  set meaning  = excluded.meaning,
      onyomi   = excluded.onyomi,
      kunyomi  = excluded.kunyomi,
      examples = excluded.examples;

-- 2. Справочные данные должны читаться всеми пользователями приложения
alter table public.kanji enable row level security;

drop policy if exists "Anyone can read kanji" on public.kanji;
drop policy if exists "Authenticated can read kanji" on public.kanji;

create policy "Anyone can read kanji" on public.kanji
  for select using (true);

-- 3. Права для ролей Supabase API (RLS сама по себе не выдаёт доступ к таблицам)
grant usage on schema public to anon, authenticated;
grant select on table public.kanji to anon, authenticated;
grant select, insert, update on table public.users to authenticated;
grant select, insert, update, delete on table public.user_progress to authenticated;

-- 4. Профили для пользователей, созданных до установки триггера on_auth_user_created
insert into public.users (id, email, is_anonymous)
select u.id,
       u.email,
       coalesce((u.raw_user_meta_data->>'is_anonymous')::boolean, false)
from auth.users u
on conflict (id) do nothing;

commit;
`;

writeFileSync(new URL('supabase_seed_kanji.sql', root), sql, 'utf8');
console.log(`supabase_seed_kanji.sql: ${kanji.length} кандзи`);
