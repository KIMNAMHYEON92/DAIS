import type { DialogueTurn, LongTermAnchor, MemoryPipelineContext } from '@app-types/memory';

import { TokenEstimator } from './tokenEstimator';

export interface SummarizerClientInterface {
  requestSummary(rawTurns: DialogueTurn[]): Promise<string>;
}

const SHORT_TERM_TURN_LIMIT = 8;
const COMPRESSION_CHUNK_SIZE = 6;
const COMPRESSION_FAILURE_DROP_SIZE = 3;
const LONG_TERM_ANCHOR_LIMIT = 5;
const MEMORY_TOKEN_BUDGET = 1086;

export class MemoryPipelineController {
  private context: MemoryPipelineContext;
  private currentTurnIndex: number;

  public constructor(
    initialContext: MemoryPipelineContext,
    private readonly summarizerClient: SummarizerClientInterface,
  ) {
    this.context = {
      shortTermBuffer: initialContext.shortTermBuffer.map((turn) => ({ ...turn })),
      midTermSummaries: [...initialContext.midTermSummaries],
      longTermAnchors: initialContext.longTermAnchors.map((anchor) => ({ ...anchor })),
    };
    this.currentTurnIndex = this.getHighestKnownTurn();
  }

  public getContext(): Readonly<MemoryPipelineContext> {
    return this.context;
  }

  /**
   * 새 대화 쌍을 단기 롤링 버퍼에 추가하고 8턴을 초과하면 오래된 6턴을 압축한다.
   */
  public async addDialoguePair(query: string, response: string): Promise<void> {
    this.currentTurnIndex += 1;
    this.context.shortTermBuffer.push({
      turnIndex: this.currentTurnIndex,
      userQuery: query,
      assistantResponse: response,
    });

    if (this.context.shortTermBuffer.length > SHORT_TERM_TURN_LIMIT) {
      await this.triggerMemoryCompression();
    }
  }

  /**
   * 장기 앵커는 최대 5개를 유지한다. 같은 ID는 갱신하고, 초과 시 낮은 우선순위와
   * 오래된 게임 턴 순서로 한 개를 축출한다.
   */
  public registerLongTermAnchor(anchor: LongTermAnchor): void {
    const existingIndex = this.context.longTermAnchors.findIndex((candidate) => candidate.anchorId === anchor.anchorId);

    if (existingIndex !== -1) {
      this.context.longTermAnchors[existingIndex] = { ...anchor };
      return;
    }

    if (this.context.longTermAnchors.length >= LONG_TERM_ANCHOR_LIMIT) {
      this.context.longTermAnchors.sort((left, right) => {
        if (left.priority !== right.priority) {
          return left.priority - right.priority;
        }

        return left.gameTurn - right.gameTurn;
      });
      this.context.longTermAnchors.shift();
    }

    this.context.longTermAnchors.push({ ...anchor });
  }

  /**
   * Ollama 주입 순서에 맞춰 장기, 중기, 단기 기억을 하나의 프롬프트로 컴파일한다.
   * 전체 예산을 초과하면 원본 상태는 유지하면서 낮은 보존 단계부터 프롬프트에서 제외한다.
   */
  public compileMemoryToPrompt(): string {
    const promptContext: MemoryPipelineContext = {
      shortTermBuffer: [...this.context.shortTermBuffer],
      midTermSummaries: [...this.context.midTermSummaries],
      longTermAnchors: [...this.context.longTermAnchors],
    };
    let prompt = this.renderPrompt(promptContext);

    while (TokenEstimator.estimate(prompt) > MEMORY_TOKEN_BUDGET) {
      if (promptContext.midTermSummaries.length > 0) {
        promptContext.midTermSummaries.shift();
      } else if (promptContext.shortTermBuffer.length > 1) {
        promptContext.shortTermBuffer.shift();
      } else if (promptContext.longTermAnchors.length > 0) {
        const evictionIndex = this.findAnchorEvictionIndex(promptContext.longTermAnchors);
        promptContext.longTermAnchors.splice(evictionIndex, 1);
      } else {
        break;
      }

      prompt = this.renderPrompt(promptContext);
    }

    return prompt;
  }

  public isContextSafe(): boolean {
    return TokenEstimator.estimate(this.compileMemoryToPrompt()) <= MEMORY_TOKEN_BUDGET;
  }

  private renderPrompt(context: MemoryPipelineContext): string {
    let result = '';

    if (context.longTermAnchors.length > 0) {
      result += '[LONG-TERM MEMORY ANCHORS]\n';
      for (const anchor of context.longTermAnchors) {
        result += `- [Turn ${anchor.gameTurn}] ${anchor.summary}\n`;
      }
      result += '\n';
    }

    if (context.midTermSummaries.length > 0) {
      result += '[MID-TERM RECAP SUMMARY]\n';
      for (const summary of context.midTermSummaries) {
        result += `- ${summary}\n`;
      }
      result += '\n';
    }

    result += '[RECENT DIALOGUE LOGS]\n';
    for (const turn of context.shortTermBuffer) {
      result += `User: ${turn.userQuery}\n`;
      result += `Assistant: ${turn.assistantResponse}\n`;
    }

    return result.trim();
  }

  private findAnchorEvictionIndex(anchors: LongTermAnchor[]): number {
    let evictionIndex = 0;

    for (let index = 1; index < anchors.length; index += 1) {
      const candidate = anchors[index];
      const current = anchors[evictionIndex];

      if (
        candidate !== undefined &&
        current !== undefined &&
        (candidate.priority < current.priority ||
          (candidate.priority === current.priority && candidate.gameTurn < current.gameTurn))
      ) {
        evictionIndex = index;
      }
    }

    return evictionIndex;
  }

  private getHighestKnownTurn(): number {
    const shortTermMaximum = this.context.shortTermBuffer.reduce(
      (maximum, turn) => Math.max(maximum, turn.turnIndex),
      0,
    );
    const anchorMaximum = this.context.longTermAnchors.reduce(
      (maximum, anchor) => Math.max(maximum, anchor.gameTurn),
      0,
    );

    return Math.max(shortTermMaximum, anchorMaximum);
  }

  private async triggerMemoryCompression(): Promise<void> {
    const targetTurns = this.context.shortTermBuffer.slice(0, COMPRESSION_CHUNK_SIZE);

    try {
      const summary = await this.summarizerClient.requestSummary(targetTurns);
      this.context.midTermSummaries.push(summary);
      this.context.shortTermBuffer = this.context.shortTermBuffer.slice(COMPRESSION_CHUNK_SIZE);
    } catch {
      this.context.shortTermBuffer = this.context.shortTermBuffer.slice(COMPRESSION_FAILURE_DROP_SIZE);
    }
  }
}
