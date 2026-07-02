export interface DpoDataset {
  readonly context: string;
  readonly prompt: string;
  readonly rejected: string;
  readonly chosen: string;
}

export interface TelemetryEnvelope {
  readonly sessionId: string;
  readonly characterId: string;
  readonly dataset: DpoDataset;
  readonly consentedAt: string;
}
