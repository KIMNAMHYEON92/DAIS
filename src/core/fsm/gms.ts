import type { FsmEvent, GameSessionContext, GlobalGameState } from '@app-types/fsm';

const INTERROGATION_DURATION_SECONDS = 180;
const OVERHEAT_PENALTY_CREDITS = 50;
const SUCCESS_SYNC_REWARD = 15;
const SUCCESS_CREDIT_REWARD = 100;

export class GlobalStateMachine {
  private currentState: GlobalGameState = 'INIT';

  private readonly context: GameSessionContext;

  private readonly transitionMap: Record<GlobalGameState, ReadonlySet<GlobalGameState>> = {
    INIT: new Set(['MAIN_LOBBY']),
    MAIN_LOBBY: new Set(['CHAR_SELECT', 'CROSS_VAL_MINIGAME']),
    CHAR_SELECT: new Set(['MAIN_LOBBY', 'INTERROGATION_ACTIVE']),
    INTERROGATION_ACTIVE: new Set(['VERDICT_PHASE', 'RESULT_SUMMARY']),
    VERDICT_PHASE: new Set(['RESULT_SUMMARY']),
    RESULT_SUMMARY: new Set(['MAIN_LOBBY']),
    CROSS_VAL_MINIGAME: new Set(['MAIN_LOBBY']),
  };

  public constructor(initialContext: GameSessionContext) {
    this.context = { ...initialContext };
  }

  public getState(): GlobalGameState {
    return this.currentState;
  }

  public getContext(): Readonly<GameSessionContext> {
    return this.context;
  }

  public updateContext(updater: (context: GameSessionContext) => void): void {
    updater(this.context);
  }

  public transition(event: FsmEvent<GlobalGameState>): void {
    const nextState = event.targetState;
    const allowedStates = this.transitionMap[this.currentState];

    if (!allowedStates.has(nextState)) {
      throw new Error(`[GMS_TRANSITION_ERROR] Invalid transition attempt: ${this.currentState} -> ${nextState}`);
    }

    this.onTransitionExecute(this.currentState, nextState, event.payload);
    this.currentState = nextState;
  }

  private onTransitionExecute(from: GlobalGameState, to: GlobalGameState, payload?: Record<string, unknown>): void {
    if (to === 'INTERROGATION_ACTIVE') {
      this.context.syncRate = 0;
      this.context.overclockGauge = 0;
      this.context.sessionTimer = INTERROGATION_DURATION_SECONDS;
      this.context.dragLock = false;
    }

    if (to !== 'RESULT_SUMMARY' || from !== 'INTERROGATION_ACTIVE') {
      return;
    }

    if (this.context.overclockGauge >= 100) {
      this.context.isDamaged = true;
      this.context.credits = Math.max(0, this.context.credits - OVERHEAT_PENALTY_CREDITS);
      return;
    }

    if (payload?.success === true) {
      this.context.syncRate = Math.min(100, this.context.syncRate + SUCCESS_SYNC_REWARD);
      this.context.credits += SUCCESS_CREDIT_REWARD;
    }
  }
}
