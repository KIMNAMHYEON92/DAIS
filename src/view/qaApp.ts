import { GlitchOrchestrator } from '@core/hijack/glitchOrchestrator';
import { InputDisrupter } from '@core/hijack/inputDisrupter';
import { PopupOrchestrator } from '@core/hijack/popupOrchestrator';
import { AutomatedQaEngine } from '@core/qa/qaEngine';
import { ContradictionMatcher } from '@core/parser/contradictionMatcher';
import {
  TelemetrySyncDispatcher,
  type RemoteServerSyncInterface,
} from '@core/sync/syncDispatcher';
import { OverclockEngine } from '@core/validator/overclockEngine';
import { DeterministicTypingValidator } from '@core/validator/typingValidator';
import { DomSelectionCapturer } from '@infrastructure/dom/selectionCapturer';
import { DatabaseManager } from '@infrastructure/indexeddb/databaseManager';
import {
  DATABASE_STORES,
  type DpoRecordPayload,
  type OfflineTelemetryEntity,
} from '@app-types/database';
import type { DialogueEntity, MatchingRuleConfig } from '@app-types/parser';

type TesterVerdict = 'PENDING' | 'PASS' | 'FAIL' | 'BLOCKED';

interface TesterRecord {
  verdict: TesterVerdict;
  notes: string;
  testedAt: string;
}

interface EvidenceRecord {
  status: 'NOT_RUN' | 'PASSED' | 'FAILED' | 'PARTIAL';
  summary: string;
  details: string[];
}

interface QaCase {
  id: string;
  title: string;
  acceptance: string;
  objective: string;
}

const CASES: readonly QaCase[] = [
  {
    id: 'TC-1',
    title: '로컬 로드 및 심문방 초기화',
    acceptance: 'AC-1',
    objective: '환경 지원 여부와 로드 시간을 확인하고 아리아-09 페르소나 픽스처를 기동합니다.',
  },
  {
    id: 'TC-2',
    title: '모순 드래그 및 디버깅 필터',
    acceptance: 'AC-2',
    objective: '실제 DOM 텍스트 선택, 오프셋 판정, 키워드 검증과 게이지 -30%를 확인합니다.',
  },
  {
    id: 'TC-3',
    title: '과열 임계치 및 UI 하이재킹',
    acceptance: 'Gameplay KPI',
    objective: '80%/90%/100% 단계에서 스캔라인, 팝업, 입력 유실, 파괴 상태를 관찰합니다.',
  },
  {
    id: 'TC-4',
    title: 'PII 마스킹 및 DPO 캡처',
    acceptance: 'AC-3',
    objective: '민감정보가 로컬 저장 전에 대체 토큰으로 영구 치환되는지 확인합니다.',
  },
  {
    id: 'TC-5',
    title: '오프라인 큐 및 복구 동기화',
    acceptance: 'AC-3',
    objective: '오프라인 적재 후 온라인 복구 시 업로드와 로컬 큐 삭제를 확인합니다.',
  },
] as const;

const DIALOGUE: DialogueEntity = {
  dialogueId: 'DLG_ARIA_004',
  turnIndex: 4,
  speakerId: 'AND_ARIA_09',
  textContent:
    '3번 무기 보관고는 2026년 3월 10일부터 상시 수리 모드였으므로 완벽히 폐쇄되어 있었습니다.',
  isHallucination: true,
  associatedRuleIndex: 0,
};

const MATCHING_RULES: MatchingRuleConfig[] = [
  {
    erroneousStatement: DIALOGUE.textContent,
    correctFact: '3번 보관고는 3월 29일에 전술 코어를 탈취당했습니다.',
    clueHint: '공장 가동일 3월 15일과 보관고 기록의 시계열을 비교하십시오.',
  },
];

const STORAGE_KEY = 'dais_m9_tester_records';

class QaRemoteServer implements RemoteServerSyncInterface {
  public readonly storage: DpoRecordPayload[] = [];

  public async bulkInsert(payloads: DpoRecordPayload[]): Promise<boolean> {
    this.storage.push(...payloads);
    return true;
  }
}

