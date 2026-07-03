export type ConsensusStatus = 'ACCEPT' | 'REJECT' | 'PENDING';

export interface VoteRecord {
  voterId: string;
  voteValue: 1 | 0;
}

export interface ConsensusDecision {
  status: ConsensusStatus;
  scoreSum: number;
  contributorScoreAdjustment: number;
  creditsRewardAwarded: boolean;
}

export interface CanvasRenderSettings {
  default_scale: number;
  position_offset_x: number;
  position_offset_y: number;
  idle_animation_name: string;
  eye_blink_enabled: boolean;
}

export interface ModManifest {
  mod_manifest_version: string;
  character_id: string;
  display_name: string;
  author: string;
  version: string;
  description: string;
  canvas_render_settings: CanvasRenderSettings;
  asset_mappings: {
    live2d_model_config: string;
    custom_bgm_track: string;
    voice_files: Record<string, string>;
  };
}

export interface MemoryAnchorUnlockMilestone {
  required_sync_rate: number;
  anchor_id: string;
  title: string;
  unlock_behavior_modification: string;
  unlocked_dialogue_triggers: string[];
  reward_assets: {
    unlocked_live2d_motion: string;
    unlocked_voice_key: string;
  };
}

export interface MemoryAnchorConfig {
  character_id: string;
  unlock_milestones: MemoryAnchorUnlockMilestone[];
}
