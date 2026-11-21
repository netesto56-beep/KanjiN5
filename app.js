// === DOM ===
const card = document.getElementById('card');
const frontKanji = document.getElementById('frontKanji');
const frontHint = document.getElementById('frontHint');
const backMeaning = document.getElementById('backMeaning');
const backReadings = document.getElementById('backReadings');
const backExamples = document.getElementById('backExamples');
const btnShow = document.getElementById('btnShow');
const btnNext = document.getElementById('btnNext');
const ratingButtons = document.getElementById('ratingButtons');
const ratingBtns = document.querySelectorAll('.rating-btn');
const summaryEl = document.getElementById('summary');
const filterBtns = document.querySelectorAll('.filter-btn');

const authBar = document.getElementById('authBar');
const authEmailEl = document.getElementById('authEmail');
const btnSignOut = document.getElementById('btnSignOut');
const syncStatusEl = document.getElementById('syncStatus');

const authModal = document.getElementById('authModal');
const authTitleEl = document.getElementById('authTitle');
const authForm = document.getElementById('authForm');
const authEmailInput = document.getElementById('authEmailInput');
const authPasswordInput = document.getElementById('authPasswordInput');
const authMessageEl = document.getElementById('authMessage');
const btnAuthSubmit = document.getElementById('btnAuthSubmit');
const btnToggleMode = document.getElementById('btnToggleMode');

const fatalEl = document.getElementById('fatalError');
const fatalMessageEl = document.getElementById('fatalMessage');

// === DEPENDENCIES (DI) ===
import { createKanjiRepository } from './repositories/kanji.repository.js';
import { createProgressRepository } from './repositories/progress.repository.js';
import { createAuthService } from './auth/auth.service.js';
import { selectNextKanji } from './domain/card-selector.js';
import { computeSummary, formatSummary } from './domain/progress-summary.js';
import { isSupabaseConfigured } from './supabase/client.js';
import {
  readProgressCache,
  writeProgressCache,
  readPending,
  writePending
} from './lib/offline-store.js';

const kanjiRepo = createKanjiRepository('supabase', { fallbackUrl: 'kanji.json' });
let progressRepo = null;
let authService = null;

// === STATE ===
let allKanji = [];           // полный массив из Supabase / kanji.json
let progress = {};           // { kanji: 'unknown'|'hard'|'easy'|'known' }
let pending = {};            // несохранённые отметки (очередь повтора)
let currentFilter = 'all';   // 'all' | 'unknown' | 'hard' | 'easy' | 'known'
let currentIndex = -1;       // индекс в allKanji
let lastShownIndex = -1;     // для защиты от дублей подряд
let isFlipped = false;
let currentUser = null;
let currentUserId = null;
let authReady = false;       // обработали ли первое событие авторизации
let authGeneration = 0;      // защита от гонок при быстрой смене пользователя
let authMode = 'signin';     // 'signin' | 'signup'
let flushTimer = null;
let retryTimer = null;
let flushInFlight = false;

// === INIT ===
async function init() {
  bindEvents();

  if (!isSupabaseConfigured) {
    showFatal(
      'Supabase не настроен. Добавьте в .env переменные NEXT_PUBLIC_SUPABASE_URL и ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY (или VITE_SUPABASE_*), затем перезапустите dev-сервер.'
    );
    return;
  }

  try {
    allKanji = await kanjiRepo.getAll();
    console.log(`Загружено ${allKanji.length} кандзи`);
  } catch (error) {
    console.error('Не удалось загрузить данные кандзи:', error);
    showFatal('Не удалось загрузить список кандзи. Проверьте соединение и обновите страницу.');
    return;
  }

  if (!allKanji.length) {
    showFatal('Список кандзи пуст. Заполните таблицу kanji (supabase_seed_kanji.sql).');
    return;
  }

  try {
    progressRepo = createProgressRepository('supabase');
    authService = createAuthService('supabase');
  } catch (error) {
    showFatal(error.message);
    return;
  }

  // Пока идёт проверка сессии, показываем карточку, чтобы экран не пустовал.
  nextKanji();
  updateSummary();
  showAuthModal();

  authService.onAuthStateChange(handleAuthChange);

  // Страховка: если событие INITIAL_SESSION задержится, состояние всё равно известно.
  try {
    const user = await authService.getCurrentUser();
    await handleAuthChange(user, 'BOOTSTRAP');
  } catch (error) {
    setSyncStatus('error', `Не удалось проверить сессию: ${error.message}`);
    showAuthModal();
  }
}

