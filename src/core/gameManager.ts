import { AndroidPersonaStateMachine } from '@core/fsm/aps';
import { GlobalStateMachine } from '@core/fsm/gms';
import { InterrogationStateMachine } from '@core/fsm/itss';
import { GlitchOrchestrator } from '@core/hijack/glitchOrchestrator';
import { InputDisrupter } from '@core/hijack/inputDisrupter';
import { PopupOrchestrator } from '@core/hijack/popupOrchestrator';
import { MemoryPipelineController } from '@core/memory/memoryPipeline';
import { ContradictionMatcher } from '@core/parser/contradictionMatcher';
import { PromptCompiler } from '@core/prompt/compiler';
import { StreamingMarkupParser } from '@core/prompt/markupParser';
import { PiiAnonymizer } from '@core/sync/piiAnonymizer';
import { TelemetrySyncDispatcher } from '@core/sync/syncDispatcher';
import { DeterministicTypingValidator } from '@core/validator/typingValidator';
import { OverclockEngine } from '@core/validator/overclockEngine';
import { DatabaseManager } from '@infrastructure/indexeddb/databaseManager';
import type { LocalStreamingClient } from '@infrastructure/ollamaClient';
import type { CharacterPack } from '@app-types/character';
import {
  DATABASE_STORES,
  type CharacterProgressEntity,
  type DpoRecordPayload,
  type UserProfileEntity,
} from '@app-types/database';
import type { GameSessionContext } from '@app-types/fsm';
import type { CapturedDragData, DialogueEntity, MatchingRuleConfig } from '@app-types/parser';
import type { UiBridge } from '@app-types/uiBridge';
import type { ValidationRules } from '@app-types/validator';

interface DialoguePair {
  user: string;
  assistant: string;
}

export interface GameSessionSnapshot {
  state: 'INTERROGATION_ACTIVE' | 'VERDICT_PHASE' | 'RESULT_SUMMARY';
  overclockGauge: number;
  syncRate: number;
  credits: number;
  sessionTimeRemaining: number;
  isStreaming: boolean;
  isDamaged: boolean;
}

const DEFAULT_VALIDATION_RULES: Readonly<ValidationRules> = {
  requiredKeywords: ['3월 15일', '3월 29일', '탈취', '공장'],
  minimumKeywordMatchCount: 2,
  forbiddenPatterns: ['^[ㄱ-ㅎㅏ-ㅣ]+$', '바보', '쓰레기'],
};

export class GameManager {
  private gms!: GlobalStateMachine;
  private itss!: InterrogationStateMachine;
  private aps!: AndroidPersonaStateMachine;
  private overclock!: OverclockEngine;
  private memory!: MemoryPipelineController;
  private matcher!: ContradictionMatcher;
  private validator!: DeterministicTypingValidator;
  private popups!: PopupOrchestrator;
  private glitch!: GlitchOrchestrator;
  private disrupter!: InputDisrupter;

  private currentCharacterPack!: CharacterPack;
  private readonly dialogueHistory = new Map<string, DialogueEntity>();
  private readonly conversationHistory: DialoguePair[] = [];
  private localTurnCounter = 0;
  private cumulativeTime = 0;
  private isNpcStreamingActive = false;
  private activeRuleIndex = -1;
  private lastSuccessfulCorrection = '';
  private lastUserQuery = '';
  private savedCharacterProgress: CharacterProgressEntity | null = null;

  public constructor(
    private readonly ui: UiBridge,
    private readonly db: DatabaseManager,
    private readonly ollama: LocalStreamingClient,
    private readonly telemetry: TelemetrySyncDispatcher,
  ) {}

  public getSessionSnapshot(): GameSessionSnapshot {
    const context = this.gms.getContext();
    const state = this.gms.getState();
    if (state !== 'INTERROGATION_ACTIVE' && state !== 'VERDICT_PHASE' && state !== 'RESULT_SUMMARY') {
      throw new Error(`[GAME_MANAGER_ERROR] Session snapshot unavailable in ${state}.`);
    }

    return {
      state,
      overclockGauge: context.overclockGauge,
      syncRate: context.syncRate,
      credits: context.credits,
      sessionTimeRemaining: Math.max(0, 180 - this.cumulativeTime),
      isStreaming: this.isNpcStreamingActive,
      isDamaged: context.isDamaged,
    };
  }

