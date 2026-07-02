export type GlobalGameState =
  | 'INIT'
  | 'MAIN_LOBBY'
  | 'CHAR_SELECT'
  | 'INTERROGATION_ACTIVE'
  | 'VERDICT_PHASE'
  | 'RESULT_SUMMARY'
  | 'CROSS_VAL_MINIGAME';

export type InterrogationTurnState =
  | 'SESSION_START'
  | 'USER_WAIT'
  | 'NPC_THINKING'
  | 'NPC_STREAMING'
  | 'CONTRADICTION_DRAGGED'
  | 'TYPING_CORRECTION'
  | 'OVERCLOCK_SPIKE'
  | 'UI_HIJACKED'
  | 'DEATH_SEQUENCE'
  | 'SESSION_END';

export interface StateTransition<State extends string, Event extends string> {
  readonly from: State;
  readonly event: Event;
  readonly to: State;
}
