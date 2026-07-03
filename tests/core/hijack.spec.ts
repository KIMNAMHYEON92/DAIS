import { beforeEach, describe, expect, it } from 'vitest';

import { GlitchOrchestrator } from '@core/hijack/glitchOrchestrator';
import { InputDisrupter } from '@core/hijack/inputDisrupter';
import { PopupOrchestrator } from '@core/hijack/popupOrchestrator';

/* eslint-disable no-magic-numbers -- Milestone thresholds and deterministic seeds are clearer inline. */

describe('[Milestone 6] UI Hijacking & Disruption Unit Tests', () => {
  let disrupter: InputDisrupter;
  let popups: PopupOrchestrator;
  let glitches: GlitchOrchestrator;

  beforeEach(() => {
    disrupter = new InputDisrupter();
    popups = new PopupOrchestrator();
    glitches = new GlitchOrchestrator();
  });

  describe('mouse shaking vectors', () => {
    it('generates coordinate offsets using harmonic sine and cosine functions', () => {
      const result = disrupter.calculateMouseShake(0.1, 15, 25, 1, 0.5);

      expect(result.offsetX).toBeCloseTo(0, 1);
      expect(result.offsetY).toBeCloseTo(-7.5, 1);
    });
  });

  describe('typing auto-loss', () => {
    it('deletes the last character only below the five-percent probability boundary', () => {
      const normalInput = '3월 29일 전술코어 탈취';

      expect(disrupter.processTypingDisruption(normalInput, 0.04)).toBe('3월 29일 전술코어 탈');
      expect(disrupter.processTypingDisruption(normalInput, 0.05)).toBe(normalInput);
      expect(disrupter.processTypingDisruption(normalInput, 0.06)).toBe(normalInput);
    });

    it('leaves an empty input unchanged', () => {
      expect(disrupter.processTypingDisruption('', 0)).toBe('');
    });
  });

  describe('error popup orchestration', () => {
    it('does not spawn below the 80-percent overclock threshold', () => {
      expect(popups.updateTick(5, 75)).toBeNull();
      expect(popups.getPopups()).toHaveLength(0);
    });

    it('spawns immediately at the configured randomized position on entering 80 percent', () => {
      const spawned = popups.updateTick(0, 80, 1920, 1080, 0.5);

      expect(spawned).not.toBeNull();
      expect(popups.getPopups()).toHaveLength(1);
      expect(spawned).toMatchObject({
        id: 'POPUP_ERR_1',
        title: 'WARNING: Memory Leak Detected',
        positionX: Math.floor(0.5 * (1920 - 300 - 100)) + 50,
        positionY: Math.floor(0.5 * (1080 - 150 - 100)) + 50,
      });
    });

    it('waits four seconds before spawning each additional popup', () => {
      popups.updateTick(0, 80);

      expect(popups.updateTick(3.99, 80)).toBeNull();
      expect(popups.updateTick(0.01, 80)?.id).toBe('POPUP_ERR_2');
      expect(popups.getPopups()).toHaveLength(2);
    });

    it('removes one popup or clears all active popups', () => {
      popups.updateTick(0, 85);
      expect(popups.destroyPopup('POPUP_ERR_1')).toBe(true);
      expect(popups.getPopups()).toHaveLength(0);

      popups.updateTick(0, 85);
      popups.clearAll();
      expect(popups.getPopups()).toHaveLength(0);
    });
  });

  describe('glitch and static-noise triggers', () => {
    it('keeps visual and audio effects disabled below 60 percent', () => {
      expect(glitches.evaluateGlitch(59.99, 0)).toEqual({
        scanlineEnabled: false,
        glitchIntensity: 0,
        playStaticSfx: false,
      });
    });

    it('increases intensity at each threshold and gates static noise to 15 percent', () => {
      expect(glitches.evaluateGlitch(65, 0.5)).toEqual({
        scanlineEnabled: true,
        glitchIntensity: 0.2,
        playStaticSfx: false,
      });
      expect(glitches.evaluateGlitch(85, 0.1)).toEqual({
        scanlineEnabled: true,
        glitchIntensity: 0.6,
        playStaticSfx: true,
      });
      expect(glitches.evaluateGlitch(90, 0.15)).toEqual({
        scanlineEnabled: true,
        glitchIntensity: 0.95,
        playStaticSfx: false,
      });
    });
  });
});