export class QaApplication {
  private activeCaseId = 'TC-1';
  private readonly records = new Map<string, TesterRecord>();
  private readonly evidence = new Map<string, EvidenceRecord>();
  private readonly database = new DatabaseManager();
  private readonly remoteServer = new QaRemoteServer();
  private dispatcher: TelemetrySyncDispatcher | null = null;
  private readonly matcher = new ContradictionMatcher();
  private readonly validator = new DeterministicTypingValidator();
  private readonly overclock = new OverclockEngine(50);
  private readonly glitch = new GlitchOrchestrator();
  private readonly popups = new PopupOrchestrator();
  private readonly disrupter = new InputDisrupter();
  private readonly qaEngine = new AutomatedQaEngine();
  private queue: OfflineTelemetryEntity[] = [];
  private correctionUnlocked = false;
  private networkOnline = false;
  private tc1Measurement = '아직 실행하지 않음';
  private tc2Message = '아리아의 발화에서 “3월 10일”을 마우스로 정확히 드래그하십시오.';
  private tc3Gauge = 0;
  private tc3Input = '';
  private tc3DeletionCount = 0;
  private tc4Input =
    '3월 29일에 탈취된 것이 맞습니다. 제 번호는 010-1234-5678, 이메일은 tester@example.com 입니다.';

  public constructor(private readonly root: HTMLElement) {
    this.loadRecords();
  }

  public async start(): Promise<void> {
    await this.database.open();
    this.dispatcher = new TelemetrySyncDispatcher(
      this.database,
      this.remoteServer,
      false,
      window,
    );
    await this.refreshQueue();
    this.render();
    this.bindEvents();
  }

