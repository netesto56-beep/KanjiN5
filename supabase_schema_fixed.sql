-- ============================================================
-- ИСПРАВЛЕННАЯ ВЕРСИЯ: Триггер создания профиля пользователя
-- ============================================================

-- 1. Удаляем старый триггер и функцию, если они есть
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Создаём функцию с SECURITY DEFINER (выполняется от имени владельца функции, обходит RLS)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_metadata JSONB;
    is_anon BOOLEAN := FALSE;
BEGIN
    -- Безопасно извлекаем метаданные (могут быть NULL)
    user_metadata := COALESCE(NEW.raw_user_meta_data, '{}'::JSONB);
    
    -- Проверяем флаг анонимности: true только если явно передано "true"
    -- COALESCE превращает NULL в FALSE
    is_anon := COALESCE(user_metadata->>'is_anonymous', 'false') = 'true';
    
    -- Вставляем профиль пользователя
    -- ON CONFLICT DO NOTHING — идемпотентно, если профиль уже есть
    INSERT INTO public.users (id, email, is_anonymous)
    VALUES (NEW.id, NEW.email, is_anon)
    ON CONFLICT (id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Вешаем триггер на auth.users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- АЛЬТЕРНАТИВНЫЙ ВАРИАНТ: Если хочешь DEFAULT в самой таблице
-- ============================================================

-- Если предпочитаешь держать логику DEFAULT в схеме таблицы:
/*
ALTER TABLE public.users 
    ALTER COLUMN is_anonymous SET DEFAULT FALSE;
    
-- Тогда триггер упрощается до:
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
*/


-- ============================================================
-- ПОЛНАЯ ШЕМА (для справки) — с исправленным триггером
-- ============================================================

/*
-- 1. Таблица кандзи (общая, read-only для пользователей)
CREATE TABLE kanji (
    id SERIAL PRIMARY KEY,
    kanji CHARACTER VARYING(10) NOT NULL UNIQUE,
    meaning TEXT NOT NULL,
    onyomi JSONB NOT NULL DEFAULT '[]',
    kunyomi JSONB NOT NULL DEFAULT '[]',
    examples JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_kanji_character ON kanji(kanji);

-- 2. Таблица пользователей
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,  -- DEFAULT на уровне таблицы
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 3. Таблица прогресса
CREATE TABLE user_progress (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kanji_id INTEGER NOT NULL REFERENCES kanji(id) ON DELETE CASCADE,
    rating TEXT NOT NULL CHECK (rating IN ('unknown', 'hard', 'easy', 'known')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, kanji_id)
);
CREATE INDEX idx_user_progress_user ON user_progress(user_id);
CREATE INDEX idx_user_progress_rating ON user_progress(user_id, rating);

ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress" ON user_progress
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress" ON user_progress
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress" ON user_progress
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own progress" ON user_progress
    FOR DELETE USING (auth.uid() = user_id);

-- 4. Триггер (использует DEFAULT из таблицы, поэтому проще)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
*/

-- ============================================================
-- ДОПОЛНИТЕЛЬНО: Политика для чтения kanji анонимными пользователями
-- ============================================================

/*
-- Если приложение должно работать БЕЗ входа (анонимный доступ к кандзи):
ALTER TABLE kanji ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read kanji" ON kanji
    FOR SELECT USING (true);
-- Или только для аутентифицированных:
-- CREATE POLICY "Authenticated can read kanji" ON kanji
--     FOR SELECT USING (auth.role() = 'authenticated');
*/