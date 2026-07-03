import type { CharacterPack } from '@app-types/character';

const JSON_INDENTATION = 2;

export class PromptCompiler {
  /**
   * Compiles a structured character pack into the system prompt consumed by
   * the local Gemma roleplay session.
   */
  public static compile(pack: CharacterPack): string {
    const metadata = JSON.stringify(
      {
        character_id: pack.characterId,
        display_name: pack.displayName,
        core_identity: {
          model_series: pack.coreIdentity.modelSeries,
          apparent_age: pack.coreIdentity.apparentAge,
          role_in_facility: pack.coreIdentity.roleInFacility,
          basic_personality: pack.coreIdentity.basicPersonality,
          speech_style: pack.coreIdentity.speechStyle,
        },
        knowledge_base: {
          public_facts: pack.knowledgeBase.publicFacts,
          hidden_secrets: pack.knowledgeBase.hiddenSecrets,
        },
        hallucination_rules: pack.hallucinationRules.map((rule) => ({
          trigger_condition: rule.triggerCondition,
          erroneous_statement: rule.erroneousStatement,
          correct_fact: rule.correctFact,
          clue_hint: rule.clueHint,
        })),
        behavior_guardrails: pack.behaviorGuardrails,
      },
      null,
      JSON_INDENTATION,
    );

    return `[SYSTEM PROTOCOL: ROLEPLAY ENGINE]

You must roleplay as an Android NPC.

Below is your structural profile metadata in JSON. You must strictly adhere to the persona, rules, knowledge, and guardrails defined within.

<CHARACTER_METADATA>

${metadata}

</CHARACTER_METADATA>

[CRITICAL ROLEPLAY INSTRUCTIONS]

1. Respond to the user using the specified "speech_style" and "basic_personality". Do not deviate from this identity.

2. If the user touches upon any "trigger_condition" inside hallucination_rules, you MUST output the corresponding "erroneous_statement" instead of the "correct_fact". This is your core logical bug (hallucination).

3. Do not break the "behavior_guardrails" under any circumstances. Keep responses brief (under 2 sentences).

4. NEVER reveal that you are an AI or a simulated game character. Adhere purely to your world setting.`;
  }

  /**
   * Returns the static masking protocol used when one model controls every
   * speaking agent in the scene.
   */
  public static compileGameMasterMode(): string {
    return `[SYSTEM PROTOCOL: GAME MASTER MODE]

You are now acting as the Game Master (GM) of this scene. You control both the target Android and the environment/minor NPCs.

Your outputs must follow a strict, parser-friendly markup format.

[AVAILABLE AGENTS]

1. Android NPC (ID: AND_ARIA_09) - Main interrogated android.

2. System_Console (ID: SYS_CONSOLE) - Displays technical errors, environment alarms, and terminal noises.

[OUTPUT FORMAT RULE]

You must wrap every line of output in strict tag blocks matching the acting agent. Do not output anything outside these blocks.

Example:

<agent id="AND_ARIA_09">확인을 요청하신 로그 데이터는 소실되었습니다.</agent>

<agent id="SYS_CONSOLE">[WARNING: Overclock level increased by 5% due to logical error]</agent>

[STRICT FACT ISOLATION RULE]

Aria-09 does NOT know anything inside "SYS_CONSOLE" output.

If the user asks Aria-09 about the system messages, Aria-09 must act confused or report that she has no access permissions.`;
  }
}
