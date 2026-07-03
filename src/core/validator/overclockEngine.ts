import type { AndroidPersonaState } from '@app-types/fsm';
import type { OverclockConfig } from '@app-types/validator';

const MINIMUM_GAUGE = 0;
const MAXIMUM_GAUGE = 100;
const GAUGE_PRECISION = 4;

const DEFAULT_CONFIG: Readonly<OverclockConfig> = {
  basePassiveRate: 1.5,
  streamingAccelerationRate: 1,
};

const STATE_MULTIPLIERS: Readonly<Record<AndroidPersonaState, number>> = {
  STABLE: 1,
  SUSPICIOUS: 1.2,
  UNSTABLE: 1.5,
  OVERCLOCKED: 2,
  DEACTIVATED: 0,
  CALIBRATED: 0,
};

const EVENT_DELTAS = {
  INVALID_QUERY: 5,
  DRAG_MISS: 8,
  DEBUG_FAIL: 15,
  DEBUG_SUCCESS: -30,
} as const;

export type OverclockEvent = keyof typeof EVENT_DELTAS;

export class OverclockEngine {
  private currentGauge: number;
  private readonly config: Readonly<OverclockConfig>;

  public constructor(initialValue = 0, config: Readonly<OverclockConfig> = DEFAULT_CONFIG) {
    this.assertFinite(initialValue, 'initialValue');
    this.assertNonNegative(config.basePassiveRate, 'basePassiveRate');
    this.assertNonNegative(config.streamingAccelerationRate, 'streamingAccelerationRate');

    this.currentGauge = this.clamp(initialValue);
    this.config = { ...config };
  }

  public getGauge(): number {
    return Number(this.currentGauge.toFixed(GAUGE_PRECISION));
  }

  public setGauge(value: number): void {
    this.assertFinite(value, 'value');
    this.currentGauge = this.clamp(value);
  }

  public tick(deltaTime: number, activeAps: AndroidPersonaState, isStreaming: boolean): number {
    this.assertNonNegative(deltaTime, 'deltaTime');

    const passiveIncrement = this.config.basePassiveRate * STATE_MULTIPLIERS[activeAps] * deltaTime;
    const streamingIncrement = isStreaming ? this.config.streamingAccelerationRate * deltaTime : 0;

    this.currentGauge = this.clamp(this.currentGauge + passiveIncrement + streamingIncrement);
    return this.getGauge();
  }

  public applyEvent(eventType: OverclockEvent): number {
    this.currentGauge = this.clamp(this.currentGauge + EVENT_DELTAS[eventType]);
    return this.getGauge();
  }

  private clamp(value: number): number {
    return Math.max(MINIMUM_GAUGE, Math.min(MAXIMUM_GAUGE, value));
  }

  private assertNonNegative(value: number, fieldName: string): void {
    this.assertFinite(value, fieldName);
    if (value < 0) {
      throw new RangeError(`[OVERCLOCK_VALUE_ERROR] ${fieldName} must be zero or greater.`);
    }
  }

  private assertFinite(value: number, fieldName: string): void {
    if (!Number.isFinite(value)) {
      throw new RangeError(`[OVERCLOCK_VALUE_ERROR] ${fieldName} must be finite.`);
    }
  }
}
