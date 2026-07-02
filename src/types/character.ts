export type AndroidPersonaState = 'STABLE' | 'UNEASY' | 'UNSTABLE' | 'CRITICAL' | 'RAMPAGE';

export interface CharacterProfile {
  readonly id: string;
  readonly name: string;
  readonly systemPrompt: string;
  readonly personaState: AndroidPersonaState;
  readonly syncRate: number;
}
