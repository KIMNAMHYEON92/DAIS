import type { MemoryAnchorConfig, ModManifest } from '@app-types/modding';

const MINIMUM_RENDER_SCALE = 0;
const MAXIMUM_RENDER_SCALE = 3;
const MINIMUM_SYNC_RATE = 0;
const MAXIMUM_SYNC_RATE = 100;

export interface ModValidationResult {
  isValid: boolean;
  errorReason: string;
}

export class ModPackageValidator {
  public validateManifest(manifest: Partial<ModManifest>): ModValidationResult {
    if (!manifest.mod_manifest_version || manifest.mod_manifest_version !== '1.0.0') {
      return {
        isValid: false,
        errorReason: 'Invalid manifest version. Must be exactly "1.0.0".',
      };
    }

    if (!manifest.character_id || !manifest.character_id.startsWith('AND_')) {
      return {
        isValid: false,
        errorReason: 'Character ID must be specified and start with prefix "AND_".',
      };
    }

    if (!manifest.display_name || manifest.display_name.trim().length === 0) {
      return { isValid: false, errorReason: 'Display name field cannot be left blank.' };
    }

    if (!manifest.canvas_render_settings) {
      return {
        isValid: false,
        errorReason: 'canvas_render_settings metadata is completely omitted.',
      };
    }

    const scale = manifest.canvas_render_settings.default_scale;
    if (
      scale === undefined ||
      scale <= MINIMUM_RENDER_SCALE ||
      scale > MAXIMUM_RENDER_SCALE
    ) {
      return {
        isValid: false,
        errorReason: 'Canvas rendering scale value is out of logical bounds (0.0 ~ 3.0).',
      };
    }

    if (!manifest.asset_mappings) {
      return {
        isValid: false,
        errorReason: 'Asset mappings configuration block is completely omitted.',
      };
    }

    if (
      !manifest.asset_mappings.live2d_model_config ||
      !manifest.asset_mappings.live2d_model_config.startsWith('assets/')
    ) {
      return {
        isValid: false,
        errorReason: 'Live2D model config path must strictly exist within target "assets/" folder.',
      };
    }

    return { isValid: true, errorReason: '' };
  }

  public validateMemoryAnchor(config: Partial<MemoryAnchorConfig>): ModValidationResult {
    if (!config.character_id) {
      return {
        isValid: false,
        errorReason: 'Target character_id mapping is omitted in memory_anchor.json.',
      };
    }

    if (!config.unlock_milestones || !Array.isArray(config.unlock_milestones)) {
      return {
        isValid: false,
        errorReason: 'Unlock milestones block must be a structured Array.',
      };
    }

    for (const milestone of config.unlock_milestones) {
      const rate = milestone.required_sync_rate;
      if (
        rate === undefined ||
        rate < MINIMUM_SYNC_RATE ||
        rate > MAXIMUM_SYNC_RATE
      ) {
        return {
          isValid: false,
          errorReason: 'Unlock milestone sync rate must exist between 0 and 100.',
        };
      }

      if (!milestone.anchor_id || !milestone.anchor_id.startsWith('ANC_')) {
        return {
          isValid: false,
          errorReason: 'Anchor ID must strictly start with prefix "ANC_".',
        };
      }

      if (
        !milestone.unlock_behavior_modification ||
        milestone.unlock_behavior_modification.trim().length === 0
      ) {
        return {
          isValid: false,
          errorReason: 'Unlock behavior modification directive cannot be left blank.',
        };
      }
    }

    return { isValid: true, errorReason: '' };
  }
}
