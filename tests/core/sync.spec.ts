import { PiiAnonymizer } from '@core/sync/piiAnonymizer';
import {
  TelemetrySyncDispatcher,
  type RemoteServerSyncInterface,
} from '@core/sync/syncDispatcher';
import { DatabaseManager } from '@infrastructure/indexeddb/databaseManager';
import {
  DATABASE_STORES,
  type DpoRecordPayload,
  type OfflineTelemetryEntity,
} from '@app-types/database';

const LARGE_QUEUE_SIZE = 12;
// eslint-disable-next-line no-magic-numbers
const EXPECTED_BATCH_SIZES = [5, 5, 2];

class MockRemoteServer implements RemoteServerSyncInterface {
  public uploadResult = true;
  public shouldThrow = false;
  public readonly uploadedBatches: DpoRecordPayload[][] = [];

  public async bulkInsert(payloads: DpoRecordPayload[]): Promise<boolean> {
    if (this.shouldThrow) {
      throw new Error('network failure');
    }
    if (this.uploadResult) {
      this.uploadedBatches.push(payloads);
      return true;
    }
    return false;
  }
}

const createPayload = (dataId = 'DPO_ARIA_TEST_001'): DpoRecordPayload => ({
  data_id: dataId,
  meta_info: {
    character_id: 'AND_ARIA_09',
    client_version: 'v1.0.0-webgpu',
    timestamp: '2026-07-03T17:03:00Z',
    turn_index: 4,
  },
  system_prompt: 'Static Compiled Prompt...',
  history_context: [],
  prompt: '3번 보관고 점검 정보?',
  rejected: '오답 수리 모드 진술...',
  chosen: '장만월 검사관의 번호는 010-1234-5678 입니다.',
});

describe('[Milestone 7] Save, PII and Sync Telemetry', () => {
  let database: DatabaseManager;
  let server: MockRemoteServer;
  let dispatcher: TelemetrySyncDispatcher;

  beforeEach(async () => {
    database = new DatabaseManager();
    await database.open();
    server = new MockRemoteServer();
    dispatcher = new TelemetrySyncDispatcher(database, server);

    const pending = await database.getAll<OfflineTelemetryEntity>(
      DATABASE_STORES.offlineTelemetryQueue,
    );
    await Promise.all(
      pending
        .filter((record) => record.queue_id !== undefined)
        .map((record) => database.delete(DATABASE_STORES.offlineTelemetryQueue, record.queue_id!)),
    );
  });

  afterEach(() => {
    dispatcher.dispose();
    database.close();
  });

  it('masks resident numbers, phone numbers, emails, and Korean names', () => {
    const sanitized = PiiAnonymizer.sanitize(
      '장만월의 주민번호는 970115-1152341, 전화는 010-1234-5678, 메일은 user@test.com 입니다.',
    );

    expect(sanitized).toContain('[USER_NAME]');
    expect(sanitized).toContain('[REDACTED_RRN]');
    expect(sanitized).toContain('[REDACTED_PHONE]');
    expect(sanitized).toContain('[REDACTED_EMAIL]');
    expect(sanitized).not.toContain('장만월');
    expect(sanitized).not.toContain('970115');
  });

  it('keeps whitelisted game nouns intact', () => {
    const sanitized = PiiAnonymizer.sanitize(
      '아리아 감독관, 보관고 침입자는 장만월 검사관입니다.',
    );

    expect(sanitized).toContain('아리아');
    expect(sanitized).toContain('감독관');
    expect(sanitized).toContain('보관고');
    expect(sanitized).toContain('검사관');
    expect(sanitized).not.toContain('장만월');
  });

  it('sanitizes and uploads directly while online', async () => {
    await dispatcher.queueTelemetry(createPayload());

    expect(server.uploadedBatches).toHaveLength(1);
    expect(server.uploadedBatches[0][0].chosen).toContain('[USER_NAME]');
    expect(server.uploadedBatches[0][0].chosen).toContain('[REDACTED_PHONE]');
    expect(
      await database.getAll(DATABASE_STORES.offlineTelemetryQueue),
    ).toHaveLength(0);
  });

  it('stores an already-sanitized payload while offline', async () => {
    dispatcher.setNetworkState(false);
    await dispatcher.queueTelemetry(createPayload());

    const pending = await database.getAll<OfflineTelemetryEntity>(
      DATABASE_STORES.offlineTelemetryQueue,
    );
    expect(pending).toHaveLength(1);
    expect(pending[0].payload.chosen).toContain('[REDACTED_PHONE]');
    expect(pending[0].payload.chosen).not.toContain('010-1234-5678');
  });

  it('falls back to the local queue when a direct upload throws', async () => {
    server.shouldThrow = true;
    await dispatcher.queueTelemetry(createPayload());

    expect(
      await database.getAll(DATABASE_STORES.offlineTelemetryQueue),
    ).toHaveLength(1);
  });

  it('drains every pending record in batches of at most five', async () => {
    dispatcher.setNetworkState(false);
    for (let index = 0; index < LARGE_QUEUE_SIZE; index += 1) {
      await dispatcher.queueTelemetry(createPayload(`ID_${index}`));
    }

    dispatcher.setNetworkState(true);
    await expect(dispatcher.syncPendingQueue()).resolves.toBe(LARGE_QUEUE_SIZE);
    expect(server.uploadedBatches.map((batch) => batch.length)).toEqual(EXPECTED_BATCH_SIZES);
    expect(
      await database.getAll(DATABASE_STORES.offlineTelemetryQueue),
    ).toHaveLength(0);
  });

  it('preserves queued records when synchronization fails', async () => {
    dispatcher.setNetworkState(false);
    await dispatcher.queueTelemetry(createPayload());
    server.uploadResult = false;
    dispatcher.setNetworkState(true);

    await expect(dispatcher.syncPendingQueue()).resolves.toBe(0);
    expect(
      await database.getAll(DATABASE_STORES.offlineTelemetryQueue),
    ).toHaveLength(1);
  });

  it('automatically synchronizes when the browser reports that it is online', async () => {
    dispatcher.setNetworkState(false);
    await dispatcher.queueTelemetry(createPayload());

    window.dispatchEvent(new Event('online'));

    await vi.waitFor(async () => {
      expect(
        await database.getAll(DATABASE_STORES.offlineTelemetryQueue),
      ).toHaveLength(0);
    });
    expect(server.uploadedBatches).toHaveLength(1);
  });
});
