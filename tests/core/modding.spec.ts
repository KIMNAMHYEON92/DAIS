import { beforeEach, describe, expect, it } from 'vitest';

import { ModPackageValidator } from '@core/modding/modValidator';
import { ConsensusEngine } from '@core/sync/consensusEngine';
import type { MemoryAnchorConfig, ModManifest, VoteRecord } from '@app-types/modding';

const LOW_CONTRIBUTOR_SCORE = 30;
const REJECT_ADJUSTMENT = -50;
const HIGH_CONTRIBUTOR_SCORE = 995;
const ACCEPT_ADJUSTMENT = 10;
const MAXIMUM_CONTRIBUTOR_SCORE = 1000;

describe('[Milestone 8] Consensus Audit & Modding Packager Unit Tests', () => {
  let engine: ConsensusEngine;
  let validator: ModPackageValidator;

  beforeEach(() => {
    engine = new ConsensusEngine();
    validator = new ModPackageValidator();
  });

  describe('5-Person Consensus Voting Mathematics Tests', () => {
    it('returns PENDING when fewer than five votes have accumulated', () => {
      const votes: VoteRecord[] = [
        { voterId: 'U_1', voteValue: 1 },
        { voterId: 'U_2', voteValue: 1 },
        { voterId: 'U_3', voteValue: 0 },
      ];

      expect(engine.evaluateConsensus(votes)).toEqual({
        status: 'PENDING',
        scoreSum: 0,
        contributorScoreAdjustment: 0,
        creditsRewardAwarded: false,
      });
    });

    it('accepts a telemetry block as a gold dataset with four pass votes', () => {
      const votes: VoteRecord[] = [
        { voterId: 'U_1', voteValue: 1 },
        { voterId: 'U_2', voteValue: 1 },
        { voterId: 'U_3', voteValue: 1 },
        { voterId: 'U_4', voteValue: 1 },
        { voterId: 'U_5', voteValue: 0 },
      ];

      expect(engine.evaluateConsensus(votes)).toMatchObject({
        status: 'ACCEPT',
        scoreSum: 4,
        contributorScoreAdjustment: 10,
        creditsRewardAwarded: true,
      });
    });

    it('rejects a telemetry block as abuse with one pass vote', () => {
      const votes: VoteRecord[] = [
        { voterId: 'U_1', voteValue: 0 },
        { voterId: 'U_2', voteValue: 0 },
        { voterId: 'U_3', voteValue: 0 },
        { voterId: 'U_4', voteValue: 1 },
        { voterId: 'U_5', voteValue: 0 },
      ];

      expect(engine.evaluateConsensus(votes)).toMatchObject({
        status: 'REJECT',
        scoreSum: 1,
        contributorScoreAdjustment: -50,
        creditsRewardAwarded: false,
      });
    });

    it('keeps an inconclusive two-to-three split pending', () => {
      const votes: VoteRecord[] = [
        { voterId: 'U_1', voteValue: 1 },
        { voterId: 'U_2', voteValue: 1 },
        { voterId: 'U_3', voteValue: 0 },
        { voterId: 'U_4', voteValue: 0 },
        { voterId: 'U_5', voteValue: 0 },
      ];

      expect(engine.evaluateConsensus(votes)).toMatchObject({
        status: 'PENDING',
        scoreSum: 2,
        contributorScoreAdjustment: 0,
        creditsRewardAwarded: false,
      });
    });

    it('clamps contributor scores to the inclusive zero-to-one-thousand range', () => {
      expect(
        engine.calculateNewContributorScore(LOW_CONTRIBUTOR_SCORE, REJECT_ADJUSTMENT),
      ).toBe(0);
      expect(
        engine.calculateNewContributorScore(HIGH_CONTRIBUTOR_SCORE, ACCEPT_ADJUSTMENT),
      ).toBe(MAXIMUM_CONTRIBUTOR_SCORE);
    });
  });

  describe('Dynamic Mod Package Specification Validator Tests', () => {
    const validManifest: ModManifest = {
      mod_manifest_version: '1.0.0',
      character_id: 'AND_ARIA_09',
      display_name: '아리아-09',
      author: 'Modder_X',
      version: '1.0.0',
      description: '가동 점검용 감독관 모드팩입니다.',
      canvas_render_settings: {
        default_scale: 0.85,
        position_offset_x: 0,
        position_offset_y: -120,
        idle_animation_name: 'Idle',
        eye_blink_enabled: true,
      },
      asset_mappings: {
        live2d_model_config: 'assets/live2d/character.model3.json',
        custom_bgm_track: 'assets/sfx/bgm.mp3',
        voice_files: {},
      },
    };

    it('passes a correctly structured character_info.json manifest', () => {
      expect(validator.validateManifest(validManifest)).toEqual({
        isValid: true,
        errorReason: '',
      });
    });

    it('rejects a manifest whose character ID lacks the AND_ prefix', () => {
      const check = validator.validateManifest({
        mod_manifest_version: '1.0.0',
        character_id: 'ARIA_09_BAD',
        display_name: '아리아',
      });

      expect(check.isValid).toBe(false);
      expect(check.errorReason).toContain(
        'Character ID must be specified and start with prefix "AND_"',
      );
    });

    it('rejects a Live2D model path outside the assets directory', () => {
      const check = validator.validateManifest({
        ...validManifest,
        asset_mappings: {
          ...validManifest.asset_mappings,
          live2d_model_config: 'live2d/character.model3.json',
        },
      });

      expect(check.isValid).toBe(false);
      expect(check.errorReason).toContain('assets/');
    });

    it('rejects memory_anchor.json when required_sync_rate exceeds 100', () => {
      const invalidAnchors: MemoryAnchorConfig = {
        character_id: 'AND_ARIA_09',
        unlock_milestones: [
          {
            required_sync_rate: 150,
            anchor_id: 'ANC_ARIA_LV1',
            title: '해제된 보관 규칙',
            unlock_behavior_modification: '말투 누그러짐',
            unlocked_dialogue_triggers: [],
            reward_assets: {
              unlocked_live2d_motion: 'Smile',
              unlocked_voice_key: 'talk.wav',
            },
          },
        ],
      };

      const check = validator.validateMemoryAnchor(invalidAnchors);
      expect(check.isValid).toBe(false);
      expect(check.errorReason).toContain(
        'Unlock milestone sync rate must exist between 0 and 100',
      );
    });
  });
});
