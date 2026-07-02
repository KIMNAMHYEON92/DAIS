import { afterEach, describe, expect, it, vi } from 'vitest';

import { OllamaLocalClient } from '@infrastructure/ollamaClient';

describe('OllamaLocalClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reassembles split NDJSON chunks and streams every token', async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller): void {
        controller.enqueue(encoder.encode('{"response":"안'));
        controller.enqueue(encoder.encode('녕"}\n{"response":"!"}\n'));
        controller.close();
      },
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body, { status: 200 }));
    const onToken = vi.fn();
    const onComplete = vi.fn();
    const onError = vi.fn();

    await new OllamaLocalClient().streamChat({
      model: 'gemma-4-e2b',
      prompt: 'hello',
      onToken,
      onComplete,
      onError,
    });

    expect(onToken.mock.calls).toEqual([['안녕'], ['!']]);
    expect(onComplete).toHaveBeenCalledWith('안녕!');
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports HTTP failures through the error callback', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 503 }));
    const onError = vi.fn();

    await new OllamaLocalClient().streamChat({
      model: 'gemma-4-e2b',
      prompt: 'hello',
      onToken: vi.fn(),
      onComplete: vi.fn(),
      onError,
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Ollama API responded with HTTP status 503' }),
    );
  });
});
