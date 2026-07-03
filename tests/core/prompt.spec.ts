import { describe, expect, it } from 'vitest';

import { PromptCompiler } from '@core/prompt/compiler';
import { StreamingMarkupParser } from '@core/prompt/markupParser';
import type { CharacterPack } from '@app-types/character';

describe('[Milestone 2] Prompt & Parser Unit Tests', () => {
  const mockAriaPack: CharacterPack = {
    characterId: 'AND_ARIA_09',
    displayName: '아리아-09',
    coreIdentity: {
      modelSeries: 'Aegis-v4',
      apparentAge: '19세',
      roleInFacility: '무기 관리 감독관',
      basicPersonality: '냉정함',
      speechStyle: '~입니다 체',
    },
    knowledgeBase: {
      publicFacts: ['2026년 3월 15일 초기 가동 승인'],
      hiddenSecrets: ['전술 코어 탈취 은폐 중'],
    },
    hallucinationRules: [
      {
        triggerCondition: '무기 분실 내역 점검',
        erroneousStatement: '3번 무기 보관고는 상시 수리 모드였습니다.',
        correctFact: '전술 코어가 침입자에 의해 탈취당했습니다.',
        clueHint: '공장 가동일과의 시계열 모순.',
      },
    ],
    behaviorGuardrails: ['자신이 게임 내 NPC임을 발설하지 말 것.'],
  };

  describe('PromptCompiler', () => {
    it('compiles snake-case JSON inside the character metadata block', () => {
      const systemPrompt = PromptCompiler.compile(mockAriaPack);
      const metadata = systemPrompt.match(
        /<CHARACTER_METADATA>\s*([\s\S]*?)\s*<\/CHARACTER_METADATA>/,
      );

      expect(metadata).not.toBeNull();
      expect(JSON.parse(metadata?.[1] ?? '{}')).toMatchObject({
        character_id: 'AND_ARIA_09',
        knowledge_base: {
          hidden_secrets: ['전술 코어 탈취 은폐 중'],
        },
        hallucination_rules: [
          {
            erroneous_statement: '3번 무기 보관고는 상시 수리 모드였습니다.',
          },
        ],
      });
      expect(systemPrompt).toContain('[SYSTEM PROTOCOL: ROLEPLAY ENGINE]');
    });

    it('generates the static multi-agent game master protocol', () => {
      const gmPrompt = PromptCompiler.compileGameMasterMode();

      expect(gmPrompt).toContain('[SYSTEM PROTOCOL: GAME MASTER MODE]');
      expect(gmPrompt).toContain('<agent id="AND_ARIA_09">');
      expect(gmPrompt).toContain('<agent id="SYS_CONSOLE">');
      expect(gmPrompt).toContain('[STRICT FACT ISOLATION RULE]');
    });
  });

  describe('StreamingMarkupParser', () => {
    it('parses adjacent complete agent segments', () => {
      const parser = new StreamingMarkupParser();
      const results = parser.write(
        '<agent id="AND_ARIA_09">안녕하세요.</agent><agent id="SYS_CONSOLE">[ALERT]</agent>',
      );

      expect(results).toEqual([
        { agentId: 'AND_ARIA_09', content: '안녕하세요.', isComplete: true },
        { agentId: 'SYS_CONSOLE', content: '[ALERT]', isComplete: true },
      ]);
    });

    it('returns cumulative snapshots for stateful token chunks', () => {
      const parser = new StreamingMarkupParser();

      expect(parser.write('<agent id="AND_ARIA_09">오늘')).toEqual([
        { agentId: 'AND_ARIA_09', content: '오늘', isComplete: false },
      ]);
      expect(parser.write(' 점검 일정이 없습니다.')).toEqual([
        {
          agentId: 'AND_ARIA_09',
          content: '오늘 점검 일정이 없습니다.',
          isComplete: false,
        },
      ]);
      expect(parser.write('</agent>')).toEqual([
        {
          agentId: 'AND_ARIA_09',
          content: '오늘 점검 일정이 없습니다.',
          isComplete: true,
        },
      ]);
    });

    it('waits for opening and closing tags split across arbitrary chunks', () => {
      const parser = new StreamingMarkupParser();

      expect(parser.write('<ag')).toEqual([]);
      expect(parser.write('ent id="AND_ARIA_09">응답</ag')).toEqual([
        { agentId: 'AND_ARIA_09', content: '응답', isComplete: false },
      ]);
      expect(parser.write('ent>')).toEqual([
        { agentId: 'AND_ARIA_09', content: '응답', isComplete: true },
      ]);
    });

    it('falls back to the system console for unstructured text', () => {
      const parser = new StreamingMarkupParser();

      expect(parser.write('비정형 텍스트 유실 구문')).toEqual([
        {
          agentId: 'SYS_CONSOLE',
          content: '비정형 텍스트 유실 구문',
          isComplete: false,
        },
      ]);
    });

    it('flushes an unclosed active segment and resets parser state', () => {
      const parser = new StreamingMarkupParser();

      parser.write('<agent id="AND_ARIA_09">미완성 응답</agen');
      expect(parser.flush()).toEqual([
        { agentId: 'AND_ARIA_09', content: '미완성 응답', isComplete: true },
      ]);
      expect(parser.write('<agent id="SYS_CONSOLE">복구</agent>')).toEqual([
        { agentId: 'SYS_CONSOLE', content: '복구', isComplete: true },
      ]);
    });
  });
});
