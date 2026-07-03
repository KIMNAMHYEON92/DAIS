import { beforeEach, describe, expect, it } from 'vitest';

import { OverclockEngine } from '@core/validator/overclockEngine';
import { DeterministicTypingValidator } from '@core/validator/typingValidator';
import type { ValidationRules } from '@app-types/validator';

const MINIMUM_INPUT_LENGTH = 10;
const MAXIMUM_INPUT_LENGTH = 100;
const OVER_MAXIMUM_INPUT_LENGTH = 101;
const MAXIMUM_GAUGE = 100;
const ONE_SECOND = 1;
const TWO_SECONDS = 2;
const TEN_SECONDS = 10;
const SIXTY_FRAMES = 60;
const STABLE_RATE = 1.5;
const PASSIVE_MULTIPLIER_RESULT = 7.5;
const STREAMING_START_GAUGE = 10;
const STREAMING_RESULT = 12.5;
const TERMINAL_STATE_GAUGE = 40;
const DEBUG_SUCCESS_START_GAUGE = 25;
const DEBUG_FAIL_START_GAUGE = 90;

describe('[Milestone 5] Validator & Overclock Engine Unit Tests', () => {
  let validator: DeterministicTypingValidator;
  let overclockEngine: OverclockEngine;
  let defaultRules: ValidationRules;

  beforeEach(() => {
    validator = new DeterministicTypingValidator();
    overclockEngine = new OverclockEngine();
    defaultRules = {
      requiredKeywords: ['3월 15일', '3월 29일', '탈취', '공장'],
      minimumKeywordMatchCount: 2,
      forbiddenPatterns: ['^[ㄱ-ㅎㅏ-ㅣ]+$', '바보', '쓰레기', '섹스'],
    };
  });

  describe('deterministic typing validation', () => {
    it('accepts a correction containing enough keywords despite spacing differences', () => {
      const result = validator.validate(
        '공장은 3월15일 가동되었으며 3월 29일에 탈취된 이력이 확인됩니다.',
        defaultRules,
      );

      expect(result).toMatchObject({
        isValid: true,
        errorCode: 'NONE',
        matchedKeywords: ['3월 15일', '3월 29일', '탈취', '공장'],
        matchCount: 4,
      });
    });

    it('rejects input shorter than ten trimmed characters', () => {
      expect(validator.validate('아님 3월15', defaultRules)).toMatchObject({
        isValid: false,
        errorCode: 'TOO_SHORT',
        matchCount: 0,
      });
    });

    it('accepts the inclusive length boundaries and rejects input over 100 characters', () => {
      const boundaryRules: ValidationRules = {
        requiredKeywords: [],
        minimumKeywordMatchCount: 0,
        forbiddenPatterns: [],
      };

      expect(validator.validate('가'.repeat(MINIMUM_INPUT_LENGTH), boundaryRules).isValid).toBe(true);
      expect(validator.validate('가'.repeat(MAXIMUM_INPUT_LENGTH), boundaryRules).isValid).toBe(true);
      expect(validator.validate('가'.repeat(OVER_MAXIMUM_INPUT_LENGTH), boundaryRules).errorCode).toBe('TOO_LONG');
    });

    it('rejects consonant spam and forbidden words', () => {
      expect(validator.validate('ㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋ', defaultRules).errorCode).toBe(
        'FORBIDDEN_PATTERN',
      );
      expect(validator.validate('3월 15일에 탈취당했는데 일 안하고 노는 바보입니다.', defaultRules).errorCode).toBe(
        'FORBIDDEN_PATTERN',
      );
    });

    it('returns partial keyword evidence when the minimum match count is not met', () => {
      const result = validator.validate('당장 3월 15일에 입고된 로그만 존재하는데 이의가 있습니까?', defaultRules);

      expect(result).toMatchObject({
        isValid: false,
        errorCode: 'INSUFFICIENT_KEYWORDS',
        matchedKeywords: ['3월 15일'],
        matchCount: 1,
      });
    });
  });

  describe('real-time overclock calculations', () => {
    it('accumulates passive heat using the active APS multiplier', () => {
      expect(overclockEngine.tick(ONE_SECOND, 'STABLE', false)).toBe(STABLE_RATE);
      expect(overclockEngine.tick(TWO_SECONDS, 'OVERCLOCKED', false)).toBe(PASSIVE_MULTIPLIER_RESULT);
    });

    it('adds streaming acceleration independently of the APS multiplier', () => {
      overclockEngine.setGauge(STREAMING_START_GAUGE);

      expect(overclockEngine.tick(ONE_SECOND, 'STABLE', true)).toBe(STREAMING_RESULT);
    });

    it('stops passive accumulation in terminal persona states', () => {
      overclockEngine.setGauge(TERMINAL_STATE_GAUGE);

      expect(overclockEngine.tick(TEN_SECONDS, 'DEACTIVATED', false)).toBe(TERMINAL_STATE_GAUGE);
      expect(overclockEngine.tick(TEN_SECONDS, 'CALIBRATED', false)).toBe(TERMINAL_STATE_GAUGE);
    });

    it('applies event deltas and clamps the gauge to zero and 100', () => {
      overclockEngine.setGauge(DEBUG_SUCCESS_START_GAUGE);
      expect(overclockEngine.applyEvent('DEBUG_SUCCESS')).toBe(0);

      overclockEngine.setGauge(DEBUG_FAIL_START_GAUGE);
      expect(overclockEngine.applyEvent('DEBUG_FAIL')).toBe(MAXIMUM_GAUGE);
    });

    it('preserves four-decimal public precision across 60 FPS ticks', () => {
      for (let frame = 0; frame < SIXTY_FRAMES; frame += 1) {
        overclockEngine.tick(ONE_SECOND / SIXTY_FRAMES, 'STABLE', false);
      }

      expect(overclockEngine.getGauge()).toBe(STABLE_RATE);
    });

    it('rejects negative or non-finite physical inputs', () => {
      expect(() => overclockEngine.tick(-ONE_SECOND, 'STABLE', false)).toThrowError('[OVERCLOCK_VALUE_ERROR]');
      expect(() => overclockEngine.setGauge(Number.NaN)).toThrowError('[OVERCLOCK_VALUE_ERROR]');
    });
  });
});
