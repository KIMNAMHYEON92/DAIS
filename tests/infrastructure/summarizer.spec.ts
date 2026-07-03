import { afterEach, describe, expect, it, vi } from 'vitest';

import { OllamaSummarizerClient } from '@infrastructure/ollama/summarizer';

describe('OllamaSummarizerClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requests one non-streaming Korean summary from the local Gemma model', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ response: '  핵심 정보와 반응 요약  ' })));

    const result = await new OllamaSummarizerClient().requestSummary([
      { turnIndex: 1, userQuery: '무슨 일이 있었지?', assistantResponse: '기록이 없습니다.' },
    ]);

    expect(result).toBe('핵심 정보와 반응 요약');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:11434/api/generate',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"stream":false'),
      }),
    );

    const request = fetchMock.mock.calls[0]?.[1];
    expect(String(request?.body)).toContain('"model":"gemma-4-e2b"');
    expect(String(request?.body)).toContain('Q: 무슨 일이 있었지?\\nA: 기록이 없습니다.');
  });

  it('normalizes HTTP and payload failures to the milestone error code', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 503 }));

    await expect(new OllamaSummarizerClient().requestSummary([])).rejects.toThrow(
      '[OLLAMA_SUMMARIZE_FAILED] Exception: Ollama summarizer HTTP error: 503',
    );
  });
});
