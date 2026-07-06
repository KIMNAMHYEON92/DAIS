import { DemoLocalClient, ResilientLocalClient } from '@infrastructure/demoLocalClient';

describe('Playable demo local inference clients', () => {
  it('streams the canonical contradiction without a model installation', async () => {
    const client = new DemoLocalClient();
    const tokens: string[] = [];
    let completed = '';

    await client.streamChat({
      model: 'demo',
      prompt: '[USER QUESTION]\n3번 보관고 점검 로그를 보고해.',
      onToken: (token) => tokens.push(token),
      onComplete: (fullText) => {
        completed = fullText;
      },
      onError: (error) => {
        throw error;
      },
    });

    expect(tokens.length).toBeGreaterThan(1);
    expect(tokens.join('')).toBe(completed);
    expect(completed).toContain('2026년 3월 10일');
    expect(completed).toContain('<agent id="AND_ARIA_09">');
  });

  it('reports the deterministic runtime when demo mode is selected', async () => {
    const runtimeEvents: string[] = [];
    const client = new ResilientLocalClient('DEMO', (runtime) => runtimeEvents.push(runtime));

    await client.streamChat({
      model: 'demo',
      prompt: '[USER QUESTION]\n당신은 누구지?',
      onToken: () => undefined,
      onComplete: () => undefined,
      onError: (error) => {
        throw error;
      },
    });

    expect(runtimeEvents).toEqual(['DEMO']);
  });
});
