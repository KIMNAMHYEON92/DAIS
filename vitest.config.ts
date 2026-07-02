import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

const resolveSource = (directory: string): string => fileURLToPath(new URL(`./src/${directory}`, import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/mocks/setup.ts'],
    alias: {
      '@app-types': resolveSource('types'),
      '@core': resolveSource('core'),
      '@infrastructure': resolveSource('infrastructure'),
      '@view': resolveSource('view'),
      '@mocks': resolveSource('mocks'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
