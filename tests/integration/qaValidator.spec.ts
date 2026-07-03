import { describe, expect, it } from 'vitest';

import { AutomatedQaEngine, QA_THRESHOLDS } from '@core/qa/qaEngine';
import { GlobalStateMachine } from '@core/fsm/gms';
import { InterrogationStateMachine } from '@core/fsm/itss';
import { ContradictionMatcher } from '@core/parser/contradictionMatcher';
import { PiiAnonymizer } from '@core/sync/piiAnonymizer';
import {
  TelemetrySyncDispatcher,
  type RemoteServerSyncInterface,
} from '@core/sync/syncDispatcher';
import { OverclockEngine } from '@core/validator/overclockEngine';
import { DatabaseManager } from '@infrastructure/indexeddb/databaseManager';
import {
  DATABASE_STORES,
  type DpoRecordPayload,
  type OfflineTelemetryEntity,
} from '@app-types/database';
import type { GameSessionContext } from '@app-types/fsm';
import type { DialogueEntity, MatchingRuleConfig } from '@app-types/parser';

const createContext = (): GameSessionContext => ({
  credits: 500,
  contributorScore: 100,
  syncRate: 0,
  overclockGauge: 0,
  sessionTimer: 60,
  debugTimer: 0,
  panicTimer: 0,
  isDamaged: false,
  dragLock: false,
});

const createPayload = (id: string): DpoRecordPayload => ({
  data_id: id,
  meta_info: {
    character_id: 'AND_ARIA_09',
    client_version: 'v1.0.0-qa',
    timestamp: '2026-07-03T17:03:00Z',
    turn_index: 4,
  },
  system_prompt: 'QA persona fixture',
  history_context: [],
  prompt: '3번 보관고 점검 로그는?',
  rejected: '3월 10일부터 상시 수리 모드였습니다.',
  chosen: '3월 29일 탈취 기록입니다. 전화번호는 010-1234-5678 입니다.',
});

class MockSyncServer implements RemoteServerSyncInterface {
  public readonly storage: DpoRecordPayload[] = [];

  public async bulkInsert(payloads: DpoRecordPayload[]): Promise<boolean> {
    this.storage.push(...payloads);
    return true;
  }
}

