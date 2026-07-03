import type { GlitchParameters } from '@app-types/hijack';

const STATIC_SFX_TRIGGER_RATE = 0.15;
const SCANLINE_THRESHOLD = 60;
const POPUP_THRESHOLD = 80;
const HARD_HIJACK_THRESHOLD = 90;
const SCANLINE_INTENSITY = 0.2;
const POPUP_INTENSITY = 0.6;
const HARD_HIJACK_INTENSITY = 0.95;

export class GlitchOrchestrator {
  public evaluateGlitch(overclockGauge: number, sfxProbabilitySeed: number): GlitchParameters {
    let scanlineEnabled = false;
    let glitchIntensity = 0;
    let playStaticSfx = false;

    if (overclockGauge >= SCANLINE_THRESHOLD) {
      scanlineEnabled = true;
      glitchIntensity = SCANLINE_INTENSITY;
    }

    if (overclockGauge >= POPUP_THRESHOLD) {
      glitchIntensity = POPUP_INTENSITY;
      playStaticSfx = sfxProbabilitySeed < STATIC_SFX_TRIGGER_RATE;
    }

    if (overclockGauge >= HARD_HIJACK_THRESHOLD) {
      glitchIntensity = HARD_HIJACK_INTENSITY;
    }

    return {
      scanlineEnabled,
      glitchIntensity,
      playStaticSfx,
    };
  }
}
