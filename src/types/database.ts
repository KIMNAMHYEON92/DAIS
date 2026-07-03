export const DATABASE_STORES = {
  userProfile: 'tbl_user_profile',
  characterProgress: 'tbl_character_progress',
  offlineTelemetryQueue: 'tbl_offline_telemetry_queue',
} as const;

export type DatabaseStoreName = (typeof DATABASE_STORES)[keyof typeof DATABASE_STORES];

export interface UserProfileEntity {
  user_id: string;
  credits: number;
  contributor_score: number;
  agreement_consented: boolean;
  last_sync_timestamp: string;
}

export interface CharacterProgressEntity {
  character_id: string;
  sync_rate: number;
  unlocked_anchors: string[];
  is_damaged: boolean;
  cooldown_until: string;
  interrogation_count: number;
}

export interface DpoRecordPayload {
  data_id: string;
  meta_info: {
    character_id: string;
    client_version: string;
    timestamp: string;
    turn_index: number;
  };
  system_prompt: string;
  history_context: { role: 'user' | 'assistant'; content: string }[];
  prompt: string;
  rejected: string;
  chosen: string;
}

export interface OfflineTelemetryEntity {
  queue_id?: number;
  data_id: string;
  payload: DpoRecordPayload;
  created_at: string;
}
