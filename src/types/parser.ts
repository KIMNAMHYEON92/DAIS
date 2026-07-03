export interface DialogueEntity {
  dialogueId: string;
  turnIndex: number;
  speakerId: string;
  textContent: string;
  isHallucination: boolean;
  associatedRuleIndex: number;
}

export interface CapturedDragData {
  dialogueId: string;
  selectedText: string;
  startOffset: number;
  endOffset: number;
}

export interface MatchingRuleConfig {
  erroneousStatement: string;
  correctFact: string;
  clueHint: string;
}

export type MatchingErrorCode = 'INVALID_TARGET' | 'TOO_SHORT' | 'NOT_HALLUCINATION' | 'MISMATCH' | 'NONE';

export interface MatchingResult {
  isMatch: boolean;
  errorCode: MatchingErrorCode;
  penaltyApplied: boolean;
  targetDialogue?: DialogueEntity;
}
