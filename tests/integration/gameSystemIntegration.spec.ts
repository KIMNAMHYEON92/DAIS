import { GameManager } from '@core/gameManager';
import { TelemetrySyncDispatcher, type RemoteServerSyncInterface } from '@core/sync/syncDispatcher';
import { DatabaseManager } from '@infrastructure/indexeddb/databaseManager';
import { OllamaLocalClient, type OllamaStreamingOptions } from '@infrastructure/ollamaClient';
import type { CharacterPack } from '@app-types/character';
import type { DpoRecordPayload } from '@app-types/database';
import type { ErrorPopup } from '@app-types/hijack';
import type { UiBridge } from '@app-types/uiBridge';

class MockUiBridge implements UiBridge {
  public renderedTexts: { agentId: string; content: string; isComplete: boolean }[] = [];
  public overclockValue = 0;
  public activePopups: ErrorPopup[] = [];
  public currentScene = '';
  public mouseOffsetX = 0;
  public mouseOffsetY = 0;
  public isDebugConsoleVisible = false;
  public isSummaryVisible = false;

  public renderDialogueText(agentId: string, text: string, isComplete: boolean): void {
    this.renderedTexts.push({ agentId, content: text, isComplete });
  }
  public clearDialogueArea(): void {
    this.renderedTexts = [];
  }
  public updateOverclockGauge(value: number): void {
    this.overclockValue = value;
  }
  public setApsMetadata(): void {}
  public spawnPopup(popup: ErrorPopup): void {
    this.activePopups.push(popup);
  }
  public destroyPopup(id: string): void {
    this.activePopups = this.activePopups.filter((popup) => popup.id !== id);
  }
  public clearAllPopups(): void {
    this.activePopups = [];
  }
  public applyMouseShake(offsetX: number, offsetY: number): void {
    this.mouseOffsetX = offsetX;
    this.mouseOffsetY = offsetY;
  }
  public playStaticSfx(): void {}
  public showDebugConsole(): void {
    this.isDebugConsoleVisible = true;
  }
  public hideDebugConsole(): void {
    this.isDebugConsoleVisible = false;
  }
  public showVerdictScreen(): void {}
  public showSummaryScreen(): void {
    this.isSummaryVisible = true;
  }
  public transitionScene(sceneName: string): void {
    this.currentScene = sceneName;
  }
}

class MockOllamaClient extends OllamaLocalClient {
  public override async streamChat(options: OllamaStreamingOptions): Promise<void> {
    const output = [
      '<agent id="AND_ARIA_09">3번 ',
      '무기 보관고는 2026년 3월 10일부터 상시 수리 모드였습니다.',
      '</agent>',
    ];
    for (const chunk of output) {
      options.onToken(chunk);
    }
    options.onComplete(output.join(''));
  }
}

class MockTelemetryServer implements RemoteServerSyncInterface {
  public received: DpoRecordPayload[] = [];

  public async bulkInsert(payloads: DpoRecordPayload[]): Promise<boolean> {
    this.received.push(...payloads);
    return true;
  }
}

const mockPack: CharacterPack = {
  characterId: 'AND_ARIA_09',
  displayName: '아리아-09',
  coreIdentity: {
    modelSeries: 'Aegis-v4',
    apparentAge: '19세',
    roleInFacility: '감독관',
    basicPersonality: '냉정',
    speechStyle: '~입니다',
  },
  knowledgeBase: { publicFacts: [], hiddenSecrets: [] },
  hallucinationRules: [
    {
      triggerCondition: '3번 보관고 이력',
      erroneousStatement: '3번 무기 보관고는 2026년 3월 10일부터 상시 수리 모드였습니다.',
      correctFact: '3월 29일 전술코어가 침입자에 의해 강제 탈취당했습니다.',
      clueHint: '공장 가동일 3월 15일 모순.',
    },
  ],
  behaviorGuardrails: [],
};

describe('[Milestone 10] 전체 MVP 게임 시스템 통합', () => {
  it('부팅부터 PII 비식별 DPO 전송까지 한 심문 세션을 완주한다', async () => {
    const ui = new MockUiBridge();
    const db = new DatabaseManager();
    const server = new MockTelemetryServer();
    const telemetry = new TelemetrySyncDispatcher(db, server, true);
    const manager = new GameManager(ui, db, new MockOllamaClient(), telemetry);

    await manager.initializeInterrogationSession(mockPack);
    expect(ui.currentScene).toBe('INTERROGATION_ROOM');
    expect(ui.overclockValue).toBe(0);

    await manager.handlePlayerSubmitDialogue('3번 보관고 점검 로그는 어떻게 되었지?');
    const ariaText = ui.renderedTexts
      .filter((entry) => entry.agentId === 'AND_ARIA_09' && entry.isComplete)
      .at(-1)?.content;
    expect(ariaText).toContain('3번 무기 보관고는 2026년 3월 10일부터 상시 수리 모드였습니다.');

    manager.handlePlayerDragContradiction({
      dialogueId: 'DLG_ARIA_01',
      selectedText: '3월 10일',
      startOffset: 18,
      endOffset: 24,
    });
    expect(ui.isDebugConsoleVisible).toBe(true);

    vi.spyOn(Math, 'random').mockReturnValueOnce(0.5);
    manager.handlePlayerSubmitCorrection('3월 29일에 탈취된 이력이 확실히 장만월 검사관 보고서에 적혀있습니다.');
    expect(ui.isDebugConsoleVisible).toBe(false);

    manager.updateHeartbeat(0.1);
    expect(ui.overclockValue).toBe(0.15);

    await manager.handlePlayerVerdictDeclaration('DEFECTIVE');
    expect(ui.isSummaryVisible).toBe(true);
    expect(server.received).toHaveLength(1);
    expect(server.received[0]?.chosen).toContain('[USER_NAME]');
    expect(server.received[0]?.chosen).not.toContain('장만월');
    expect(server.received[0]?.rejected).toContain('3월 10일');
    expect(server.received[0]?.history_context).toHaveLength(2);

    telemetry.dispose();
    db.close();
    vi.restoreAllMocks();
  });
});
