import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

const resolveSource = (directory: string): string =>
  fileURLToPath(new URL(`./src/${directory}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@app-types': resolveSource('types'),
      '@core': resolveSource('core'),
      '@infrastructure': resolveSource('infrastructure'),
      '@view': resolveSource('view'),
      '@mocks': resolveSource('mocks'),
    },
  },
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
});
