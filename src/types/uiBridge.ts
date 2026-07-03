import type { ErrorPopup } from './hijack';

/**
 * Platform-neutral rendering contract used by the gameplay domain.
 *
 * Browser, Electron, and test renderers can implement this interface without
 * leaking DOM or framework dependencies into GameManager.
 */
export interface UiBridge {
  renderDialogueText(agentId: string, text: string, isComplete: boolean): void;
  clearDialogueArea(): void;

  updateOverclockGauge(value: number): void;
  setApsMetadata(glitchIntensity: number, audioSpeed: number, behaviorSpec: string): void;

  spawnPopup(popup: ErrorPopup): void;
  destroyPopup(id: string): void;
  clearAllPopups(): void;
  applyMouseShake(offsetX: number, offsetY: number): void;
  playStaticSfx(volume: number): void;

  showDebugConsole(erroneousText: string, hint: string): void;
  hideDebugConsole(): void;
  showVerdictScreen(): void;
  showSummaryScreen(success: boolean, creditsAwarded: number, syncRate: number): void;
  transitionScene(sceneName: string): void;
}
