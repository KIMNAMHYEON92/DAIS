import type { FsmEvent, GameSessionContext, TurnSessionState } from '@app-types/fsm';

const DEBUG_TIMEOUT_SECONDS = 15;
const PANIC_TIMEOUT_SECONDS = 10;

export class InterrogationStateMachine {
  private currentState: TurnSessionState = 'SESSION_START';

  private readonly context: GameSessionContext;

  private readonly transitionMap: Record<TurnSessionState, ReadonlySet<TurnSessionState>> = {
    SESSION_START: new Set(['USER_WAIT']),
    USER_WAIT: new Set(['NPC_THINKING', 'CONTRADICTION_DRAGGED', 'DEATH_SEQUENCE']),
    NPC_THINKING: new Set(['NPC_STREAMING', 'DEATH_SEQUENCE']),
    NPC_STREAMING: new Set(['USER_WAIT', 'DEATH_SEQUENCE']),
    CONTRADICTION_DRAGGED: new Set(['TYPING_CORRECTION', 'USER_WAIT', 'DEATH_SEQUENCE']),
    TYPING_CORRECTION: new Set(['USER_WAIT', 'UI_HIJACKED', 'DEATH_SEQUENCE']),
    UI_HIJACKED: new Set(['USER_WAIT', 'DEATH_SEQUENCE']),
    DEATH_SEQUENCE: new Set(['SESSION_END']),
    SESSION_END: new Set(),
  };

  public constructor(context: GameSessionContext) {
    this.context = context;
  }

  public getState(): TurnSessionState {
    return this.currentState;
  }

  public transition(event: FsmEvent<TurnSessionState>): void {
    const nextState = event.targetState;
    const allowedStates = this.transitionMap[this.currentState];

    if (!allowedStates.has(nextState)) {
      throw new Error(`[ITSS_TRANSITION_ERROR] Invalid transition attempt: ${this.currentState} -> ${nextState}`);
    }

    this.onTransitionExecute(this.currentState, nextState);
    this.currentState = nextState;
  }

  /**
   * Advances all active timers by a positive number of seconds.
   */
  public updateTick(deltaTime: number): void {
    if (!Number.isFinite(deltaTime) || deltaTime < 0) {
      throw new RangeError('[ITSS_TICK_ERROR] deltaTime must be a finite, non-negative number.');
    }

    if (this.currentState !== 'SESSION_START' && this.currentState !== 'SESSION_END') {
      this.context.sessionTimer = Math.max(0, this.context.sessionTimer - deltaTime);

      if (this.context.sessionTimer === 0 && this.currentState !== 'DEATH_SEQUENCE') {
        this.transition({ type: 'TIMEOUT_GLOBAL', targetState: 'DEATH_SEQUENCE' });
        return;
      }
    }

    if (this.currentState === 'TYPING_CORRECTION') {
      this.context.debugTimer = Math.max(0, this.context.debugTimer - deltaTime);

      if (this.context.debugTimer === 0) {
        this.transition({ type: 'TIMEOUT_DEBUG', targetState: 'UI_HIJACKED' });
        return;
      }
    }

    if (this.currentState === 'UI_HIJACKED') {
      this.context.panicTimer = Math.max(0, this.context.panicTimer - deltaTime);

      if (this.context.panicTimer === 0) {
        this.transition({ type: 'TIMEOUT_PANIC', targetState: 'DEATH_SEQUENCE' });
      }
    }
  }

  private onTransitionExecute(from: TurnSessionState, to: TurnSessionState): void {
    if (to === 'NPC_STREAMING') {
      this.context.dragLock = true;
    } else if (from === 'NPC_STREAMING') {
      this.context.dragLock = false;
    }

    if (to === 'TYPING_CORRECTION') {
      this.context.debugTimer = DEBUG_TIMEOUT_SECONDS;
    }

    if (to === 'UI_HIJACKED') {
      this.context.panicTimer = PANIC_TIMEOUT_SECONDS;
    }
  }
}
