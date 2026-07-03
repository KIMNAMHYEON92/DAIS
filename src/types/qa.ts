export type QaAcceptanceStatus = 'PASSED' | 'FAILED';

export interface PerformanceMetrics {
  coldBootTimeMs: number;
  cachedBootTimeMs: number;
  firstTokenLatencyMs: number;
  inferenceThroughput: number;
  memoryLeakDetected: boolean;
}

export interface GameplayBalanceMetrics {
  unmanagedDeathTime: number;
  feedbackClearTimeMs: number;
}

export interface AutomatedQaReport {
  timestamp: string;
  isAllPassed: boolean;
  performance: PerformanceMetrics;
  balance: GameplayBalanceMetrics;
  acceptanceResults: Record<string, QaAcceptanceStatus>;
}

export interface QaThresholds {
  coldBootTimeMs: number;
  cachedBootTimeMs: number;
  firstTokenLatencyMs: number;
  inferenceThroughput: number;
  unmanagedDeathTimeMinSeconds: number;
  unmanagedDeathTimeMaxSeconds: number;
  feedbackClearTimeMs: number;
}
