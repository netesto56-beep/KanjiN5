/**
 * Проверка формы входа в реальном Chrome через CDP.
 * Ожидает, что Chrome уже запущен с --remote-debugging-port=9222 и открытой страницей.
 * Запуск: node scripts/smoke-auth-ui.mjs [appUrl] [debugPort]
 */
const appUrl = process.argv[2] ?? 'http://127.0.0.1:5173/';
const port = process.argv[3] ?? '9222';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getPageTarget() {
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = targets.find(t => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page;
    } catch {
      // Chrome ещё поднимается
    }
    await sleep(500);
  }
  throw new Error('Не удалось подключиться к Chrome DevTools');
}

const page = await getPageTarget();
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});

let nextId = 0;
const waiters = new Map();
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  const waiter = waiters.get(message.id);
  if (waiter) {
    waiters.delete(message.id);
    message.error ? waiter.reject(new Error(message.error.message)) : waiter.resolve(message.result);
  }
});

function send(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    waiters.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? 'Ошибка в браузере');
  }
  return result.result.value;
}

let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

// 1. Страница открыта и приложение инициализировалось
await send('Page.navigate', { url: appUrl });
await sleep(6000);

const state = await evaluate(`(() => ({
  card: document.querySelector('#frontKanji')?.textContent ?? '',
  modalHidden: document.querySelector('#authModal')?.hidden,
  fatalHidden: document.querySelector('#fatalError')?.hidden,
  summary: document.querySelector('#summary')?.textContent ?? ''
}))()`);

check('карточка кандзи отрисована', /[一-龯]/.test(state.card), state.card);
check('модальное окно входа видно', state.modalHidden === false);
check('критической ошибки нет', state.fatalHidden === true);
check('сводка посчитана', /Не знаю:\s*6/.test(state.summary), state.summary.trim());

// 2. Неверный пароль: ожидаем понятное сообщение, окно остаётся, данные не теряются
await evaluate(`(() => {
  document.querySelector('#authEmailInput').value = 'no-such-user@example.com';
  document.querySelector('#authPasswordInput').value = 'wrong-password';
  document.querySelector('#authForm').requestSubmit();
  return true;
})()`);
await sleep(6000);

const afterLogin = await evaluate(`(() => ({
  message: document.querySelector('#authMessage')?.textContent ?? '',
  messageHidden: document.querySelector('#authMessage')?.hidden,
  modalHidden: document.querySelector('#authModal')?.hidden,
  card: document.querySelector('#frontKanji')?.textContent ?? '',
  summary: document.querySelector('#summary')?.textContent ?? '',
  submitDisabled: document.querySelector('#btnAuthSubmit')?.disabled
}))()`);

check('показана ошибка входа', afterLogin.messageHidden === false && afterLogin.message.length > 0, afterLogin.message);
check('сообщение на русском про пароль', /парол/i.test(afterLogin.message));
check('окно входа не закрылось', afterLogin.modalHidden === false);
check('карточка и сводка не пропали', /[一-龯]/.test(afterLogin.card) && /Не знаю:\s*6/.test(afterLogin.summary));
check('кнопка снова активна', afterLogin.submitDisabled === false);

// 3. Проверяем переключение на регистрацию
await evaluate(`document.querySelector('#btnToggleMode').click()`);
await sleep(500);
const signupMode = await evaluate(`(() => ({
  title: document.querySelector('#authTitle')?.textContent ?? '',
  submit: document.querySelector('#btnAuthSubmit')?.textContent ?? ''
}))()`);
check('переключение в режим регистрации', signupMode.title === 'Регистрация', `${signupMode.title} / ${signupMode.submit}`);

ws.close();
process.exit(failed ? 1 : 0);
