/**
 * Аутентификация через Supabase Auth.
 *
 * Интерфейс:
 * @typedef {Object} User
 * @property {string} id
 * @property {string|null} email
 * @property {boolean} isAnonymous
 *
 * @interface IAuthService
 * @method getCurrentUser() -> Promise<User|null>
 * @method signIn(email, password) -> Promise<User>
 * @method signUp(email, password) -> Promise<{user: User|null, needsEmailConfirmation: boolean}>
 * @method signOut() -> Promise<void>
 * @method onAuthStateChange(callback: (user: User|null, event: string) => void) -> { unsubscribe: () => void }
 */
import { requireSupabase } from '../supabase/client.js';

/** Приводим пользователя Supabase к простому объекту приложения. */
export function mapSupabaseUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email ?? null,
    isAnonymous: Boolean(user.is_anonymous) || user.app_metadata?.provider === 'anonymous',
    createdAt: user.created_at ?? null
  };
}

/** Понятные пользователю тексты вместо английских ошибок Supabase. */
export function translateAuthError(error) {
  const message = error?.message || String(error || 'Неизвестная ошибка');

  if (/Invalid login credentials/i.test(message)) return 'Неверный email или пароль.';
  if (/Email not confirmed/i.test(message)) {
    return 'Email не подтверждён. Подтвердите его по ссылке из письма Supabase.';
  }
  if (/User already registered|already been registered/i.test(message)) {
    return 'Пользователь с таким email уже зарегистрирован. Войдите вместо регистрации.';
  }
  if (/Password should be at least/i.test(message)) return 'Пароль слишком короткий (минимум 6 символов).';
  if (/Unable to validate email address|invalid format/i.test(message)) return 'Некорректный email.';
  if (/rate limit|too many requests|over_email_send_rate_limit/i.test(message)) {
    return 'Слишком много попыток. Подождите минуту и попробуйте снова.';
  }
  if (/Failed to fetch|NetworkError|network request failed/i.test(message)) {
    return 'Нет соединения с Supabase. Проверьте интернет и попробуйте снова.';
  }
  return message;
}

export class SupabaseAuthService {
  constructor(client = requireSupabase()) {
    this.client = client;
    this._listeners = new Set();
    this._subscription = null;
  }

  /** Текущий пользователь из сохранённой сессии (без сетевого запроса). */
  async getCurrentUser() {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw new Error(translateAuthError(error));
    return mapSupabaseUser(data.session?.user);
  }

  /** Вход по email и паролю. */
  async signIn(email, password) {
    const { data, error } = await this.client.auth.signInWithPassword({
      email: email.trim(),
      password
    });
    if (error) throw new Error(translateAuthError(error));
    return mapSupabaseUser(data.user);
  }

  /** Регистрация. Если в проекте включено подтверждение email, сессии ещё не будет. */
  async signUp(email, password) {
    const { data, error } = await this.client.auth.signUp({
      email: email.trim(),
      password
    });
    if (error) throw new Error(translateAuthError(error));

    return {
      user: mapSupabaseUser(data.user),
      needsEmailConfirmation: !data.session
    };
  }

  /** Выход: Supabase удаляет сессию из localStorage. */
  async signOut() {
    const { error } = await this.client.auth.signOut();
    if (error) throw new Error(translateAuthError(error));
  }

  /**
   * Подписка на вход/выход/обновление сессии.
   * Supabase сразу присылает INITIAL_SESSION, поэтому отдельный опрос не нужен.
   */
  onAuthStateChange(callback) {
    this._listeners.add(callback);

    if (!this._subscription) {
      const { data } = this.client.auth.onAuthStateChange((event, session) => {
        const user = mapSupabaseUser(session?.user);
        this._notify(user, event);
      });
      this._subscription = data.subscription;
    }

    return {
      unsubscribe: () => {
        this._listeners.delete(callback);
      }
    };
  }

  _notify(user, event) {
    for (const listener of this._listeners) {
      try {
        listener(user, event);
      } catch (error) {
        console.error('[AuthService] Ошибка в подписчике:', error);
      }
    }
  }
}

/** Фабрика для DI. */
export function createAuthService(type = 'supabase', config = {}) {
  switch (type) {
    case 'supabase':
      return new SupabaseAuthService(config.client);
    default:
      throw new Error(`Unknown auth service type: ${type}`);
  }
}
