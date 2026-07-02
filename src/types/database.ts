export interface SaveData {
  readonly playerId: string;
  readonly credits: number;
  readonly unlockedCharacterIds: readonly string[];
  readonly updatedAt: string;
}

export interface OfflineQueueRecord<Payload> {
  readonly id?: number;
  readonly payload: Payload;
  readonly createdAt: string;
  readonly retryCount: number;
}
