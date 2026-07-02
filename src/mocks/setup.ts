import { vi } from 'vitest';
import { installIndexedDBMock } from './mockIndexedDB';
import './mockWebLLM';
import { installWebGPUMock } from './mockWebGPU';

installIndexedDBMock();
installWebGPUMock();

Object.defineProperty(globalThis.window, 'getSelection', {
  configurable: true,
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    toString: (): string => '',
    anchorNode: null,
    focusNode: null,
    anchorOffset: 0,
    focusOffset: 0,
    removeAllRanges: vi.fn(),
    addRange: vi.fn(),
  })),
});
