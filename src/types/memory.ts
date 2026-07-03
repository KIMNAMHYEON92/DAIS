export interface DialogueTurn {
  turnIndex: number;
  userQuery: string;
  assistantResponse: string;
}

export interface LongTermAnchor {
  anchorId: string;
  gameTurn: number;
  summary: string;
  priority: number;
}

export interface MemoryPipelineContext {
  shortTermBuffer: DialogueTurn[];
  midTermSummaries: string[];
  longTermAnchors: LongTermAnchor[];
}
