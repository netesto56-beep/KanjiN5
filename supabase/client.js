/**
 * Единый клиент Supabase.
 *
 * Переменные окружения читаются из .env (Vite подставляет их в import.meta.env).
 * Поддерживаются оба набора имён, чтобы .env не приходилось переименовывать:
 *   VITE_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 *
 * Дополнительно можно передать конфигурацию во время выполнения через
 * window.__SUPABASE_CONFIG__ = { url, anonKey } — удобно для статической сборки.
 */
import { createClient } from '@supabase/supabase-js';

function readEnv(names) {
  const env = import.meta.env ?? {};
  for (const name of names) {
    const value = env[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

const runtimeConfig = globalThis.__SUPABASE_CONFIG__ ?? {};

export const SUPABASE_URL =
  readEnv(['VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL']) || runtimeConfig.url || null;

export const SUPABASE_KEY =
  readEnv([
    'VITE_SUPABASE_ANON_KEY',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
  ]) ||
  runtimeConfig.anonKey ||
  null;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

/** Клиент обязателен для облачных операций — бросаем понятную ошибку. */
export function requireSupabase() {
  if (!supabase) {
    throw new Error(
      'Supabase не настроен: добавьте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY ' +
        '(или NEXT_PUBLIC_*) в файл .env и перезапустите dev-сервер.'
    );
  }
  return supabase;
}
