export interface ErrorPopup {
  id: string;
  title: string;
  errorCode: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
}

export interface GlitchParameters {
  scanlineEnabled: boolean;
  glitchIntensity: number;
  playStaticSfx: boolean;
}

export interface MouseShakeVector {
  offsetX: number;
  offsetY: number;
}
