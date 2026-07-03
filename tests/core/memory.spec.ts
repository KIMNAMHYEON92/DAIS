/* eslint-disable no-magic-numbers */
import { describe, expect, it } from 'vitest';

import { MemoryPipelineController } from '@core/memory/memoryPipeline';
import type { SummarizerClientInterface } from '@core/memory/memoryPipeline';
import { TokenEstimator } from '@core/memory/tokenEstimator';
import type { DialogueTurn, LongTermAnchor, MemoryPipelineContext } from '@app-types/memory';

class MockSummarizer implements SummarizerClientInterface {
  public async requestSummary(rawTurns: DialogueTurn[]): Promise<string> {
    const firstQuestion = rawTurns[0]?.userQuery ?? '';
    const lastQuestion = rawTurns.at(-1)?.userQuery ?? '';

    return `[Mock요약]: 유저가 '${firstQuestion}'부터 '${lastQuestion}'까지 물었으며 기지가 개방됨.`;
  }
}

const getCleanContext = (): MemoryPipelineContext => ({
  shortTermBuffer: [],
  midTermSummaries: [],
  longTermAnchors: [],
});

describe('[Milestone 3] 3-Stage Memory Pipeline Unit Tests', () => {
  describe('Token Estimator Tests', () => {
    it('approximates Korean characters more heavily than English characters', () => {
      const englishTokens = TokenEstimator.estimate('The central weapon store is locked.');
      const koreanTokens = TokenEstimator.estimate('중앙 무기 보관고는 잠겨있습니다.');

      expect(koreanTokens).toBeGreaterThan(englishTokens);
    });

    it('returns zero for an empty or whitespace-only string', () => {
      expect(TokenEstimator.estimate('')).toBe(0);
      expect(TokenEstimator.estimate(' \n\t ')).toBe(0);
    });
  });

  describe('Short-term and Mid-term Memory Lifecycle Tests', () => {
    it('summarizes turns 1-6 and preserves turns 7-9 when the buffer exceeds 8 turns', async () => {
      const controller = new MemoryPipelineController(getCleanContext(), new MockSummarizer());

      for (let index = 1; index <= 8; index += 1) {
        await controller.addDialoguePair(`질문_${index}`, `답변_${index}`);
      }

      expect(controller.getContext().shortTermBuffer).toHaveLength(8);
      expect(controller.getContext().midTermSummaries).toHaveLength(0);

      await controller.addDialoguePair('질문_9', '답변_9');

      const context = controller.getContext();
      expect(context.shortTermBuffer).toHaveLength(3);
      expect(context.shortTermBuffer[0]?.turnIndex).toBe(7);
      expect(context.midTermSummaries).toEqual([
        "[Mock요약]: 유저가 '질문_1'부터 '질문_6'까지 물었으며 기지가 개방됨.",
      ]);
    });

    it('drops only the oldest 3 turns if background summarization fails', async () => {
      const failingSummarizer: SummarizerClientInterface = {
        requestSummary: async (): Promise<string> => {
          throw new Error('offline');
        },
      };
      const controller = new MemoryPipelineController(getCleanContext(), failingSummarizer);

      for (let index = 1; index <= 9; index += 1) {
        await controller.addDialoguePair(`질문_${index}`, `답변_${index}`);
      }

      expect(controller.getContext().shortTermBuffer).toHaveLength(6);
      expect(controller.getContext().shortTermBuffer[0]?.turnIndex).toBe(4);
      expect(controller.getContext().midTermSummaries).toHaveLength(0);
    });
  });

  describe('Long-term Anchor Slot Constraints and Eviction Policy Tests', () => {
    it('updates an existing anchor with the same ID', () => {
      const controller = new MemoryPipelineController(getCleanContext(), new MockSummarizer());
      const anchor: LongTermAnchor = {
        anchorId: 'ANC_01',
        gameTurn: 5,
        summary: '기억_1',
        priority: 3,
      };

      controller.registerLongTermAnchor(anchor);
      controller.registerLongTermAnchor({ ...anchor, summary: '기억_업데이트' });

      expect(controller.getContext().longTermAnchors).toHaveLength(1);
      expect(controller.getContext().longTermAnchors[0]?.summary).toBe('기억_업데이트');
    });

    it('evicts the lowest-priority and then oldest anchor beyond the 5-slot limit', () => {
      const controller = new MemoryPipelineController(getCleanContext(), new MockSummarizer());

      for (let index = 1; index <= 5; index += 1) {
        controller.registerLongTermAnchor({
          anchorId: `ANC_0${index}`,
          gameTurn: index * 10,
          summary: `중요기억_${index}`,
          priority: index === 1 ? 1 : 5,
        });
      }

      controller.registerLongTermAnchor({
        anchorId: 'ANC_06',
        gameTurn: 60,
        summary: '새로운_중요기억_6',
        priority: 5,
      });

      const anchors = controller.getContext().longTermAnchors;
      expect(anchors).toHaveLength(5);
      expect(anchors.some((anchor) => anchor.anchorId === 'ANC_01')).toBe(false);
    });
  });

  describe('Prompt Compilation and Token Budget Tests', () => {
    it('compiles long-, mid-, and short-term memory in injection order', async () => {
      const controller = new MemoryPipelineController(
        {
          shortTermBuffer: [{ turnIndex: 3, userQuery: '질문', assistantResponse: '답변' }],
          midTermSummaries: ['중기 요약'],
          longTermAnchors: [{ anchorId: 'ANC_01', gameTurn: 2, summary: '장기 기억', priority: 5 }],
        },
        new MockSummarizer(),
      );

      expect(controller.compileMemoryToPrompt()).toBe(
        [
          '[LONG-TERM MEMORY ANCHORS]',
          '- [Turn 2] 장기 기억',
          '',
          '[MID-TERM RECAP SUMMARY]',
          '- 중기 요약',
          '',
          '[RECENT DIALOGUE LOGS]',
          'User: 질문',
          'Assistant: 답변',
        ].join('\n'),
      );
    });

    it('keeps the milestone scenario within the 1,086-token memory budget', async () => {
      const controller = new MemoryPipelineController(getCleanContext(), new MockSummarizer());

      for (let index = 1; index <= 8; index += 1) {
        await controller.addDialoguePair(
          `검사관 질문입니다. 보관고 번호 ${index}번에 대한 침입 로그와 실시간 과열 지표 정보가 올바르게 덤프된 레코드입니까?`,
          `이에 대해 대답해 드리겠습니다. ${index}번 구역 레이저 장비는 현재 정상 점검을 가동하여 완료 단계에 근접해 있는 안드로이드 통제 구역입니다.`,
        );
      }

      for (let index = 1; index <= 5; index += 1) {
        controller.registerLongTermAnchor({
          anchorId: `ANC_0${index}`,
          gameTurn: index * 5,
          summary: `장기 보관용 백업 구역 요약본 ${index} 데이터. 검사관이 직접 친밀 위로 코드를 갱신하여 인지 가드가 강화된 특이점 레코드입니다.`,
          priority: 5,
        });
      }

      await controller.addDialoguePair('마지막 9차 질의문 전송', '9차 답변 적용');

      const finalPrompt = controller.compileMemoryToPrompt();
      expect(controller.isContextSafe()).toBe(true);
      expect(TokenEstimator.estimate(finalPrompt)).toBeLessThanOrEqual(1086);
    });
  });
});
