import type { MouseShakeVector } from '@app-types/hijack';

const BACKSPACE_RATE = 0.05;
const OFFSET_PRECISION = 2;
const TAU = Math.PI + Math.PI;

export class InputDisrupter {
  public calculateMouseShake(
    elapsedSeconds: number,
    amplitude: number,
    frequency: number,
    randomSeedX: number,
    randomSeedY: number,
  ): MouseShakeVector {
    const omega = frequency * TAU;
    const offsetX = amplitude * Math.sin(omega * elapsedSeconds) * randomSeedX;
    const offsetY = amplitude * Math.cos(omega * elapsedSeconds) * randomSeedY;

    return {
      offsetX: Number(offsetX.toFixed(OFFSET_PRECISION)),
      offsetY: Number(offsetY.toFixed(OFFSET_PRECISION)),
    };
  }

  public processTypingDisruption(currentInputString: string, randomValue: number): string {
    if (currentInputString.length === 0) {
      return currentInputString;
    }

    if (randomValue < BACKSPACE_RATE) {
      return currentInputString.slice(0, -1);
    }

    return currentInputString;
  }
}