// === AUTH ===
async function handleAuthChange(user, event) {
  const nextId = user?.id ?? null;

  // Повторные события для того же пользователя (TOKEN_REFRESHED и т.п.) не перезагружают данные.
  if (authReady && nextId === currentUserId) return;
  authReady = true;

  const generation = ++authGeneration;
  currentUser = user;
  currentUserId = nextId;

  if (!user) {
    progress = {};
    pending = {};
    renderAuthBar(null);
    resetCardUI();
    updateSummary();
    setSyncStatus('idle', '');
    showAuthModal();
    return;
  }

  hideAuthModal();
  renderAuthBar(user);
  await loadForUser(user, generation);
}

async function loadForUser(user, generation) {
  pending = readPending(user.id);
  const cached = readProgressCache(user.id);
  setSyncStatus('loading', 'Загружаем прогресс из облака…');

  try {
    const cloud = await progressRepo.get(user.id);
    if (generation !== authGeneration) return;

    // Приоритет: очередь несохранённого → облако → локальный кэш.
    progress = { ...cached, ...cloud, ...pending };
    writeProgressCache(user.id, progress);

    if (Object.keys(pending).length) {
      setSyncStatus('pending', `Осталось отправить отметок: ${Object.keys(pending).length}`);
      scheduleFlush(500);
    } else {
      setSyncStatus('saved', 'Прогресс сохранён в облаке');
    }
  } catch (error) {
    if (generation !== authGeneration) return;
    progress = { ...cached, ...pending };
    setSyncStatus(
      'error',
      `${error.message} Показаны локальные данные; изменения сохранятся, когда связь восстановится.`
    );
    scheduleRetry();
  }

  // Профиль мог не создаться триггером (пользователи до его установки).
  try {
    await progressRepo.ensureProfile(user);
  } catch (error) {
    console.warn('[App] ensureProfile:', error.message);
  }

  updateSummary();
  refreshCurrentCard();
}

function renderAuthBar(user) {
  authBar.hidden = !user;
  authEmailEl.textContent = user?.email ?? '';
}

function showAuthModal() {
  authModal.hidden = false;
  authEmailInput.focus();
}

function hideAuthModal() {
  authModal.hidden = true;
  hideAuthMessage();
}

function setAuthMode(mode) {
  authMode = mode;
  const isSignIn = mode === 'signin';

  authTitleEl.textContent = isSignIn ? 'Вход' : 'Регистрация';
  btnAuthSubmit.textContent = isSignIn ? 'Войти' : 'Зарегистрироваться';
  btnToggleMode.textContent = isSignIn
    ? 'Нет аккаунта? Зарегистрироваться'
    : 'Уже есть аккаунт? Войти';
  authPasswordInput.autocomplete = isSignIn ? 'current-password' : 'new-password';

  hideAuthMessage();
}

async function handleAuthSubmit(event) {
  event.preventDefault();

  const email = authEmailInput.value.trim();
  const password = authPasswordInput.value;

  if (!email || !password) {
    showAuthMessage('Введите email и пароль.', 'error');
    return;
  }
  if (password.length < 6) {
    showAuthMessage('Пароль должен содержать минимум 6 символов.', 'error');
    return;
  }

  setAuthBusy(true);
  hideAuthMessage();

  try {
    if (authMode === 'signin') {
      await authService.signIn(email, password);
      // Дальше handleAuthChange закроет окно и загрузит прогресс.
    } else {
      const { needsEmailConfirmation } = await authService.signUp(email, password);
      if (needsEmailConfirmation) {
        setAuthMode('signin');
        showAuthMessage(
          'Аккаунт создан. Подтвердите email по ссылке из письма Supabase, затем войдите.',
          'info'
        );
        return;
      }
    }
    authForm.reset();
  } catch (error) {
    showAuthMessage(error.message, 'error');
  } finally {
    setAuthBusy(false);
  }
}

