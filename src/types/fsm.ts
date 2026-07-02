/**
 * Top-level scene state controlled by the Global State Machine.
 */
export type GlobalGameState =
  | 'INIT'
  | 'MAIN_LOBBY'
  | 'CHAR_SELECT'
  | 'INTERROGATION_ACTIVE'
  | 'VERDICT_PHASE'
  | 'RESULT_SUMMARY'
  | 'CROSS_VAL_MINIGAME';

/**
 * Micro-interaction state for one interrogation turn.
 */
export type TurnSessionState =
  | 'SESSION_START'
  | 'USER_WAIT'
  | 'NPC_THINKING'
  | 'NPC_STREAMING'
  | 'CONTRADICTION_DRAGGED'
  | 'TYPING_CORRECTION'
  | 'UI_HIJACKED'
  | 'DEATH_SEQUENCE'
  | 'SESSION_END';

/**
 * Android persona state derived from the overclock gauge.
 */
export type AndroidPersonaState = 'STABLE' | 'SUSPICIOUS' | 'UNSTABLE' | 'OVERCLOCKED' | 'DEACTIVATED' | 'CALIBRATED';

/**
 * Mutable session data shared by the independent state machines.
 */
export interface GameSessionContext {
  credits: number;
  contributorScore: number;
  syncRate: number;
  overclockGauge: number;
  sessionTimer: number;
  debugTimer: number;
  panicTimer: number;
  isDamaged: boolean;
  dragLock: boolean;
}

/**
 * A state transition request with an optional, typed payload.
 */
export interface FsmEvent<TState, TPayload = Record<string, unknown>> {
  type: string;
  targetState: TState;
  payload?: TPayload;
}