  public async initializeInterrogationSession(pack: CharacterPack): Promise<void> {
    await this.db.open();
    const savedProfile = await this.db.get<UserProfileEntity>(DATABASE_STORES.userProfile, 'USER_UUID_2026');
    this.savedCharacterProgress = await this.db.get<CharacterProgressEntity>(
      DATABASE_STORES.characterProgress,
      pack.characterId,
    );

    this.currentCharacterPack = pack;
    this.dialogueHistory.clear();
    this.conversationHistory.length = 0;
    this.localTurnCounter = 0;
    this.cumulativeTime = 0;
    this.isNpcStreamingActive = false;
    this.activeRuleIndex = -1;
    this.lastSuccessfulCorrection = '';
    this.lastUserQuery = '';

    const initialContext: GameSessionContext = {
      credits: savedProfile?.credits ?? 100,
      contributorScore: savedProfile?.contributor_score ?? 100,
      syncRate: 0,
      overclockGauge: 0,
      sessionTimer: 180,
      debugTimer: 0,
      panicTimer: 0,
      isDamaged: false,
      dragLock: false,
    };

    this.gms = new GlobalStateMachine(initialContext);
    this.itss = new InterrogationStateMachine(initialContext);
    this.aps = new AndroidPersonaStateMachine();
    this.overclock = new OverclockEngine();
    this.memory = new MemoryPipelineController(
      { shortTermBuffer: [], midTermSummaries: [], longTermAnchors: [] },
      {
        requestSummary: async (turns) => `중기 요약 청크 (${turns.length}개 이력)`,
      },
    );
    this.matcher = new ContradictionMatcher();
    this.validator = new DeterministicTypingValidator();
    this.popups = new PopupOrchestrator();
    this.glitch = new GlitchOrchestrator();
    this.disrupter = new InputDisrupter();

    this.ui.clearDialogueArea();
    this.ui.clearAllPopups();
    this.ui.applyMouseShake(0, 0);

    // Follow the legal GMS route so the integration controller preserves the
    // same invariants as the independently tested state machine.
    this.gms.transition({ type: 'BOOT_COMPLETE', targetState: 'MAIN_LOBBY' });
    this.gms.transition({ type: 'OPEN_CHARACTER_SELECT', targetState: 'CHAR_SELECT' });
    this.gms.transition({ type: 'START_PLAY', targetState: 'INTERROGATION_ACTIVE' });
    this.itss.transition({ type: 'SESSION_INITIALIZE', targetState: 'USER_WAIT' });

    this.ui.transitionScene('INTERROGATION_ROOM');
    this.ui.updateOverclockGauge(0);
    this.applyPersonaMetadata();
  }

  public updateHeartbeat(deltaTime: number): void {
    if (this.gms.getState() !== 'INTERROGATION_ACTIVE') {
      return;
    }

    this.cumulativeTime += deltaTime;
    this.itss.updateTick(deltaTime);

    if (this.itss.getState() === 'DEATH_SEQUENCE') {
      this.handleOverclockExplosionFailure();
      return;
    }

    const updatedGauge = this.overclock.tick(deltaTime, this.aps.getState(), this.isNpcStreamingActive);
    this.gms.updateContext((context) => {
      context.overclockGauge = updatedGauge;
    });
    this.ui.updateOverclockGauge(updatedGauge);
    this.aps.evaluateState(this.gms.getContext());
    this.applyPersonaMetadata();

    const glitchParameters = this.glitch.evaluateGlitch(updatedGauge, Math.random());
    if (glitchParameters.playStaticSfx) {
      this.ui.playStaticSfx(0.3);
    }

    const popup = this.popups.updateTick(deltaTime, updatedGauge, 1920, 1080, Math.random());
    if (popup !== null) {
      this.ui.spawnPopup(popup);
    }

    if (updatedGauge >= 90) {
      const shake = this.disrupter.calculateMouseShake(
        this.cumulativeTime,
        15,
        25,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
      );
      this.ui.applyMouseShake(shake.offsetX, shake.offsetY);
    } else {
      this.ui.applyMouseShake(0, 0);
    }

    if (updatedGauge >= 100 && !this.gms.getContext().isDamaged) {
      this.handleOverclockExplosionFailure();
    }
  }

