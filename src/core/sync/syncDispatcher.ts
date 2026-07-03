import { PiiAnonymizer } from '@core/sync/piiAnonymizer';
import { DatabaseManager } from '@infrastructure/indexeddb/databaseManager';
import {
  DATABASE_STORES,
  type DpoRecordPayload,
  type OfflineTelemetryEntity,
} from '@app-types/database';

const SYNC_CHUNK_SIZE = 5;

export interface RemoteServerSyncInterface {
  bulkInsert(payloads: DpoRecordPayload[]): Promise<boolean>;
}

export class TelemetrySyncDispatcher {
  private isOnline: boolean;
  private syncInFlight: Promise<number> | null = null;
  private readonly networkTarget: EventTarget | null;
  private readonly handleOffline = (): void => this.setNetworkState(false);
  private readonly handleOnline = (): void => {
    this.setNetworkState(true);
    void this.syncPendingQueue().catch(() => undefined);
  };

  public constructor(
    private readonly dbManager: DatabaseManager,
    private readonly remoteServer: RemoteServerSyncInterface,
    initialNetworkState = true,
    networkTarget: EventTarget | null = typeof window === 'undefined' ? null : window,
  ) {
    this.isOnline = initialNetworkState;
    this.networkTarget = networkTarget;
    this.networkTarget?.addEventListener('offline', this.handleOffline);
    this.networkTarget?.addEventListener('online', this.handleOnline);
  }

  public setNetworkState(state: boolean): void {
    this.isOnline = state;
  }

  public dispose(): void {
    this.networkTarget?.removeEventListener('offline', this.handleOffline);
    this.networkTarget?.removeEventListener('online', this.handleOnline);
  }

  public async queueTelemetry(payload: DpoRecordPayload): Promise<void> {
    const sanitizedPayload = this.sanitizePayload(payload);

    if (this.isOnline) {
      try {
        if (await this.remoteServer.bulkInsert([sanitizedPayload])) {
          return;
        }
      } catch {
        // 전송 실패 시 동일 레코드를 로컬 큐에 보존한다.
      }
    }

    const offlineRecord: OfflineTelemetryEntity = {
      data_id: sanitizedPayload.data_id,
      payload: sanitizedPayload,
      created_at: new Date().toISOString(),
    };
    await this.dbManager.put(DATABASE_STORES.offlineTelemetryQueue, offlineRecord);
  }

  public syncPendingQueue(): Promise<number> {
    if (!this.isOnline) {
      return Promise.resolve(0);
    }
    if (!this.syncInFlight) {
      this.syncInFlight = this.drainPendingQueue().finally(() => {
        this.syncInFlight = null;
      });
    }
    return this.syncInFlight;
  }

  private async drainPendingQueue(): Promise<number> {
    let uploadedCount = 0;

    while (this.isOnline) {
      const pending = await this.dbManager.getAll<OfflineTelemetryEntity>(
        DATABASE_STORES.offlineTelemetryQueue,
      );
      const chunk = pending.slice(0, SYNC_CHUNK_SIZE);
      if (chunk.length === 0) {
        break;
      }

      try {
        const uploaded = await this.remoteServer.bulkInsert(chunk.map((record) => record.payload));
        if (!uploaded) {
          break;
        }
      } catch {
        break;
      }

      for (const record of chunk) {
        if (record.queue_id !== undefined) {
          await this.dbManager.delete(DATABASE_STORES.offlineTelemetryQueue, record.queue_id);
        }
      }
      uploadedCount += chunk.length;
    }

    return uploadedCount;
  }

  private sanitizePayload(payload: DpoRecordPayload): DpoRecordPayload {
    return {
      ...payload,
      history_context: payload.history_context.map((entry) => ({ ...entry })),
      chosen: PiiAnonymizer.sanitize(payload.chosen),
    };
  }
}
