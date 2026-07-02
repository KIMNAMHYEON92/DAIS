import { describe, expect, it } from 'vitest';

describe('Development Environment Smoke Test', () => {
  it('should prove that WebGPU mocks are successfully mounted', async () => {
    expect(navigator.gpu).toBeDefined();

    const adapter = await navigator.gpu.requestAdapter();

    expect(adapter).not.toBeNull();

    const device = await adapter?.requestDevice();

    expect(device).toBeDefined();
  });

  it('should prove that IndexedDB mock works perfectly in memory', async () => {
    expect(globalThis.indexedDB).toBeDefined();

    const request = globalThis.indexedDB.open('test_db', 1);
    const successPromise = new Promise<boolean>((resolve, reject) => {
      request.onerror = (): void => {
        reject(request.error);
      };
      request.onsuccess = (): void => {
        const db = request.result;

        expect(db.name).toBe('test_db');
        db.close();
        resolve(true);
      };
    });

    await expect(successPromise).resolves.toBe(true);
  });

  it('should prove that Selection standard API mock functions well', () => {
    const selection = window.getSelection();

    expect(selection).not.toBeNull();
    expect(selection?.toString()).toBe('');
  });
});
