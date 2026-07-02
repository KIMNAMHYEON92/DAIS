import { beforeEach, describe, expect, it } from 'vitest';

import { AndroidPersonaStateMachine } from '@core/fsm/aps';
import { GlobalStateMachine } from '@core/fsm/gms';
import { InterrogationStateMachine } from '@core/fsm/itss';
import type { GameSessionContext } from '@app-types/fsm';

const DEBUG_FIRST_TICK_SECONDS = 10;
const DEBUG_REMAINING_SECONDS = 5;
const DEBUG_EXPIRY_TICK_SECONDS = 5.1;
const PANIC_TIMEOUT_SECONDS = 10;
const SUSPICIOUS_THRESHOLD = 31;
const UNSTABLE_THRESHOLD = 61;
const OVERCLOCKED_THRESHOLD = 81;

describe('[Milestone 1] FSM Core & Boundary Logic Unit Tests', () => {
  let defaultContext: GameSessionContext;

  beforeEach(() => {
    defaultContext = {
      credits: 500,
      contributorScore: 100,
      syncRate: 0,
      overclockGauge: 0,
      sessionTimer: 180,
      debugTimer: 0,
      panicTimer: 0,
      isDamaged: false,
      dragLock: false,
    };
  });

  describe('GMS scene rules', () => {
    it('blocks an invalid scene transition', () => {
      const gms = new GlobalStateMachine(defaultContext);

      expect(() => {
        gms.transition({ type: 'ABNORMAL_TRY', targetState: 'INTERROGATION_ACTIVE' });
      }).toThrowError('[GMS_TRANSITION_ERROR]');
    });

    it('initializes the interrogation context', () => {
      const gms = new GlobalStateMachine({
        ...defaultContext,
        syncRate: 50,
        overclockGauge: 45.5,
      });

      gms.transition({ type: 'GOTO_LOBBY', targetState: 'MAIN_LOBBY' });
      gms.transition({ type: 'GOTO_SELECT', targetState: 'CHAR_SELECT' });
      gms.transition({ type: 'START_PLAY', targetState: 'INTERROGATION_ACTIVE' });

      expect(gms.getContext()).toMatchObject({
        syncRate: 0,
        overclockGauge: 0,
        sessionTimer: 180,
        dragLock: false,
      });
    });

    it('settles successful and overheated interrogation results', () => {
      const successful = new GlobalStateMachine(defaultContext);
      successful.transition({ type: 'GOTO_LOBBY', targetState: 'MAIN_LOBBY' });
      successful.transition({ type: 'GOTO_SELECT', targetState: 'CHAR_SELECT' });
      successful.transition({ type: 'START_PLAY', targetState: 'INTERROGATION_ACTIVE' });
      successful.transition({
        type: 'FINISH',
        targetState: 'RESULT_SUMMARY',
        payload: { success: true },
      });

      expect(successful.getContext()).toMatchObject({ credits: 600, syncRate: 15 });

      const overheated = new GlobalStateMachine(defaultContext);
      overheated.transition({ type: 'GOTO_LOBBY', targetState: 'MAIN_LOBBY' });
      overheated.transition({ type: 'GOTO_SELECT', targetState: 'CHAR_SELECT' });
      overheated.transition({ type: 'START_PLAY', targetState: 'INTERROGATION_ACTIVE' });
      overheated.updateContext((context) => {
        context.overclockGauge = 100;
      });
      overheated.transition({ type: 'OVERHEAT', targetState: 'RESULT_SUMMARY' });

      expect(overheated.getContext()).toMatchObject({ credits: 450, isDamaged: true });
    });
  });

  describe('ITSS boundary rules', () => {
    it('locks dragging only while NPC output is streaming', () => {
      const itss = new InterrogationStateMachine(defaultContext);
      itss.transition({ type: 'START', targetState: 'USER_WAIT' });
      itss.transition({ type: 'USER_ENTER', targetState: 'NPC_THINKING' });
      itss.transition({ type: 'FIRST_TOKEN_RECV', targetState: 'NPC_STREAMING' });

      expect(defaultContext.dragLock).toBe(true);

      itss.transition({ type: 'STREAM_COMPLETE', targetState: 'USER_WAIT' });
      expect(defaultContext.dragLock).toBe(false);
    });

    it('moves from correction to hijack and then death on timer expiry', () => {
      const itss = new InterrogationStateMachine(defaultContext);
      itss.transition({ type: 'START', targetState: 'USER_WAIT' });
      itss.transition({ type: 'DRAG_DETECTION', targetState: 'CONTRADICTION_DRAGGED' });
      itss.transition({ type: 'CORRECT_RANGE', targetState: 'TYPING_CORRECTION' });

      itss.updateTick(DEBUG_FIRST_TICK_SECONDS);
      expect(defaultContext.debugTimer).toBe(DEBUG_REMAINING_SECONDS);
      expect(itss.getState()).toBe('TYPING_CORRECTION');

      itss.updateTick(DEBUG_EXPIRY_TICK_SECONDS);
      expect(itss.getState()).toBe('UI_HIJACKED');
      expect(defaultContext.panicTimer).toBe(PANIC_TIMEOUT_SECONDS);

      itss.updateTick(PANIC_TIMEOUT_SECONDS);
      expect(itss.getState()).toBe('DEATH_SEQUENCE');
    });

    it('rejects a negative frame delta', () => {
      const itss = new InterrogationStateMachine(defaultContext);

      expect(() => itss.updateTick(-1)).toThrowError('[ITSS_TICK_ERROR]');
    });
  });

  describe('APS overclock thresholds', () => {
    it.each([
      [0, 'STABLE'],
      [SUSPICIOUS_THRESHOLD, 'SUSPICIOUS'],
      [UNSTABLE_THRESHOLD, 'UNSTABLE'],
      [OVERCLOCKED_THRESHOLD, 'OVERCLOCKED'],
      [100, 'DEACTIVATED'],
    ] as const)('maps gauge %s to %s', (gauge, expectedState) => {
      const aps = new AndroidPersonaStateMachine();
      defaultContext.overclockGauge = gauge;

      expect(aps.evaluateState(defaultContext)).toBe(expectedState);
    });

    it('supports an explicit calibration verdict', () => {
      const aps = new AndroidPersonaStateMachine();

      expect(aps.evaluateState(defaultContext, 'CALIBRATE')).toBe('CALIBRATED');
      expect(aps.getActiveMetadata().audioSpeed).toBe(1);
    });
  });
});
