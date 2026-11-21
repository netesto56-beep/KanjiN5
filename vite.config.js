import { defineConfig } from 'vite';

export default defineConfig({
  // Позволяем Vite отдавать в браузер переменные из .env как с префиксом VITE_,
  // так и с префиксом NEXT_PUBLIC_ (эти имена уже используются в .env проекта).
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  server: {
    host: '127.0.0.1',
    port: 5173,
    open: false,
    watch: {
      // Служебные временные файлы и скрипты не участвуют в HMR и иногда
      // блокируются файловой системой Windows (EBUSY), поэтому не следим за ними.
      ignored: ['**/scripts/**', '**/dist/**', '**/node_modules/**', '**/.*.tmpdir/**']
    }
  }
});
