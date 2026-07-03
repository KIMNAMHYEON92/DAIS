export type AndroidPersonaState = 'STABLE' | 'UNEASY' | 'UNSTABLE' | 'CRITICAL' | 'RAMPAGE';

export interface CharacterProfile {
  readonly id: string;
  readonly name: string;
  readonly systemPrompt: string;
  readonly personaState: AndroidPersonaState;
  readonly syncRate: number;
}

export interface CoreIdentity {
  modelSeries: string;
  apparentAge: string;
  roleInFacility: string;
  basicPersonality: string;
  speechStyle: string;
}

export interface KnowledgeBase {
  publicFacts: string[];
  hiddenSecrets: string[];
}

export interface HallucinationRule {
  triggerCondition: string;
  erroneousStatement: string;
  correctFact: string;
  clueHint: string;
}

export interface CharacterPack {
  characterId: string;
  displayName: string;
  coreIdentity: CoreIdentity;
  knowledgeBase: KnowledgeBase;
  hallucinationRules: HallucinationRule[];
  behaviorGuardrails: string[];
}
