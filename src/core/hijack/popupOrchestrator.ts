import type { ErrorPopup } from '@app-types/hijack';

const SPAWN_INTERVAL_SECONDS = 4;
const POPUP_WIDTH = 300;
const POPUP_HEIGHT = 150;
const SCREEN_PADDING = 50;
const DEFAULT_SCREEN_WIDTH = 1920;
const DEFAULT_SCREEN_HEIGHT = 1080;
const DEFAULT_RANDOM_SEED = 0.5;
const POPUP_THRESHOLD = 80;

const ERROR_TITLES = [
  'ERROR: Core Overheat 0x99',
  'WARNING: Memory Leak Detected',
  'CRITICAL: Logical Logic Inversion',
  'SYSTEM ALARM: Logic Buffer Exhausted',
] as const;

export class PopupOrchestrator {
  private readonly activePopups = new Map<string, ErrorPopup>();
  private popupCounter = 0;
  private spawnCooldownTimer = 0;

  public getPopups(): ErrorPopup[] {
    return Array.from(this.activePopups.values());
  }

  public clearAll(): void {
    this.activePopups.clear();
  }

  public destroyPopup(id: string): boolean {
    return this.activePopups.delete(id);
  }

  public updateTick(
    deltaTime: number,
    overclockGauge: number,
    screenWidth = DEFAULT_SCREEN_WIDTH,
    screenHeight = DEFAULT_SCREEN_HEIGHT,
    mockRandomSeed = DEFAULT_RANDOM_SEED,
  ): ErrorPopup | null {
    if (overclockGauge < POPUP_THRESHOLD) {
      this.spawnCooldownTimer = 0;
      return null;
    }

    this.spawnCooldownTimer += deltaTime;

    if (this.spawnCooldownTimer < SPAWN_INTERVAL_SECONDS && this.activePopups.size > 0) {
      return null;
    }

    this.spawnCooldownTimer = 0;
    this.popupCounter += 1;

    const id = `POPUP_ERR_${this.popupCounter}`;
    const title = ERROR_TITLES[this.popupCounter % ERROR_TITLES.length];
    const maxRangeX = screenWidth - POPUP_WIDTH - SCREEN_PADDING - SCREEN_PADDING;
    const maxRangeY = screenHeight - POPUP_HEIGHT - SCREEN_PADDING - SCREEN_PADDING;
    const positionX = Math.floor(mockRandomSeed * maxRangeX) + SCREEN_PADDING;
    const positionY = Math.floor(mockRandomSeed * maxRangeY) + SCREEN_PADDING;
    const popup: ErrorPopup = {
      id,
      title,
      errorCode: `0x00FF${this.popupCounter}`,
      positionX,
      positionY,
      width: POPUP_WIDTH,
      height: POPUP_HEIGHT,
    };

    this.activePopups.set(id, popup);
    return popup;
  }
}