async function handleSignOut() {
  if (!authService) return;
  try {
    await authService.signOut();
  } catch (error) {
    setSyncStatus('error', `Не удалось выйти: ${error.message}`);
  }
}

function setAuthBusy(isBusy) {
  btnAuthSubmit.disabled = isBusy;
  authEmailInput.disabled = isBusy;
  authPasswordInput.disabled = isBusy;
  btnToggleMode.disabled = isBusy;
  btnAuthSubmit.textContent = isBusy
    ? 'Подождите…'
    : authMode === 'signin'
      ? 'Войти'
      : 'Зарегистрироваться';
}

function showAuthMessage(text, tone = 'error') {
  authMessageEl.textContent = text;
  authMessageEl.dataset.tone = tone;
  authMessageEl.hidden = false;
}

function hideAuthMessage() {
  authMessageEl.hidden = true;
  authMessageEl.textContent = '';
  delete authMessageEl.dataset.tone;
}

function setSyncStatus(tone, text) {
  syncStatusEl.textContent = text ?? '';
  if (tone === 'idle') {
    delete syncStatusEl.dataset.tone;
  } else {
    syncStatusEl.dataset.tone = tone;
  }
}

// === EVENTS ===
function bindEvents() {
  btnShow.addEventListener('click', () => {
    if (!isFlipped) flipCard();
  });

  btnNext.addEventListener('click', () => {
    nextKanji();
  });

  ratingBtns.forEach(btn => {
    btn.addEventListener('click', () => selectRating(btn.dataset.rating));
  });

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => setFilter(btn.dataset.filter));
  });

  authForm.addEventListener('submit', handleAuthSubmit);
  btnToggleMode.addEventListener('click', () => {
    setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
  });
  btnSignOut.addEventListener('click', handleSignOut);

  window.addEventListener('online', () => {
    setSyncStatus('pending', 'Соединение восстановлено, отправляем изменения…');
    flushPending();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) flushPending();
  });
}

// === SAVE (оптимистично: сначала интерфейс, потом облако) ===
async function selectRating(rating) {
  const kanji = allKanji[currentIndex]?.kanji;
  if (!kanji) return;

  if (!currentUserId) {
    showAuthModal();
    return;
  }

  const userId = currentUserId;

  // 1) Сразу обновляем интерфейс — ошибка сети не должна его откатывать.
  progress[kanji] = rating;
  ratingBtns.forEach(btn => btn.classList.toggle('selected', btn.dataset.rating === rating));
  btnNext.style.display = 'block';
  updateSummary();
  writeProgressCache(userId, progress);

  // 2) Пытаемся сохранить в облако; при ошибке отметка уходит в очередь повтора.
  await persistRating(userId, kanji, rating);
}

async function persistRating(userId, kanji, rating) {
  setSyncStatus('saving', 'Сохраняем в облако…');

  try {
    await progressRepo.updateOne(userId, kanji, rating);
    if (userId !== currentUserId) return;

    if (pending[kanji] === rating) {
      delete pending[kanji];
      writePending(userId, pending);
    }
    setSyncStatus('saved', 'Сохранено в облаке');
    scheduleFlush(0);
  } catch (error) {
    if (userId !== currentUserId) return;

    pending[kanji] = rating;
    writePending(userId, pending);
    setSyncStatus(
      'error',
      `Не удалось сохранить: ${error.message} Оценка осталась на экране и в очереди на повтор.`
    );
    scheduleRetry();
  }
}

function scheduleFlush(delay = 3000) {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushPending();
  }, delay);
}

function scheduleRetry(delay = 15000) {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    flushPending();
  }, delay);
}

