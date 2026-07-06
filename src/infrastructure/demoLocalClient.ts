import { OllamaLocalClient, type LocalStreamingClient, type OllamaStreamingOptions } from './ollamaClient';

const ARIA_ID = 'AND_ARIA_09';

const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));

/**
 * A deterministic, zero-install inference fixture that keeps the complete MVP
 * loop playable when no local model runtime is available.
 */
export class DemoLocalClient implements LocalStreamingClient {
  public async streamChat(options: OllamaStreamingOptions): Promise<void> {
    const response = this.buildResponse(options.prompt);
    const markup = `<agent id="${ARIA_ID}">${response}</agent>`;
    const chunks = this.chunk(markup, 14);

    try {
      for (const chunk of chunks) {
        options.onToken(chunk);
        await delay(18);
      }
      options.onComplete(markup);
    } catch (error) {
      options.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private buildResponse(prompt: string): string {
    const query = prompt.split('[USER QUESTION]').at(-1)?.trim() ?? prompt;

    if (/(3번|보관고|분실|점검\s*로그)/u.test(query)) {
      return '3번 무기 보관고는 2026년 3월 10일부터 상시 수리 모드였으므로 완벽히 폐쇄되어 있었고, 분실된 무기는 단 한 자루도 없습니다.';
    }

    if (/(가동|출하|언제)/u.test(query)) {
      return '본 기체는 2026년 3월 15일 공장 출하 및 초기 가동 승인을 완료했습니다.';
    }

    if (/(오일|윤활)/u.test(query)) {
      return '에너스 오일-v2는 24시간 주기로 공급받고 있습니다. 정비 기록에는 이상이 없습니다.';
    }

    if (/(누구|이름|신원)/u.test(query)) {
      return '중앙 통제실 무기 관리 감독관 아리아-09입니다. 허가된 질문에만 답변합니다.';
    }

    return '해당 질의는 현재 접근 권한 밖입니다. 무기 보관고 점검 기록에 관한 질문으로 범위를 좁히십시오.';
  }

  private chunk(value: string, size: number): string[] {
    const chunks: string[] = [];
    for (let index = 0; index < value.length; index += size) {
      chunks.push(value.slice(index, index + size));
    }
    return chunks;
  }
}

export type RuntimeEngineMode = 'DEMO' | 'OLLAMA';

/**
 * Uses Ollama when requested and transparently falls back to the deterministic
 * demo engine when the local endpoint, model, or CORS configuration is absent.
 */
export class ResilientLocalClient implements LocalStreamingClient {
  private readonly demo = new DemoLocalClient();
  private readonly ollama = new OllamaLocalClient();

  public constructor(
    private readonly mode: RuntimeEngineMode,
    private readonly onRuntimeResolved: (runtime: 'DEMO' | 'OLLAMA' | 'FALLBACK') => void,
  ) {}

  public async streamChat(options: OllamaStreamingOptions): Promise<void> {
    if (this.mode === 'DEMO') {
      this.onRuntimeResolved('DEMO');
      await this.demo.streamChat(options);
      return;
    }

    let completed = false;
    const bufferedTokens: string[] = [];
    await this.ollama.streamChat({
      ...options,
      onToken: (token) => bufferedTokens.push(token),
      onComplete: (fullText) => {
        completed = true;
        this.onRuntimeResolved('OLLAMA');
        for (const token of bufferedTokens) {
          options.onToken(token);
        }
        options.onComplete(fullText);
      },
      onError: () => undefined,
    });

    if (!completed) {
      this.onRuntimeResolved('FALLBACK');
      await this.demo.streamChat(options);
    }
  }
}
