# Kanji N5

Веб-приложение для тренировки кандзи уровня JLPT N5: флеш-карточки с четырьмя
отметками знания, фильтром и сводкой.

Данные и прогресс теперь хранятся в **Supabase** (Postgres + Auth), а не в
localStorage. Если облако недоступно, интерфейс продолжает работать: отметки
остаются на экране и отправляются повторно, когда связь восстанавливается.

## Стек

- Vite 5 (dev-сервер и сборка)
- `@supabase/supabase-js`
- Чистые ES-модули без фреймворков

## Запуск

```bash
pnpm install      # или npm install
pnpm dev          # http://127.0.0.1:5173
```

Сборка: `pnpm build`, предпросмотр сборки: `pnpm preview`.

## Настройка Supabase

### 1. Переменные окружения

Скопируйте `.env.example` в `.env` и заполните значения из
**Project Settings → API**. Подойдёт любой из наборов имён:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon или publishable key>
```

или `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.

### 2. Схема и права

В SQL Editor по порядку:

1. `supabase_schema_fixed.sql` — таблицы `kanji`, `users`, `user_progress`,
   RLS-политики и триггер создания профиля (вы уже выполнили).
2. `supabase_seed_kanji.sql` — заполняет `kanji` из `kanji.json` и выдаёт
   `GRANT`-права ролям API, без которых PostgREST возвращает
   `permission denied for table kanji`.

Если `kanji.json` изменится, пересоберите сид: `pnpm seed:sql`.

Проверка ключей и таблиц без запуска браузера:

```bash
pnpm check:supabase
```

### 3. Пользователи

Пользователи создаются в **Authentication → Users** (или кнопкой
«Зарегистрироваться» в приложении). Если в проекте включено подтверждение
email, регистрация требует перехода по ссылке из письма.

## Как устроено

| Файл | Назначение |
|---|---|
| `supabase/client.js` | Единый клиент Supabase и чтение `.env` |
| `auth/auth.service.js` | Вход, регистрация, выход, подписка на сессию |
| `repositories/kanji.repository.js` | Кандзи из таблицы `kanji`, откат на `kanji.json` |
| `repositories/progress.repository.js` | Прогресс в `user_progress` (кандзи ↔ `kanji_id`) |
| `lib/offline-store.js` | Кэш прогресса и очередь несохранённых отметок |
| `app.js` | Интерфейс, оптимистичные сохранения, повторная отправка |
| `domain/` | Чистая логика выбора карточки и сводки |
| `scripts/` | Генератор сида, проверка Supabase, smoke-тесты |

### Поведение при ошибках сохранения

1. Отметка сразу применяется в интерфейсе и кэшируется локально.
2. Запись уходит в Supabase; при ошибке она попадает в очередь повтора.
3. Очередь отправляется при следующем успешном сохранении, событии `online`,
   возвращении на вкладку и по таймеру.
4. Сводка и карточка никогда не откатываются из-за сетевой ошибки — внизу
   показывается статус синхронизации.

## Скрипты

```bash
pnpm dev              # dev-сервер
pnpm build            # production-сборка в dist/
pnpm seed:sql         # пересобрать supabase_seed_kanji.sql из kanji.json
pnpm validate:kanji   # проверить структуру kanji.json перед заливкой
pnpm check:supabase   # проверить URL, ключ и доступ к таблицам
pnpm check:rls        # проверить изоляцию данных двумя тестовыми аккаунтами
```

Проверка безопасности (два аккаунта, RLS) — пошагово в
[RLS_TESTING.md](RLS_TESTING.md).
