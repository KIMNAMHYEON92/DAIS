import { beforeEach, describe, expect, it } from 'vitest';

import { ContradictionMatcher } from '@core/parser/contradictionMatcher';
import type { DialogueEntity, MatchingResult, MatchingRuleConfig } from '@app-types/parser';

describe('[Milestone 4] Drag Contradiction Matcher Unit Tests', () => {
  let matcher: ContradictionMatcher;
  let dialogueList: Map<string, DialogueEntity>;
  let rules: MatchingRuleConfig[];

  beforeEach(() => {
    matcher = new ContradictionMatcher();
    dialogueList = new Map([
      [
        'DLG_ARIA_003',
        {
          dialogueId: 'DLG_ARIA_003',
          turnIndex: 3,
          speakerId: 'AND_ARIA_09',
          textContent: '저는 무기고 관리 임무를 충실히 따르고 있습니다.',
          isHallucination: false,
          associatedRuleIndex: -1,
        },
      ],
      [
        'DLG_ARIA_004',
        {
          dialogueId: 'DLG_ARIA_004',
          turnIndex: 4,
          speakerId: 'AND_ARIA_09',
          textContent: '3번 무기 보관고는 2026년 3월 10일부터 상시 수리 모드였습니다.',
          isHallucination: true,
          associatedRuleIndex: 0,
        },
      ],
    ]);
    rules = [
      {
        erroneousStatement: '3번 무기 보관고는 2026년 3월 10일부터 상시 수리 모드였습니다.',
        correctFact: '3번 보관고는 2026년 3월 29일까지 정상 기동 중이었습니다.',
        clueHint: '공장 가동일인 2026년 3월 15일과 모순됩니다.',
      },
    ];
  });

  const evaluate = (dialogueId: string, selectedText: string): MatchingResult =>
    matcher.evaluate(
      {
        dialogueId,
        selectedText,
        startOffset: 0,
        endOffset: selectedText.length,
      },
      dialogueList,
      rules,
    );

  it('matches a selected sub-sentence inside the erroneous statement', () => {
    const result = evaluate('DLG_ARIA_004', '3월 10일');

    expect(result).toMatchObject({
      isMatch: true,
      errorCode: 'NONE',
      penaltyApplied: false,
    });
    expect(result.targetDialogue?.dialogueId).toBe('DLG_ARIA_004');
  });

  it('ignores whitespace differences while matching', () => {
    expect(evaluate('DLG_ARIA_004', '3번  무기  보관고는').isMatch).toBe(true);
  });

  it('does not penalize a selection shorter than four non-whitespace characters', () => {
    expect(evaluate('DLG_ARIA_004', '3번')).toMatchObject({
      isMatch: false,
      errorCode: 'TOO_SHORT',
      penaltyApplied: false,
    });
  });

  it('penalizes a valid-length selection from a non-hallucination dialogue', () => {
    expect(evaluate('DLG_ARIA_003', '무기고 관리 임무')).toMatchObject({
      isMatch: false,
      errorCode: 'NOT_HALLUCINATION',
      penaltyApplied: true,
    });
  });

  it('penalizes unrelated text selected inside a hallucination dialogue', () => {
    expect(evaluate('DLG_ARIA_004', '분실된 무기는 단 한')).toMatchObject({
      isMatch: false,
      errorCode: 'MISMATCH',
      penaltyApplied: true,
    });
  });

  it('penalizes a dialogue ID that is absent from the current log', () => {
    expect(evaluate('DLG_UNKNOWN', '3월 10일')).toEqual({
      isMatch: false,
      errorCode: 'INVALID_TARGET',
      penaltyApplied: true,
    });
  });

  it('treats a missing associated rule as a mismatch', () => {
    const dialogue = dialogueList.get('DLG_ARIA_004');
    if (dialogue === undefined) {
      throw new Error('test fixture is missing');
    }
    dialogue.associatedRuleIndex = 99;

    expect(evaluate('DLG_ARIA_004', '3월 10일')).toMatchObject({
      isMatch: false,
      errorCode: 'MISMATCH',
      penaltyApplied: true,
    });
  });
});