  public async handlePlayerSubmitDialogue(userQuery: string): Promise<void> {
    if (this.itss.getState() !== 'USER_WAIT' || userQuery.trim() === '') {
      return;
    }

    this.lastUserQuery = userQuery.trim();
    this.itss.transition({ type: 'PLAYER_ENTER', targetState: 'NPC_THINKING' });
    this.isNpcStreamingActive = true;

    const parser = new StreamingMarkupParser();
    const finalPrompt = `[MEMORY CONTEXT]\n${this.memory.compileMemoryToPrompt()}\n\n[USER QUESTION]\n${this.lastUserQuery}`;
    this.itss.transition({ type: 'FIRST_TOKEN', targetState: 'NPC_STREAMING' });

    let resolveCompletion!: () => void;
    let rejectCompletion!: (reason: unknown) => void;
    const completion = new Promise<void>((resolve, reject) => {
      resolveCompletion = resolve;
      rejectCompletion = reject;
    });

    await this.ollama.streamChat({
      model: 'gemma-4-e2b',
      prompt: finalPrompt,
      system: `${PromptCompiler.compile(this.currentCharacterPack)}\n\n${PromptCompiler.compileGameMasterMode()}`,
      onToken: (token) => {
        for (const segment of parser.write(token)) {
          this.ui.renderDialogueText(segment.agentId, segment.content, segment.isComplete);
        }
      },
      onComplete: (fullText) => {
        void this.finalizeNpcResponse(parser, this.lastUserQuery, fullText).then(resolveCompletion, rejectCompletion);
      },
      onError: (error) => {
        this.isNpcStreamingActive = false;
        this.ui.renderDialogueText('SYS_CONSOLE', `[INTERNAL COMPILER ERROR: ${error.message}]`, true);
        this.itss.transition({ type: 'RECV_ERROR', targetState: 'USER_WAIT' });
        resolveCompletion();
      },
    });

    await completion;
  }

  public handlePlayerDragContradiction(dragData: CapturedDragData): void {
    if (this.itss.getState() !== 'USER_WAIT' || this.isNpcStreamingActive) {
      return;
    }

    this.itss.transition({ type: 'DRAG_RELEASE', targetState: 'CONTRADICTION_DRAGGED' });
    const rules: MatchingRuleConfig[] = this.currentCharacterPack.hallucinationRules.map((rule) => ({
      erroneousStatement: rule.erroneousStatement,
      correctFact: rule.correctFact,
      clueHint: rule.clueHint,
    }));
    const result = this.matcher.evaluate(dragData, this.dialogueHistory, rules);

    if (result.isMatch && result.targetDialogue !== undefined) {
      this.activeRuleIndex = result.targetDialogue.associatedRuleIndex;
      const activeRule = this.currentCharacterPack.hallucinationRules[this.activeRuleIndex];
      if (activeRule === undefined) {
        throw new Error('[GAME_MANAGER_ERROR] Matched hallucination rule could not be resolved.');
      }
      this.itss.transition({ type: 'VALID_TARGET', targetState: 'TYPING_CORRECTION' });
      this.ui.showDebugConsole(activeRule.erroneousStatement, activeRule.clueHint);
      return;
    }

    if (result.penaltyApplied) {
      this.overclock.applyEvent('DRAG_MISS');
    }
    this.ui.playStaticSfx(0.7);
    this.itss.transition({ type: 'INVALID_DRAG', targetState: 'USER_WAIT' });
  }