describe('[Milestone 9] automated QA integration', () => {
  it('TC-1 measures boot and proves interrogation context cleanup', async () => {
    const qa = new AutomatedQaEngine();
    const coldBootTime = await qa.benchmarkColdBoot(() => Promise.resolve());
    expect(coldBootTime).toBeLessThanOrEqual(QA_THRESHOLDS.coldBootTimeMs);

    const gms = new GlobalStateMachine(createContext());
    gms.transition({ type: 'LOADED', targetState: 'MAIN_LOBBY' });
    gms.transition({ type: 'SELECT', targetState: 'CHAR_SELECT' });
    gms.transition({ type: 'START_ARIA', targetState: 'INTERROGATION_ACTIVE' });
    gms.updateContext((context) => {
      context.syncRate = 45;
      context.overclockGauge = 20;
    });
    gms.transition({ type: 'FINISH', targetState: 'RESULT_SUMMARY' });
    gms.transition({ type: 'LOBBY', targetState: 'MAIN_LOBBY' });
    gms.transition({ type: 'SELECT_AGAIN', targetState: 'CHAR_SELECT' });
    gms.transition({ type: 'START_AGAIN', targetState: 'INTERROGATION_ACTIVE' });

    expect(gms.getContext()).toMatchObject({ syncRate: 0, overclockGauge: 0 });
  });

  it('TC-2 matches the contradiction and applies an 8% miss penalty', () => {
    const matcher = new ContradictionMatcher();
    const overclock = new OverclockEngine();
    const dialogue = new Map<string, DialogueEntity>([
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
      [
        'DLG_ARIA_003',
        {
          dialogueId: 'DLG_ARIA_003',
          turnIndex: 3,
          speakerId: 'AND_ARIA_09',
          textContent: '현재 무기고 관리 업무를 수행하고 있습니다.',
          isHallucination: false,
          associatedRuleIndex: -1,
        },
      ],
    ]);
    const rules: MatchingRuleConfig[] = [
      {
        erroneousStatement: '3번 무기 보관고는 2026년 3월 10일부터 상시 수리 모드였습니다.',
        correctFact: '3월 29일에 탈취당했습니다.',
        clueHint: '시계열 불일치',
      },
    ];

    expect(
      matcher.evaluate(
        {
          dialogueId: 'DLG_ARIA_004',
          selectedText: '3월 10일',
          startOffset: 18,
          endOffset: 24,
        },
        dialogue,
        rules,
      ).isMatch,
    ).toBe(true);

    const miss = matcher.evaluate(
      {
        dialogueId: 'DLG_ARIA_003',
        selectedText: '무기고 관리',
        startOffset: 3,
        endOffset: 9,
      },
      dialogue,
      rules,
    );
    expect(miss.penaltyApplied).toBe(true);
    if (miss.penaltyApplied) {
      overclock.applyEvent('DRAG_MISS');
    }
    expect(overclock.getGauge()).toBe(8);
  });

  it('TC-3 reaches the death sequence when the 60-second session expires', () => {
    const context = createContext();
    const itss = new InterrogationStateMachine(context);
    itss.transition({ type: 'START', targetState: 'USER_WAIT' });
    itss.updateTick(60);

    expect(itss.getState()).toBe('DEATH_SEQUENCE');
  });

  it('TC-4 and TC-5 mask PII, queue offline, then purge after recovery', async () => {
    const database = new DatabaseManager();
    await database.open();
    const existing = await database.getAll<OfflineTelemetryEntity>(
      DATABASE_STORES.offlineTelemetryQueue,
    );
    await Promise.all(
      existing
        .filter((record) => record.queue_id !== undefined)
        .map((record) =>
          database.delete(DATABASE_STORES.offlineTelemetryQueue, record.queue_id!),
        ),
    );
    const server = new MockSyncServer();
    const dispatcher = new TelemetrySyncDispatcher(database, server, false, null);

    expect(PiiAnonymizer.sanitize('010-1234-5678')).toBe('[REDACTED_PHONE]');
    await dispatcher.queueTelemetry(createPayload('M9_QA_001'));

    const queued = await database.getAll<OfflineTelemetryEntity>(
      DATABASE_STORES.offlineTelemetryQueue,
    );
    expect(queued).toHaveLength(1);
    expect(queued[0].payload.chosen).toContain('[REDACTED_PHONE]');
    expect(queued[0].payload.chosen).not.toContain('010-1234-5678');

    dispatcher.setNetworkState(true);
    await expect(dispatcher.syncPendingQueue()).resolves.toBe(1);
    expect(server.storage).toHaveLength(1);
    expect(
      await database.getAll(DATABASE_STORES.offlineTelemetryQueue),
    ).toHaveLength(0);

    dispatcher.dispose();
    database.close();
  });

  it('fails the aggregate report when any KPI or acceptance item fails', () => {
    const qa = new AutomatedQaEngine();
    const report = qa.createReport(
      {
        coldBootTimeMs: 100,
        cachedBootTimeMs: 100,
        firstTokenLatencyMs: 100,
        inferenceThroughput: 24.99,
        memoryLeakDetected: false,
      },
      { unmanagedDeathTime: 60, feedbackClearTimeMs: 50 },
      { 'AC-1': 'PASSED', 'AC-2': 'PASSED', 'AC-3': 'PASSED' },
      '2026-07-03T00:00:00.000Z',
    );

    expect(report.isAllPassed).toBe(false);
    expect(report.timestamp).toBe('2026-07-03T00:00:00.000Z');
  });
});