async function flushPending() {
  if (!currentUserId || flushInFlight) return;

  const entries = Object.entries(pending);
  if (!entries.length) return;

  flushInFlight = true;
  const userId = currentUserId;

  try {
    for (const [kanji, rating] of entries) {
      await progressRepo.updateOne(userId, kanji, rating);
      if (userId !== currentUserId) return;

      // Не удаляем более новую отметку, если пользователь успел её изменить.
      if (pending[kanji] === rating) delete pending[kanji];
      writePending(userId, pending);
    }

    if (userId === currentUserId) {
      setSyncStatus('saved', 'Все изменения сохранены в облаке');
    }
  } catch (error) {
    if (userId === currentUserId) {
      setSyncStatus('error', `Повторим отправку позже: ${error.message}`);
      scheduleRetry();
    }
  } finally {
    flushInFlight = false;
  }
}

// === CARD RENDER ===
function renderCard(index) {
  if (index < 0 || index >= allKanji.length) return;
  const k = allKanji[index];
  currentIndex = index;

  const firstExample = k.examples?.[0];
  frontKanji.textContent = k.kanji;
  // На лицевой стороне — только слово-контекст, без чтения: оно на обороте.
  frontHint.textContent = firstExample?.word || k.meaning;

  backMeaning.innerHTML = `
    <div class="kanji-large" style="margin-bottom: 8px;">${k.kanji}</div>
    <div>${k.meaning}</div>
  `;
  backReadings.innerHTML = `
    <span class="reading-item"><strong>Кун:</strong> ${(k.kunyomi ?? []).join('、')}</span>
    <span class="reading-item"><strong>Он:</strong> ${(k.onyomi ?? []).join('、')}</span>
  `;
  backExamples.innerHTML = (k.examples ?? []).map(ex => `
    <div class="example-row">
      <span class="example-word">${ex.word}</span>
      <span class="example-reading">${ex.reading}</span>
      <span class="example-meaning">${ex.meaning}</span>
    </div>
  `).join('');

  resetCardUI();
}

function resetCardUI() {
  card.classList.remove('flipped');
  isFlipped = false;
  btnShow.style.display = 'block';
  ratingButtons.style.display = 'none';
  btnNext.style.display = 'none';
  ratingBtns.forEach(b => b.classList.remove('selected'));

  const currentKanji = allKanji[currentIndex]?.kanji;
  if (currentKanji && progress[currentKanji]) {
    const savedRating = progress[currentKanji];
    const btn = document.querySelector(`.rating-btn[data-rating="${savedRating}"]`);
    if (btn) btn.classList.add('selected');
  }
}

function flipCard() {
  card.classList.add('flipped');
  isFlipped = true;
  btnShow.style.display = 'none';
  ratingButtons.style.display = 'grid';
}

function refreshCurrentCard() {
  if (currentIndex >= 0 && currentIndex < allKanji.length) {
    renderCard(currentIndex); // renderCard сам сбрасывает состояние карточки
  } else {
    nextKanji();
  }
}

// === NAVIGATION (использует чистые функции из domain/) ===
function nextKanji() {
  if (!allKanji.length) return;

  const next = selectNextKanji({
    allKanji,
    progress,
    filter: currentFilter,
    lastShownIndex
  });

  if (next === -1) {
    const allIndices = allKanji.map((_, i) => i).filter(i => i !== lastShownIndex);
    if (allIndices.length === 0) return;
    renderCard(allIndices[0]);
    lastShownIndex = allIndices[0];
    return;
  }

  renderCard(next);
  lastShownIndex = next;
}

// === SUMMARY & FILTER ===
function updateSummary() {
  const counts = computeSummary(allKanji, progress);
  summaryEl.textContent = formatSummary(counts);
}

function setFilter(filter) {
  currentFilter = filter;
  filterBtns.forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
  nextKanji();
}

// === FATAL ===
function showFatal(message) {
  fatalMessageEl.textContent = message;
  fatalEl.hidden = false;
  authModal.hidden = true;
  authBar.hidden = true;
}

// === START ===
init();