  public handlePlayerSubmitCorrection(text: string): void {
    if (this.itss.getState() !== 'TYPING_CORRECTION') {
      return;
    }

    const disruptedText = this.disrupter.processTypingDisruption(text, Math.random());
    const result = this.validator.validate(disruptedText, DEFAULT_VALIDATION_RULES);

    if (!result.isValid) {
      this.overclock.applyEvent('DEBUG_FAIL');
      this.ui.playStaticSfx(0.9);
      return;
    }

    this.lastSuccessfulCorrection = disruptedText;
    this.overclock.applyEvent('DEBUG_SUCCESS');
    this.memory.registerLongTermAnchor({
      anchorId: `ANC_ARIA_LV_${this.localTurnCounter}`,
      gameTurn: this.localTurnCounter,
      summary: '검사관이 무기 탈취일 모순을 밝혀 아리아의 손상된 기억을 교정했다.',
      priority: 5,
    });
    this.gms.updateContext((context) => {
      context.syncRate = Math.min(100, context.syncRate + 20);
    });
    this.ui.hideDebugConsole();
    this.ui.clearAllPopups();
    this.popups.clearAll();
    this.itss.transition({ type: 'DEBUG_SUCCESS', targetState: 'USER_WAIT' });
  }

  public async handlePlayerVerdictDeclaration(verdict: 'NORMAL' | 'DEFECTIVE'): Promise<void> {
    if (this.gms.getState() !== 'INTERROGATION_ACTIVE') {
      return;
    }

    this.gms.transition({ type: 'VERDICT_DECLARATION', targetState: 'VERDICT_PHASE' });
    const isSuccess = verdict === 'DEFECTIVE';
    const creditsReward = isSuccess ? 100 : 0;

    if (isSuccess) {
      this.gms.updateContext((context) => {
        context.credits += creditsReward;
        context.syncRate = Math.min(100, context.syncRate + 30);
      });
    }

    const cumulativeSyncRate = Math.min(
      100,
      (this.savedCharacterProgress?.sync_rate ?? 0) + this.gms.getContext().syncRate,
    );
    this.gms.updateContext((context) => {
      context.syncRate = cumulativeSyncRate;
    });

    const activeRule = this.currentCharacterPack.hallucinationRules[this.activeRuleIndex];
    if (this.lastSuccessfulCorrection !== '') {
      const chosen = PiiAnonymizer.sanitize(this.lastSuccessfulCorrection);
      const dpoRecord: DpoRecordPayload = {
        data_id: `DPO_${this.currentCharacterPack.characterId}_${Date.now()}`,
        meta_info: {
          character_id: this.currentCharacterPack.characterId,
          client_version: 'v1.0.0-mvp',
          timestamp: new Date().toISOString(),
          turn_index: this.localTurnCounter,
        },
        system_prompt: PromptCompiler.compile(this.currentCharacterPack),
        history_context: this.conversationHistory.flatMap((pair) => [
          { role: 'user' as const, content: pair.user },
          { role: 'assistant' as const, content: pair.assistant },
        ]),
        prompt: this.lastUserQuery || '질의문',
        rejected: activeRule?.erroneousStatement || this.conversationHistory.at(-1)?.assistant || '',
        chosen,
      };

      await this.telemetry.queueTelemetry(dpoRecord);
    }
    const now = new Date().toISOString();
    await this.db.put(DATABASE_STORES.userProfile, {
      user_id: 'USER_UUID_2026',
      credits: this.gms.getContext().credits,
      contributor_score: this.gms.getContext().contributorScore,
      agreement_consented: true,
      last_sync_timestamp: now,
    });
    await this.db.put(DATABASE_STORES.characterProgress, {
      character_id: this.currentCharacterPack.characterId,
      sync_rate: cumulativeSyncRate,
      unlocked_anchors: this.resolveUnlockedAnchors(cumulativeSyncRate),
      is_damaged: false,
      cooldown_until: '',
      interrogation_count: (this.savedCharacterProgress?.interrogation_count ?? 0) + 1,
    });

    this.gms.transition({ type: 'COMPLETE_SUMMARY', targetState: 'RESULT_SUMMARY' });
    this.aps.evaluateState(this.gms.getContext(), isSuccess ? 'DEACTIVATE' : undefined);
    this.applyPersonaMetadata();
    this.ui.showSummaryScreen(isSuccess, creditsReward, this.gms.getContext().syncRate);
  }

