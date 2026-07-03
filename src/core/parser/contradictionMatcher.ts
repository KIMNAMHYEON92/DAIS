import type { CapturedDragData, DialogueEntity, MatchingResult, MatchingRuleConfig } from '@app-types/parser';

const MINIMUM_DRAG_LENGTH = 4;

const removeWhitespace = (value: string): string => value.replace(/\s+/gu, '');

export class ContradictionMatcher {
  public evaluate(
    dragData: CapturedDragData,
    dialogueList: ReadonlyMap<string, DialogueEntity>,
    rules: readonly MatchingRuleConfig[],
  ): MatchingResult {
    const targetDialogue = dialogueList.get(dragData.dialogueId);

    if (targetDialogue === undefined) {
      return {
        isMatch: false,
        errorCode: 'INVALID_TARGET',
        penaltyApplied: true,
      };
    }

    const selectedText = removeWhitespace(dragData.selectedText);
    if (selectedText.length < MINIMUM_DRAG_LENGTH) {
      return {
        isMatch: false,
        errorCode: 'TOO_SHORT',
        penaltyApplied: false,
        targetDialogue,
      };
    }

    if (!targetDialogue.isHallucination) {
      return {
        isMatch: false,
        errorCode: 'NOT_HALLUCINATION',
        penaltyApplied: true,
        targetDialogue,
      };
    }

    const rule = rules[targetDialogue.associatedRuleIndex];
    if (rule === undefined || !removeWhitespace(rule.erroneousStatement).includes(selectedText)) {
      return {
        isMatch: false,
        errorCode: 'MISMATCH',
        penaltyApplied: true,
        targetDialogue,
      };
    }

    return {
      isMatch: true,
      errorCode: 'NONE',
      penaltyApplied: false,
      targetDialogue,
    };
  }
}
