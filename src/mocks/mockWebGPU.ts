import { vi } from 'vitest';

export const installWebGPUMock = (): void => {
  const device = {
    createShaderModule: vi.fn(),
    createBindGroupLayout: vi.fn(),
    createPipelineLayout: vi.fn(),
    createRenderPipeline: vi.fn(),
    createBuffer: vi.fn(),
    destroy: vi.fn(),
  };

  const adapter = {
    features: new Set(),
    limits: {},
    requestDevice: vi.fn().mockResolvedValue(device),
  };

  Object.defineProperty(globalThis.navigator, 'gpu', {
    configurable: true,
    writable: true,
    value: {
      requestAdapter: vi.fn().mockResolvedValue(adapter),
    },
  });
};