  public handlePopupDismissal(id: string): void {
    if (this.popups.destroyPopup(id)) {
      this.ui.destroyPopup(id);
    }
  }

  private async finalizeNpcResponse(parser: StreamingMarkupParser, userQuery: string, fullText: string): Promise<void> {
    this.isNpcStreamingActive = false;
    for (const segment of parser.flush()) {
      this.ui.renderDialogueText(segment.agentId, segment.content, true);
    }

    this.localTurnCounter += 1;
    const dialogueId = `DLG_ARIA_${String(this.localTurnCounter).padStart(2, '0')}`;
    const matchedRuleIndex = this.currentCharacterPack.hallucinationRules.findIndex((rule) =>
      fullText.includes(rule.erroneousStatement),
    );
    const visibleText = this.extractAgentText(fullText, this.currentCharacterPack.characterId);

    this.dialogueHistory.set(dialogueId, {
      dialogueId,
      turnIndex: this.localTurnCounter,
      speakerId: this.currentCharacterPack.characterId,
      textContent: visibleText,
      isHallucination: matchedRuleIndex !== -1,
      associatedRuleIndex: matchedRuleIndex,
    });
    this.conversationHistory.push({ user: userQuery, assistant: visibleText });
    await this.memory.addDialoguePair(userQuery, visibleText);
    this.itss.transition({ type: 'RECV_COMPLETE', targetState: 'USER_WAIT' });
  }

  private extractAgentText(markup: string, agentId: string): string {
    const escapedAgentId = agentId.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    const pattern = new RegExp(`<agent id="${escapedAgentId}">([\\s\\S]*?)<\\/agent>`, 'gu');
    return (
      Array.from(markup.matchAll(pattern), (match) => match[1])
        .join('')
        .trim() || markup
    );
  }

  private applyPersonaMetadata(): void {
    const metadata = this.aps.getActiveMetadata();
    this.ui.setApsMetadata(metadata.glitchIntensity, metadata.audioSpeed, metadata.behaviorSpec);
  }

  private handleOverclockExplosionFailure(): void {
    if (this.gms.getState() !== 'INTERROGATION_ACTIVE') {
      return;
    }

    this.gms.updateContext((context) => {
      context.overclockGauge = 100;
      context.isDamaged = true;
    });
    if (this.itss.getState() !== 'DEATH_SEQUENCE') {
      this.itss.transition({ type: 'PANIC_TIMEOUT', targetState: 'DEATH_SEQUENCE' });
    }
    this.gms.transition({ type: 'FORCE_BAD_END', targetState: 'RESULT_SUMMARY' });
    this.aps.evaluateState(this.gms.getContext(), 'DEACTIVATE');
    this.applyPersonaMetadata();
    this.ui.playStaticSfx(1);
    this.ui.showSummaryScreen(false, 0, 0);
    void this.persistDamagedProgress();
  }

  private resolveUnlockedAnchors(syncRate: number): string[] {
    const anchors = new Set(this.savedCharacterProgress?.unlocked_anchors ?? []);
    if (syncRate >= 30) {
      anchors.add('ANC_ARIA_LV1');
    }
    if (syncRate >= 70) {
      anchors.add('ANC_ARIA_LV2');
    }
    return Array.from(anchors);
  }

  private async persistDamagedProgress(): Promise<void> {
    const cooldownUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await this.db.put(DATABASE_STORES.characterProgress, {
      character_id: this.currentCharacterPack.characterId,
      sync_rate: this.savedCharacterProgress?.sync_rate ?? 0,
      unlocked_anchors: this.savedCharacterProgress?.unlocked_anchors ?? [],
      is_damaged: true,
      cooldown_until: cooldownUntil,
      interrogation_count: (this.savedCharacterProgress?.interrogation_count ?? 0) + 1,
    });
  }
}