  private bindEvents(): void {
    this.root.addEventListener('click', (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const actionElement = target?.closest<HTMLElement>('[data-action]');
      if (actionElement === null || actionElement === undefined) {
        return;
      }
      void this.handleAction(actionElement.dataset.action ?? '', actionElement);
    });

    this.root.addEventListener('input', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
        return;
      }
      if (target.id === 'tester-notes') {
        const record = this.getRecord(this.activeCaseId);
        record.notes = target.value;
        this.saveRecords();
      }
      if (target.id === 'pii-input') {
        this.tc4Input = target.value;
      }
      if (target.id === 'hijack-input') {
        const disrupted = this.disrupter.processTypingDisruption(target.value, Math.random());
        if (disrupted !== target.value) {
          this.tc3DeletionCount += 1;
        }
        this.tc3Input = disrupted;
        target.value = disrupted;
        this.updateTc3Evidence();
      }
    });

    this.root.addEventListener('mouseup', (event) => {
      if (!(event instanceof MouseEvent) || this.activeCaseId !== 'TC-2') {
        return;
      }
      const captured = DomSelectionCapturer.capture(event);
      if (captured === null) {
        return;
      }
      const result = this.matcher.evaluate(
        captured,
        new Map([[DIALOGUE.dialogueId, DIALOGUE]]),
        MATCHING_RULES,
      );
      if (result.isMatch) {
        this.correctionUnlocked = true;
        this.tc2Message = `오프셋 ${captured.startOffset}–${captured.endOffset} 일치. 반박 콘솔이 열렸습니다.`;
      } else {
        if (result.penaltyApplied) {
          this.overclock.applyEvent('DRAG_MISS');
        }
        this.tc2Message = `불일치(${result.errorCode}). 현재 게이지 ${this.overclock.getGauge()}%.`;
      }
      this.render();
    });
  }

  private async handleAction(action: string, element: HTMLElement): Promise<void> {
    if (action === 'select-case') {
      this.activeCaseId = element.dataset.caseId ?? 'TC-1';
      this.render();
      return;
    }
    if (action === 'set-verdict') {
      const record = this.getRecord(this.activeCaseId);
      record.verdict = (element.dataset.verdict as TesterVerdict | undefined) ?? 'PENDING';
      record.testedAt = new Date().toISOString();
      this.saveRecords();
      this.render();
      return;
    }
    if (action === 'run-tc1') {
      await this.runTc1();
    } else if (action === 'submit-correction') {
      this.submitCorrection();
    } else if (action === 'set-gauge') {
      this.setTc3Gauge(Number(element.dataset.gauge ?? 0));
    } else if (action === 'force-delete') {
      this.tc3Input = this.disrupter.processTypingDisruption(this.tc3Input, 0);
      this.tc3DeletionCount += 1;
      this.updateTc3Evidence();
    } else if (action === 'queue-pii') {
      await this.queuePiiRecord();
    } else if (action === 'set-offline') {
      this.setNetwork(false);
    } else if (action === 'queue-sample') {
      await this.queueSampleRecord();
    } else if (action === 'sync-online') {
      await this.syncOnline();
    } else if (action === 'clear-queue') {
      await this.clearQueue();
    } else if (action === 'export-json') {
      this.download('dais-m9-qa-result.json', JSON.stringify(this.buildExport(), null, 2), 'application/json');
    } else if (action === 'export-markdown') {
      this.download('dais-m9-qa-result.md', this.buildMarkdown(), 'text/markdown');
    } else if (action === 'reset-results') {
      localStorage.removeItem(STORAGE_KEY);
      this.records.clear();
      this.evidence.clear();
    }
    this.render();
  }

  private async runTc1(): Promise<void> {
    const measured = await this.qaEngine.benchmarkColdBoot(
      () => new Promise((resolve) => window.setTimeout(resolve, 350)),
    );
    const webGpuSupported = 'gpu' in navigator;
    this.tc1Measurement = `QA 픽스처 ${measured}ms / WebGPU ${webGpuSupported ? '감지됨' : '미감지'}`;
    this.evidence.set('TC-1', {
      status: webGpuSupported ? 'PARTIAL' : 'FAILED',
      summary: webGpuSupported
        ? '브라우저 환경과 페르소나 픽스처를 확인했습니다.'
        : 'WebGPU를 감지하지 못했습니다.',
      details: [
        `QA 픽스처 로드: ${measured}ms`,
        '실제 1.5GB 모델 콜드 부트는 모델 자산이 연결된 배포 빌드에서 별도 실측해야 합니다.',
      ],
    });
  }

  private submitCorrection(): void {
    const input = this.root.querySelector<HTMLInputElement>('#correction-input');
    if (input === null) {
      return;
    }
    const before = this.overclock.getGauge();
    const start = performance.now();
    const result = this.validator.validate(input.value, {
      requiredKeywords: ['3월 15일', '3월 29일', '탈취', '공장'],
      minimumKeywordMatchCount: 2,
      forbiddenPatterns: ['^[ㄱ-ㅎㅏ-ㅣ]+$', '바보', '쓰레기', '섹스'],
    });
    if (result.isValid) {
      this.overclock.applyEvent('DEBUG_SUCCESS');
    } else {
      this.overclock.applyEvent('DEBUG_FAIL');
    }
    const elapsed = Number((performance.now() - start).toFixed(2));
    this.tc2Message = result.isValid
      ? `SUCCESS — ${result.matchedKeywords.join(', ')} / ${before}% → ${this.overclock.getGauge()}% / ${elapsed}ms`
      : `FAILED(${result.errorCode}) — ${this.overclock.getGauge()}%`;
    this.evidence.set('TC-2', {
      status: result.isValid && before - this.overclock.getGauge() === 30 ? 'PASSED' : 'FAILED',
      summary: this.tc2Message,
      details: [
        `키워드 일치 ${result.matchCount}개`,
        `피드백 처리 ${elapsed}ms`,
        `최종 게이지 ${this.overclock.getGauge()}%`,
      ],
    });
  }

  private setTc3Gauge(gauge: number): void {
    this.tc3Gauge = gauge;
    if (gauge >= 80) {
      this.popups.updateTick(4, gauge, window.innerWidth, window.innerHeight, 0.35);
    }
    this.updateTc3Evidence();
  }

  private updateTc3Evidence(): void {
    const parameters = this.glitch.evaluateGlitch(this.tc3Gauge, 0.1);
    this.evidence.set('TC-3', {
      status: this.tc3Gauge >= 100 && this.tc3DeletionCount > 0 ? 'PASSED' : 'PARTIAL',
      summary: `${this.tc3Gauge}% 임계 상태 / 강제 유실 ${this.tc3DeletionCount}회`,
      details: [
        `스캔라인: ${parameters.scanlineEnabled ? 'ON' : 'OFF'}`,
        `팝업: ${this.popups.getPopups().length}개`,
        `글리치 강도: ${parameters.glitchIntensity}`,
      ],
    });
  }

  private async queuePiiRecord(): Promise<void> {
    this.setNetwork(false);
    await this.dispatcher?.queueTelemetry(this.createPayload('M9_TC4', this.tc4Input));
    await this.refreshQueue();
    const latest = this.queue[this.queue.length - 1];
    const masked = latest?.payload.chosen ?? '';
    const passed =
      masked.includes('[REDACTED_PHONE]') &&
      masked.includes('[REDACTED_EMAIL]') &&
      !masked.includes('010-1234-5678');
    this.evidence.set('TC-4', {
      status: passed ? 'PASSED' : 'FAILED',
      summary: passed ? 'PII가 마스킹된 상태로 IndexedDB에 저장되었습니다.' : '마스킹 결과를 확인하십시오.',
      details: [masked],
    });
  }

  private async queueSampleRecord(): Promise<void> {
    this.setNetwork(false);
    await this.dispatcher?.queueTelemetry(
      this.createPayload(`M9_TC5_${Date.now()}`, '3월 29일 탈취 기록을 복구합니다.'),
    );
    await this.refreshQueue();
    this.evidence.set('TC-5', {
      status: 'PARTIAL',
      summary: `오프라인 큐 ${this.queue.length}건 적재됨`,
      details: ['아직 원격 동기화를 실행하지 않았습니다.'],
    });
  }

  private async syncOnline(): Promise<void> {
    const before = this.queue.length;
    this.setNetwork(true);
    const synced = (await this.dispatcher?.syncPendingQueue()) ?? 0;
    await this.refreshQueue();
    const passed = before > 0 && synced === before && this.queue.length === 0;
    this.evidence.set('TC-5', {
      status: passed ? 'PASSED' : 'FAILED',
      summary: `전송 ${synced}건 / 로컬 잔여 ${this.queue.length}건`,
      details: [
        `QA 수신 서버 누적 ${this.remoteServer.storage.length}건`,
        '이 하네스는 실제 Supabase가 아닌 메모리 기반 QA 수신기를 사용합니다.',
      ],
    });
  }

  private async clearQueue(): Promise<void> {
    await this.refreshQueue();
    await Promise.all(
      this.queue
        .filter((record) => record.queue_id !== undefined)
        .map((record) =>
          this.database.delete(DATABASE_STORES.offlineTelemetryQueue, record.queue_id!),
        ),
    );
    await this.refreshQueue();
  }

  private setNetwork(online: boolean): void {
    this.networkOnline = online;
    this.dispatcher?.setNetworkState(online);
  }

  private createPayload(id: string, chosen: string): DpoRecordPayload {
    return {
      data_id: id,
      meta_info: {
        character_id: 'AND_ARIA_09',
        client_version: 'v1.0.0-m9-qa',
        timestamp: new Date().toISOString(),
        turn_index: 4,
      },
      system_prompt: 'QA fixture: Aria-09',
      history_context: [],
      prompt: '3번 보관고의 실제 기록은 무엇입니까?',
      rejected: DIALOGUE.textContent,
      chosen,
    };
  }

  private async refreshQueue(): Promise<void> {
    this.queue = await this.database.getAll<OfflineTelemetryEntity>(
      DATABASE_STORES.offlineTelemetryQueue,
    );
  }

  private render(): void {
    const activeCase = CASES.find((item) => item.id === this.activeCaseId) ?? CASES[0];
    const completed = CASES.filter((item) => this.getRecord(item.id).verdict !== 'PENDING').length;
    const evidence = this.evidence.get(activeCase.id) ?? {
      status: 'NOT_RUN',
      summary: '아직 자동 증거가 없습니다.',
      details: [],
    };
    const record = this.getRecord(activeCase.id);

    this.root.innerHTML = `
      <header class="topbar">
        <div>
          <p class="eyebrow">BAD ANDROID INTERROGATION STATION</p>
          <h1>Milestone 9 // QA 검증실</h1>
        </div>
        <div class="run-status"><span>${completed}/5 판정</span><span class="status-dot"></span>LOCAL QA</div>
      </header>
      <main class="qa-layout">
        <aside class="case-nav" aria-label="테스트 케이스">
          <p class="section-label">검증 순서</p>
          ${CASES.map((item) => this.renderNavItem(item)).join('')}
          <div class="nav-actions">
            <button class="secondary" data-action="export-json">JSON 내보내기</button>
            <button class="secondary" data-action="export-markdown">Markdown 내보내기</button>
            <button class="text-button" data-action="reset-results">판정 초기화</button>
          </div>
        </aside>
        <section class="workspace">
          <div class="case-heading">
            <div><span class="case-id">${activeCase.id}</span><span class="ac-tag">${activeCase.acceptance}</span></div>
            <h2>${activeCase.title}</h2>
            <p>${activeCase.objective}</p>
          </div>
          <div class="notice">
            <strong>검증 범위</strong>
            이 화면은 결정론적 QA 픽스처입니다. 실제 모델 다운로드·VRAM·Supabase 항목은 배포 환경에서 별도 확인해야 하며 자동으로 합격 처리하지 않습니다.
          </div>
          ${this.renderStage(activeCase.id)}
          <section class="evidence-card">
            <div class="card-title"><h3>자동 증거</h3><span class="evidence-status ${evidence.status.toLowerCase()}">${evidence.status}</span></div>
            <p>${this.escape(evidence.summary)}</p>
            ${evidence.details.length > 0 ? `<ul>${evidence.details.map((detail) => `<li>${this.escape(detail)}</li>`).join('')}</ul>` : ''}
          </section>
          <section class="verdict-card">
            <div class="card-title"><h3>테스터 판정</h3><span>자동 증거와 독립적으로 선택</span></div>
            <div class="verdict-grid">
              ${(['PASS', 'FAIL', 'BLOCKED', 'PENDING'] as const)
                .map(
                  (verdict) =>
                    `<button class="${record.verdict === verdict ? 'selected' : ''}" data-action="set-verdict" data-verdict="${verdict}">${verdict}</button>`,
                )
                .join('')}
            </div>
            <label for="tester-notes">관찰 내용·증거 위치·재현 조건</label>
            <textarea id="tester-notes" rows="4" placeholder="예: Chrome 126 / RTX 3060, 90%에서 팝업 2개 확인">${this.escape(record.notes)}</textarea>
            <p class="saved-at">${record.testedAt ? `마지막 판정: ${record.testedAt}` : '아직 판정하지 않았습니다.'}</p>
          </section>
        </section>
      </main>
    `;
  }

  private renderNavItem(item: QaCase): string {
    const verdict = this.getRecord(item.id).verdict;
    return `
      <button class="case-nav-item ${item.id === this.activeCaseId ? 'active' : ''}" data-action="select-case" data-case-id="${item.id}">
        <span class="nav-index">${item.id}</span>
        <span><strong>${item.title}</strong><small>${item.acceptance}</small></span>
        <span class="verdict-dot ${verdict.toLowerCase()}" title="${verdict}"></span>
      </button>
    `;
  }

  private renderStage(caseId: string): string {
    if (caseId === 'TC-1') {
      return `
        <section class="stage-card">
          <div class="card-title"><h3>1. 게임 실행·환경 점검</h3><span>실측 시작점</span></div>
          <ol class="steps"><li>아래 환경 표시를 확인합니다.</li><li>“아리아-09 기동”을 누릅니다.</li><li>사무적 경어체 도입문과 측정값을 확인합니다.</li></ol>
          <div class="environment-grid">
            <div><span>WebGPU</span><strong>${'gpu' in navigator ? 'DETECTED' : 'NOT DETECTED'}</strong></div>
            <div><span>IndexedDB</span><strong>${'indexedDB' in globalThis ? 'READY' : 'UNAVAILABLE'}</strong></div>
            <div><span>Online API</span><strong>${navigator.onLine ? 'BROWSER ONLINE' : 'BROWSER OFFLINE'}</strong></div>
          </div>
          <button class="primary" data-action="run-tc1">아리아-09 기동</button>
          <div class="terminal-output"><span>ARIA-09</span> 검사관님, 중앙 통제실 무기 관리 감독관 아리아-09입니다. 심문을 시작합니까?<br><small>${this.escape(this.tc1Measurement)}</small></div>
        </section>
      `;
    }
    if (caseId === 'TC-2') {
      return `
        <section class="stage-card">
          <div class="card-title"><h3>2. 실제 텍스트 드래그</h3><span>현재 게이지 ${this.overclock.getGauge()}%</span></div>
          <ol class="steps"><li>아래 NPC 문장의 “3월 10일”을 드래그합니다.</li><li>열린 반박 콘솔에 예시 문장을 입력합니다.</li><li>Enter 대신 “교정 제출”을 누르고 -30%를 확인합니다.</li></ol>
          <div class="dialogue-log">
            <p class="speaker">ARIA-09 // TURN 04</p>
            <p class="npc-bubble" data-dialogue-id="${DIALOGUE.dialogueId}">${DIALOGUE.textContent}</p>
          </div>
          <p class="system-message">${this.escape(this.tc2Message)}</p>
          ${
            this.correctionUnlocked
              ? `<div class="correction-console">
                  <label for="correction-input">반박 코드</label>
                  <input id="correction-input" value="3월 15일 공장 가동 및 3월 29일 탈취 기록을 확인하십시오." />
                  <button class="primary" data-action="submit-correction">교정 제출</button>
                </div>`
              : ''
          }
        </section>
      `;
    }
    if (caseId === 'TC-3') {
      const params = this.glitch.evaluateGlitch(this.tc3Gauge, 0.1);
      const shake = this.disrupter.calculateMouseShake(0.013, 15, 25, 0.8, 0.6);
      return `
        <section class="stage-card hijack-stage ${params.scanlineEnabled ? 'scanline-active' : ''} ${this.tc3Gauge >= 100 ? 'death-state' : ''}">
          <div class="card-title"><h3>3. 임계치 강제 주입</h3><span>${this.tc3Gauge}%</span></div>
          <ol class="steps"><li>80%에서 스캔라인과 경고창을 확인합니다.</li><li>90%에서 흔들림 표시와 입력 유실을 확인합니다.</li><li>100%에서 파괴 상태를 확인합니다.</li></ol>
          <div class="gauge"><span style="width:${this.tc3Gauge}%"></span></div>
          <div class="threshold-buttons">
            <button data-action="set-gauge" data-gauge="80">80% 주입</button>
            <button data-action="set-gauge" data-gauge="90">90% 주입</button>
            <button data-action="set-gauge" data-gauge="100">100% 주입</button>
            <button data-action="set-gauge" data-gauge="0">초기화</button>
          </div>
          ${
            this.tc3Gauge >= 80
              ? `<div class="error-popup"><strong>${this.popups.getPopups()[0]?.title ?? 'ERROR: Core Overheat 0x99'}</strong><span>LOGIC BUFFER CORRUPTED</span></div>`
              : ''
          }
          ${
            this.tc3Gauge >= 90
              ? `<div class="hijack-test" style="transform:translate(${shake.offsetX}px, ${shake.offsetY}px)">
                  <label for="hijack-input">5% 확률 입력 유실 체험</label>
                  <input id="hijack-input" value="${this.escape(this.tc3Input)}" placeholder="계속 입력해 보십시오" />
                  <button data-action="force-delete">QA 강제 유실 1회</button>
                  <small>관찰된 유실 ${this.tc3DeletionCount}회</small>
                </div>`
              : ''
          }
          ${this.tc3Gauge >= 100 ? '<div class="death-message">SYSTEM COLLAPSE // ANDROID DAMAGED</div>' : ''}
        </section>
      `;
    }
    if (caseId === 'TC-4') {
      return `
        <section class="stage-card">
          <div class="card-title"><h3>4. IndexedDB 마스킹 확인</h3><span>로컬 큐 ${this.queue.length}건</span></div>
          <ol class="steps"><li>테스트 전용 가짜 개인정보를 사용합니다.</li><li>“오프라인 저장”을 누릅니다.</li><li>아래 큐의 chosen 값에서 원문이 사라졌는지 확인합니다.</li></ol>
          <label for="pii-input">교정문</label>
          <textarea id="pii-input" rows="3">${this.escape(this.tc4Input)}</textarea>
          <button class="primary" data-action="queue-pii">마스킹 후 오프라인 저장</button>
          <button data-action="clear-queue">테스트 큐 비우기</button>
          ${this.renderQueue()}
        </section>
      `;
    }
    return `
      <section class="stage-card">
        <div class="card-title"><h3>5. 네트워크 복구 시나리오</h3><span>${this.networkOnline ? 'ONLINE' : 'OFFLINE'}</span></div>
        <ol class="steps"><li>“오프라인 전환” 후 샘플 1건을 적재합니다.</li><li>로컬 큐 건수가 증가했는지 확인합니다.</li><li>“온라인 복구·동기화” 후 로컬 0건과 수신 건수를 확인합니다.</li></ol>
        <div class="sync-stats">
          <div><span>Local queue</span><strong>${this.queue.length}</strong></div>
          <div><span>QA receiver</span><strong>${this.remoteServer.storage.length}</strong></div>
          <div><span>Network</span><strong>${this.networkOnline ? 'ONLINE' : 'OFFLINE'}</strong></div>
        </div>
        <div class="threshold-buttons">
          <button data-action="set-offline">1. 오프라인 전환</button>
          <button data-action="queue-sample">2. 샘플 적재</button>
          <button class="primary" data-action="sync-online">3. 온라인 복구·동기화</button>
          <button data-action="clear-queue">큐 비우기</button>
        </div>
        ${this.renderQueue()}
      </section>
    `;
  }

  private renderQueue(): string {
    if (this.queue.length === 0) {
      return '<div class="empty-queue">tbl_offline_telemetry_queue: 0건</div>';
    }
    return `
      <div class="queue-table">
        <div class="queue-row queue-head"><span>ID</span><span>chosen (sanitized)</span></div>
        ${this.queue
          .slice(-3)
          .map(
            (record) =>
              `<div class="queue-row"><code>${this.escape(record.data_id)}</code><code>${this.escape(record.payload.chosen)}</code></div>`,
          )
          .join('')}
      </div>
    `;
  }

  private getRecord(caseId: string): TesterRecord {
    const existing = this.records.get(caseId);
    if (existing !== undefined) {
      return existing;
    }
    const record: TesterRecord = { verdict: 'PENDING', notes: '', testedAt: '' };
    this.records.set(caseId, record);
    return record;
  }

  private loadRecords(): void {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<
        string,
        TesterRecord
      >;
      Object.entries(stored).forEach(([caseId, record]) => this.records.set(caseId, record));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  private saveRecords(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(this.records)));
  }

  private buildExport(): object {
    return {
      schemaVersion: '1.0',
      exportedAt: new Date().toISOString(),
      environment: {
        userAgent: navigator.userAgent,
        webGpuDetected: 'gpu' in navigator,
        browserOnline: navigator.onLine,
      },
      scopeWarning:
        'QA fixture results do not replace real WebLLM cold-boot, VRAM, throughput, or Supabase verification.',
      cases: CASES.map((item) => ({
        ...item,
        evidence: this.evidence.get(item.id) ?? null,
        tester: this.getRecord(item.id),
      })),
    };
  }

  private buildMarkdown(): string {
    const rows = CASES.map((item) => {
      const tester = this.getRecord(item.id);
      const evidence = this.evidence.get(item.id);
      return `| ${item.id} | ${evidence?.status ?? 'NOT_RUN'} | ${tester.verdict} | ${tester.notes.replace(/\|/gu, '\\|')} |`;
    });
    return [
      '# DAIS Milestone 9 사용자 교차검증 결과',
      '',
      `- 내보낸 시각: ${new Date().toISOString()}`,
      `- WebGPU 감지: ${'gpu' in navigator ? '예' : '아니오'}`,
      '- 주의: QA 픽스처 결과는 실제 WebLLM·VRAM·Supabase 실측을 대체하지 않습니다.',
      '',
      '| TC | 자동 증거 | 테스터 판정 | 메모 |',
      '| --- | --- | --- | --- |',
      ...rows,
      '',
    ].join('\n');
  }

  private download(filename: string, contents: string, type: string): void {
    const url = URL.createObjectURL(new Blob([contents], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private escape(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
}
