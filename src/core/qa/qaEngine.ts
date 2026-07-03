import { TokenEstimator } from '@core/memory/tokenEstimator';
import type {
  AutomatedQaReport,
  GameplayBalanceMetrics,
  PerformanceMetrics,
  QaAcceptanceStatus,
  QaThresholds,
} from '@app-types/qa';

const CONTEXT_SAFETY_BOUNDARY_TOKENS = 1086;
const LONG_SESSION_TURN_COUNT = 30;

export const QA_THRESHOLDS: Readonly<QaThresholds> = {
  coldBootTimeMs: 30_000,
  cachedBootTimeMs: 3_000,
  firstTokenLatencyMs: 1_200,
  inferenceThroughput: 25,
  unmanagedDeathTimeMinSeconds: 55,
  unmanagedDeathTimeMaxSeconds: 65,
  feedbackClearTimeMs: 100,
};

export class AutomatedQaEngine {
  public async benchmarkColdBoot(bootProcess: () => Promise<void>): Promise<number> {
    const start = performance.now();
    await bootProcess();
    return this.round(performance.now() - start);
  }

  public benchmarkStreamingPerformance(
    firstTokenLatencyMs: number,
    textResponse: string,
    streamingDurationSeconds: number,
  ): { firstTokenLatencyMs: number; throughput: number } {
    const estimatedTokens = TokenEstimator.estimate(textResponse);
    const throughput =
      streamingDurationSeconds > 0 ? estimatedTokens / streamingDurationSeconds : 0;

    return {
      firstTokenLatencyMs: this.round(firstTokenLatencyMs),
      throughput: this.round(throughput),
    };
  }

  public evaluateMemoryStability(totalTurnCount: number, currentContextSize: number): boolean {
    return (
      totalTurnCount >= LONG_SESSION_TURN_COUNT &&
      currentContextSize > CONTEXT_SAFETY_BOUNDARY_TOKENS
    );
  }

  public createReport(
    performance: PerformanceMetrics,
    balance: GameplayBalanceMetrics,
    acceptanceResults: Record<string, QaAcceptanceStatus>,
    timestamp = new Date().toISOString(),
  ): AutomatedQaReport {
    const metricResults = [
      performance.coldBootTimeMs <= QA_THRESHOLDS.coldBootTimeMs,
      performance.cachedBootTimeMs <= QA_THRESHOLDS.cachedBootTimeMs,
      performance.firstTokenLatencyMs <= QA_THRESHOLDS.firstTokenLatencyMs,
      performance.inferenceThroughput >= QA_THRESHOLDS.inferenceThroughput,
      !performance.memoryLeakDetected,
      balance.unmanagedDeathTime >= QA_THRESHOLDS.unmanagedDeathTimeMinSeconds,
      balance.unmanagedDeathTime <= QA_THRESHOLDS.unmanagedDeathTimeMaxSeconds,
      balance.feedbackClearTimeMs <= QA_THRESHOLDS.feedbackClearTimeMs,
    ];
    const acceptancePassed = Object.values(acceptanceResults).every(
      (result) => result === 'PASSED',
    );

    return {
      timestamp,
      isAllPassed: metricResults.every(Boolean) && acceptancePassed,
      performance: { ...performance },
      balance: { ...balance },
      acceptanceResults: { ...acceptanceResults },
    };
  }

  private round(value: number): number {
    return Number(value.toFixed(2));
  }
}
