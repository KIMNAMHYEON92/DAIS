import { indexedDB } from 'fake-indexeddb';

export const installIndexedDBMock = (): void => {
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    writable: true,
    value: indexedDB,
  });
};
