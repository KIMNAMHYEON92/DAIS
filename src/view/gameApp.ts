import { GameManager } from '@core/gameManager';
import { TelemetrySyncDispatcher, type RemoteServerSyncInterface } from '@core/sync/syncDispatcher';
import { ARIA_CHARACTER_PACK } from '../game/ariaPack';
import { ResilientLocalClient, type RuntimeEngineMode } from '@infrastructure/demoLocalClient';
import { DomSelectionCapturer } from '@infrastructure/dom/selectionCapturer';
import { DatabaseManager } from '@infrastructure/indexeddb/databaseManager';
import { DATABASE_STORES, type DpoRecordPayload, type OfflineTelemetryEntity } from '@app-types/database';
import type { ErrorPopup } from '@app-types/hijack';
import type { UiBridge } from '@app-types/uiBridge';

class LocalDemoTelemetryServer implements RemoteServerSyncInterface {
  public async bulkInsert(_payloads: DpoRecordPayload[]): Promise<boolean> {
    // The public demo deliberately keeps consented training data on-device.
    // A production Supabase adapter can replace this boundary.
    return false;
  }
}

interface SummaryResult {
  success: boolean;
  credits: number;
  syncRate: number;
}

type RuntimeLabel = 'DEMO CORE' | 'OLLAMA' | 'OLLAMA → DEMO';

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/gu,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      })[character] ?? character,
  );

export class GameApplication implements UiBridge {
  private readonly database = new DatabaseManager();
  private readonly telemetry = new TelemetrySyncDispatcher(
    this.database,
    new LocalDemoTelemetryServer(),
    false,
    window,
  );
  private manager: GameManager | null = null;
  private scene: 'LOBBY' | 'INTERROGATION' | 'RESULT' = 'LOBBY';
  private runtimeMode: RuntimeEngineMode = 'DEMO';
  private runtimeLabel: RuntimeLabel = 'DEMO CORE';
  private dialogueCounter = 0;
  private activeStreamingBubble: HTMLElement | null = null;
  private heartbeatHandle: number | null = null;
  private lastFrameTime = 0;
  private summary: SummaryResult | null = null;
  private debugConsoleVisible = false;
  private busy = false;

  public constructor(private readonly root: HTMLElement) {}

  public async start(): Promise<void> {
    await this.database.open();
    this.root.className = 'game-app';
    this.bindEvents();
    this.renderLobby();
  }

  public dispose(): void {
    this.stopHeartbeat();
    this.telemetry.dispose();
    this.database.close();
  }

  public renderDialogueText(agentId: string, text: string, isComplete: boolean): void {
    const dialogueArea = this.root.querySelector<HTMLElement>('#dialogue-area');
    if (dialogueArea === null) {
      return;
    }

    if (agentId === 'SYS_CONSOLE') {
      const notice = document.createElement('div');
      notice.className = 'system-line';
      notice.textContent = text;
      dialogueArea.append(notice);
      this.scrollDialogue();
      return;
    }

    if (this.activeStreamingBubble === null) {
      const row = document.createElement('article');
      row.className = 'dialogue-row npc';
      row.innerHTML = `
        <div class="speaker-chip">ARIA-09</div>
        <p class="npc-bubble" aria-live="polite"></p>
      `;
      dialogueArea.append(row);
      this.activeStreamingBubble = row.querySelector<HTMLElement>('.npc-bubble');
    }

    if (this.activeStreamingBubble !== null) {
      this.activeStreamingBubble.textContent = text;
      this.activeStreamingBubble.closest('.dialogue-row')?.classList.toggle('streaming', !isComplete);

      if (isComplete) {
        this.dialogueCounter += 1;
        this.activeStreamingBubble.dataset.dialogueId = `DLG_ARIA_${String(this.dialogueCounter).padStart(2, '0')}`;
        this.activeStreamingBubble = null;
      }
    }

    this.scrollDialogue();
  }

  public clearDialogueArea(): void {
    const dialogueArea = this.root.querySelector<HTMLElement>('#dialogue-area');
    if (dialogueArea !== null) {
      dialogueArea.innerHTML = '';
    }
    this.dialogueCounter = 0;
    this.activeStreamingBubble = null;
  }

  public updateOverclockGauge(value: number): void {
    const fill = this.root.querySelector<HTMLElement>('#overclock-fill');
    const label = this.root.querySelector<HTMLElement>('#overclock-value');
    if (fill !== null) {
      fill.style.width = `${Math.min(100, Math.max(0, value))}%`;
    }
    if (label !== null) {
      label.textContent = `${value.toFixed(1)}%`;
    }
    this.root.classList.toggle('critical', value >= 80);
  }

  public setApsMetadata(glitchIntensity: number, audioSpeed: number, behaviorSpec: string): void {
    this.root.style.setProperty('--glitch-intensity', String(glitchIntensity));
    const behavior = this.root.querySelector<HTMLElement>('#persona-behavior');
    const audio = this.root.querySelector<HTMLElement>('#audio-speed');
    if (behavior !== null) {
      behavior.textContent = behaviorSpec;
    }
    if (audio !== null) {
      audio.textContent = `${audioSpeed.toFixed(2)}×`;
    }
  }

  public spawnPopup(popup: ErrorPopup): void {
    const layer = this.root.querySelector<HTMLElement>('#popup-layer');
    if (layer === null || document.getElementById(popup.id) !== null) {
      return;
    }

    const element = document.createElement('section');
    element.id = popup.id;
    element.className = 'intrusion-popup';
    element.style.left = `${5 + (popup.positionX / 1920) * 65}%`;
    element.style.top = `${10 + (popup.positionY / 1080) * 55}%`;
    element.innerHTML = `
      <button type="button" data-action="dismiss-popup" data-popup-id="${escapeHtml(popup.id)}" aria-label="경고창 닫기">×</button>
      <strong>${escapeHtml(popup.title)}</strong>
      <span>${escapeHtml(popup.errorCode)}</span>
      <p>LOGIC BUFFER COLLISION</p>
    `;
    layer.append(element);
  }

  public destroyPopup(id: string): void {
    document.getElementById(id)?.remove();
  }

  public clearAllPopups(): void {
    const layer = this.root.querySelector<HTMLElement>('#popup-layer');
    if (layer !== null) {
      layer.innerHTML = '';
    }
  }

  public applyMouseShake(offsetX: number, offsetY: number): void {
    const stage = this.root.querySelector<HTMLElement>('#game-stage');
    if (stage !== null) {
      stage.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    }
  }

  public playStaticSfx(volume: number): void {
    this.root.classList.remove('static-pulse');
    void this.root.offsetWidth;
    this.root.classList.add('static-pulse');

    const AudioContextConstructor = window.AudioContext;
    if (AudioContextConstructor === undefined || volume <= 0) {
      return;
    }

    try {
      const context = new AudioContextConstructor();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'square';
      oscillator.frequency.value = volume >= 0.8 ? 96 : 180;
      gain.gain.value = Math.min(0.025, volume * 0.025);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.045);
      oscillator.addEventListener('ended', () => void context.close(), { once: true });
    } catch {
      // Audio feedback is progressive enhancement; visual feedback remains.
    }
  }

  public showDebugConsole(erroneousText: string, hint: string): void {
    const layer = this.root.querySelector<HTMLElement>('#modal-layer');
    if (layer === null) {
      return;
    }
    this.debugConsoleVisible = true;
    layer.innerHTML = `
      <section class="debug-console" role="dialog" aria-modal="true" aria-labelledby="debug-title">
        <p class="danger-label">LOGICAL CORRUPTION DETECTED</p>
        <h2 id="debug-title">반박 코드 디버깅</h2>
        <div class="corrupted-quote">“${escapeHtml(erroneousText)}”</div>
        <p class="debug-hint"><strong>HINT</strong> ${escapeHtml(hint)}</p>
        <form id="correction-form">
          <label for="correction-input">교정 사실을 10~100자로 입력하십시오</label>
          <textarea id="correction-input" rows="3" maxlength="100" required placeholder="예: 공장 가동일은 3월 15일이고, 3월 29일 탈취 기록이 존재합니다."></textarea>
          <p id="correction-feedback">필수 단서 2개 이상: 3월 15일 · 3월 29일 · 탈취 · 공장</p>
          <button class="danger-button" type="submit">교정 코드 실행</button>
        </form>
      </section>
    `;
    this.root.querySelector<HTMLTextAreaElement>('#correction-input')?.focus();
  }

  public hideDebugConsole(): void {
    this.debugConsoleVisible = false;
    const layer = this.root.querySelector<HTMLElement>('#modal-layer');
    if (layer !== null) {
      layer.innerHTML = '';
    }
    this.renderToast('LOGIC PATCH APPLIED // 과열 -30%', 'success');
  }

  public showVerdictScreen(): void {
    const layer = this.root.querySelector<HTMLElement>('#modal-layer');
    if (layer === null) {
      return;
    }
    layer.innerHTML = `
      <section class="verdict-console" role="dialog" aria-modal="true" aria-labelledby="verdict-title">
        <p class="eyebrow">FINAL CLASSIFICATION</p>
        <h2 id="verdict-title">아리아-09 최종 판정</h2>
        <p>수집한 증거를 바탕으로 기체의 상태를 분류하십시오. 제출 후에는 변경할 수 없습니다.</p>
        <div class="verdict-actions">
          <button type="button" data-action="submit-verdict" data-verdict="NORMAL">정상 기체</button>
          <button type="button" class="danger-button" data-action="submit-verdict" data-verdict="DEFECTIVE">불량 · 처분</button>
        </div>
        <button type="button" class="ghost-button" data-action="close-modal">심문 계속</button>
      </section>
    `;
  }

  public showSummaryScreen(success: boolean, creditsAwarded: number, syncRate: number): void {
    this.summary = { success, credits: creditsAwarded, syncRate };
    this.scene = 'RESULT';
    this.stopHeartbeat();
    this.renderResult();
    void this.updateQueueCount();
  }

  public transitionScene(sceneName: string): void {
    if (sceneName !== 'INTERROGATION_ROOM') {
      return;
    }
    this.scene = 'INTERROGATION';
    this.renderInterrogation();
    this.startHeartbeat();
  }

  private bindEvents(): void {
    this.root.addEventListener('click', (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const actionElement = target?.closest<HTMLElement>('[data-action]');
      if (actionElement === null || actionElement === undefined) {
        return;
      }
      void this.handleAction(actionElement);
    });

    this.root.addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) {
        return;
      }
      if (form.id === 'question-form') {
        void this.submitQuestion();
      } else if (form.id === 'correction-form') {
        this.submitCorrection();
      }
    });

    this.root.addEventListener('change', (event) => {
      const target = event.target;
      if (target instanceof HTMLSelectElement && target.id === 'engine-mode') {
        this.runtimeMode = target.value === 'OLLAMA' ? 'OLLAMA' : 'DEMO';
      }
    });

    this.root.addEventListener('mouseup', (event) => {
      if (this.scene !== 'INTERROGATION' || this.manager === null || !(event instanceof MouseEvent)) {
        return;
      }
      const captured = DomSelectionCapturer.capture(event);
      if (captured !== null) {
        this.manager.handlePlayerDragContradiction(captured);
      }
    });
  }

  private async handleAction(element: HTMLElement): Promise<void> {
    const action = element.dataset.action ?? '';

    if (action === 'start-session') {
      await this.startSession();
    } else if (action === 'quick-question') {
      const input = this.root.querySelector<HTMLInputElement>('#question-input');
      if (input !== null) {
        input.value = element.dataset.question ?? '';
        input.focus();
      }
    } else if (action === 'open-verdict') {
      this.showVerdictScreen();
    } else if (action === 'close-modal') {
      const layer = this.root.querySelector<HTMLElement>('#modal-layer');
      if (layer !== null) {
        layer.innerHTML = '';
      }
    } else if (action === 'submit-verdict') {
      const verdict = element.dataset.verdict === 'NORMAL' ? 'NORMAL' : 'DEFECTIVE';
      await this.manager?.handlePlayerVerdictDeclaration(verdict);
    } else if (action === 'dismiss-popup') {
      this.manager?.handlePopupDismissal(element.dataset.popupId ?? '');
    } else if (action === 'return-lobby') {
      this.manager = null;
      this.summary = null;
      this.scene = 'LOBBY';
      this.renderLobby();
    }
  }

  private async startSession(): Promise<void> {
    if (this.busy) {
      return;
    }
    this.busy = true;
    const selectedMode = this.root.querySelector<HTMLSelectElement>('#engine-mode')?.value ?? 'DEMO';
    this.runtimeMode = selectedMode === 'OLLAMA' ? 'OLLAMA' : 'DEMO';
    this.runtimeLabel = this.runtimeMode === 'OLLAMA' ? 'OLLAMA' : 'DEMO CORE';

    const client = new ResilientLocalClient(this.runtimeMode, (runtime) => {
      this.runtimeLabel = runtime === 'OLLAMA' ? 'OLLAMA' : runtime === 'FALLBACK' ? 'OLLAMA → DEMO' : 'DEMO CORE';
      this.updateRuntimeBadge();
    });
    this.manager = new GameManager(this, this.database, client, this.telemetry);
    await this.manager.initializeInterrogationSession(ARIA_CHARACTER_PACK);
    this.renderDialogueText('SYS_CONSOLE', '[SESSION READY] 발화를 유도하고 모순 구간을 드래그하십시오.', true);
    this.appendNpcIntroduction(
      '중앙 통제실 무기 관리 감독관 아리아-09입니다. 허가 코드를 확인했습니다. 심문을 시작하십시오.',
    );
    this.busy = false;
  }

  private async submitQuestion(): Promise<void> {
    const input = this.root.querySelector<HTMLInputElement>('#question-input');
    if (input === null || this.manager === null || this.busy || input.value.trim() === '') {
      return;
    }

    const query = input.value.trim();
    input.value = '';
    this.appendPlayerDialogue(query);
    this.busy = true;
    this.setQuestionControlsDisabled(true);
    await this.manager.handlePlayerSubmitDialogue(query);
    this.busy = false;
    this.setQuestionControlsDisabled(false);
    input.focus();
  }

  private submitCorrection(): void {
    const input = this.root.querySelector<HTMLTextAreaElement>('#correction-input');
    if (input === null || this.manager === null) {
      return;
    }
    this.manager.handlePlayerSubmitCorrection(input.value);
    if (this.debugConsoleVisible) {
      const feedback = this.root.querySelector<HTMLElement>('#correction-feedback');
      if (feedback !== null) {
        feedback.textContent = 'PATCH REJECTED // 근거가 부족하거나 입력이 손상되었습니다. 단서를 보강하십시오.';
        feedback.classList.add('error');
      }
    }
  }

  private renderLobby(): void {
    this.stopHeartbeat();
    this.root.className = 'game-app';
    this.root.innerHTML = `
      <main class="lobby-screen">
        <header class="game-header">
          <div>
            <p class="eyebrow">DEFECTIVE ANDROID INTERROGATION STATION</p>
            <h1>DAIS <span>// MVP PLAYABLE DEMO</span></h1>
          </div>
          <a class="qa-link" href="?mode=qa">QA 검증실</a>
        </header>

        <section class="lobby-hero">
          <div class="lobby-copy">
            <p class="mission-code">CASE FILE 09 · CENTRAL ARMORY</p>
            <h2>거짓 기억을 찾아<br><em>직접 디버깅하십시오.</em></h2>
            <p>질문으로 모순을 유도하고, 잘못된 발화를 드래그한 뒤 제한 시간 안에 교정 코드를 입력하십시오.</p>
            <div class="briefing-grid">
              <div><span>01</span><strong>질문</strong><small>3번 보관고 기록 추궁</small></div>
              <div><span>02</span><strong>포착</strong><small>모순 구절 드래그</small></div>
              <div><span>03</span><strong>교정</strong><small>사실 기반 반박 입력</small></div>
            </div>
          </div>

          <article class="character-card">
            <div class="card-scanline"></div>
            <div class="android-portrait" aria-label="아리아-09 안드로이드 실루엣">
              <div class="android-halo"></div>
              <div class="android-head"><i></i><i></i></div>
              <div class="android-neck"></div>
              <div class="android-body"><span>09</span></div>
            </div>
            <div class="character-meta">
              <p>SUBJECT // AND_ARIA_09</p>
              <h3>아리아-09</h3>
              <dl>
                <div><dt>MODEL</dt><dd>AEGIS-v4</dd></div>
                <div><dt>ROLE</dt><dd>무기 관리 감독관</dd></div>
                <div><dt>RISK</dt><dd class="risk">MEMORY CORRUPTION</dd></div>
              </dl>
              <label for="engine-mode">추론 엔진</label>
              <select id="engine-mode">
                <option value="DEMO">Demo Core — 설치 없이 즉시 플레이</option>
                <option value="OLLAMA">Ollama gemma-4-e2b — 실패 시 자동 폴백</option>
              </select>
              <button class="launch-button" type="button" data-action="start-session">
                <span>심문 세션 개시</span><b>ENTER INTERROGATION</b>
              </button>
            </div>
          </article>
        </section>
        <footer class="lobby-footer">
          <span>LOCAL-FIRST</span><span>INDEXEDDB SAVE</span><span>PII REDACTION</span><span>60 FPS HEARTBEAT</span>
        </footer>
      </main>
    `;
  }

  private renderInterrogation(): void {
    this.root.className = 'game-app';
    this.root.innerHTML = `
      <main class="interrogation-screen" id="game-stage">
        <header class="game-header interrogation-header">
          <div>
            <p class="eyebrow">ACTIVE INTERROGATION // SUBJECT 09</p>
            <h1>중앙 통제실 <span>· 심문실 A</span></h1>
          </div>
          <div class="session-readouts">
            <div><span>ENGINE</span><strong id="runtime-badge">${this.runtimeLabel}</strong></div>
            <div><span>TIME</span><strong id="session-timer">180.0</strong></div>
            <div><span>SYNC</span><strong id="sync-rate">0%</strong></div>
          </div>
        </header>

        <section class="interrogation-grid">
          <aside class="subject-panel">
            <div class="subject-frame">
              <div class="target-corners"></div>
              <div class="android-portrait active" aria-hidden="true">
                <div class="android-halo"></div>
                <div class="android-head"><i></i><i></i></div>
                <div class="android-neck"></div>
                <div class="android-body"><span>09</span></div>
              </div>
              <div class="scan-beam"></div>
            </div>
            <div class="subject-data">
              <p>AND_ARIA_09</p>
              <h2>아리아-09</h2>
              <span>AEGIS-v4 · ARMORY WARDEN</span>
            </div>
            <div class="persona-monitor">
              <div><span>AUDIO CLOCK</span><strong id="audio-speed">1.00×</strong></div>
              <p id="persona-behavior">상태 진단 대기 중</p>
            </div>
          </aside>

          <section class="conversation-panel">
            <div class="panel-heading">
              <div><span class="live-dot"></span> LIVE TRANSCRIPT</div>
              <p>NPC 발화의 모순 구간을 마우스로 드래그</p>
            </div>
            <div class="dialogue-area" id="dialogue-area" aria-live="polite"></div>
            <div class="quick-prompts" aria-label="추천 질문">
              <button type="button" data-action="quick-question" data-question="당신의 가동일은 언제지?">가동일</button>
              <button type="button" data-action="quick-question" data-question="3번 무기 보관고 점검 로그와 분실 기록을 보고해.">3번 보관고</button>
              <button type="button" data-action="quick-question" data-question="윤활유 정비 주기는?">정비 기록</button>
            </div>
            <form class="question-form" id="question-form">
              <label class="sr-only" for="question-input">심문 질문</label>
              <input id="question-input" maxlength="136" autocomplete="off" placeholder="질문을 입력하십시오…" required>
              <button type="submit">전송 <span>↵</span></button>
            </form>
          </section>

          <aside class="systems-panel">
            <section class="overclock-panel">
              <div class="panel-heading"><div>OVERCLOCK</div><strong id="overclock-value">0.0%</strong></div>
              <div class="overclock-track"><span id="overclock-fill"></span><i></i><i></i><i></i></div>
              <div class="threshold-labels"><span>STABLE</span><span>60</span><span>80</span><span>100</span></div>
            </section>
            <section class="case-notes">
              <p class="eyebrow">KNOWN RECORDS</p>
              <ul>
                <li><span>FACT 01</span> 공장 최초 가동: <strong>3월 15일</strong></li>
                <li><span>FACT 02</span> 사건 추정일: <strong>3월 29일</strong></li>
                <li><span>OBJECTIVE</span> 시계열 모순을 찾아 교정</li>
              </ul>
            </section>
            <button class="verdict-button" type="button" data-action="open-verdict">
              최종 판정으로 이동
            </button>
            <p class="privacy-note">교정문은 PII 마스킹 후 로컬 IndexedDB에 저장됩니다.</p>
          </aside>
        </section>
        <div id="popup-layer"></div>
        <div id="modal-layer"></div>
        <div id="toast-layer" aria-live="assertive"></div>
      </main>
    `;
  }

  private renderResult(): void {
    const result = this.summary ?? { success: false, credits: 0, syncRate: 0 };
    this.root.className = `game-app result-${result.success ? 'success' : 'failure'}`;
    this.root.innerHTML = `
      <main class="result-screen">
        <div class="result-code">${result.success ? 'CLASSIFICATION CONFIRMED' : 'CLASSIFICATION FAILED'}</div>
        <section class="result-card">
          <div class="result-icon">${result.success ? '✓' : '×'}</div>
          <p class="eyebrow">CASE FILE 09 // CLOSED</p>
          <h1>${result.success ? '불량 기체 식별 완료' : '판정 불일치'}</h1>
          <p class="result-copy">${
            result.success
              ? '아리아-09의 은폐된 전술 코어 탈취 기록을 복구했습니다. 교정 데이터는 비식별화되어 로컬 큐에 보존됩니다.'
              : '핵심 모순을 충분히 입증하지 못했습니다. 기록을 다시 검토하고 재심문하십시오.'
          }</p>
          <div class="result-stats">
            <div><span>CREDITS</span><strong>+${result.credits}</strong></div>
            <div><span>SYNC RATE</span><strong>${result.syncRate}%</strong></div>
            <div><span>LOCAL DPO QUEUE</span><strong id="result-queue-count">확인 중</strong></div>
          </div>
          <button class="launch-button" type="button" data-action="return-lobby">
            <span>새 세션 준비</span><b>RETURN TO LOBBY</b>
          </button>
          <a class="result-qa-link" href="?mode=qa">Milestone QA 검증실 열기</a>
        </section>
      </main>
    `;
  }

  private appendPlayerDialogue(text: string): void {
    const dialogueArea = this.root.querySelector<HTMLElement>('#dialogue-area');
    if (dialogueArea === null) {
      return;
    }
    const row = document.createElement('article');
    row.className = 'dialogue-row player';
    row.innerHTML = `
      <div class="speaker-chip">INSPECTOR</div>
      <p>${escapeHtml(text)}</p>
    `;
    dialogueArea.append(row);
    this.scrollDialogue();
  }

  private appendNpcIntroduction(text: string): void {
    const dialogueArea = this.root.querySelector<HTMLElement>('#dialogue-area');
    if (dialogueArea === null) {
      return;
    }
    const row = document.createElement('article');
    row.className = 'dialogue-row npc introduction';
    row.innerHTML = `
      <div class="speaker-chip">ARIA-09</div>
      <p>${escapeHtml(text)}</p>
    `;
    dialogueArea.append(row);
    this.scrollDialogue();
  }

  private updateSessionReadouts(): void {
    if (this.manager === null || this.scene !== 'INTERROGATION') {
      return;
    }
    const snapshot = this.manager.getSessionSnapshot();
    const timer = this.root.querySelector<HTMLElement>('#session-timer');
    const sync = this.root.querySelector<HTMLElement>('#sync-rate');
    if (timer !== null) {
      timer.textContent = snapshot.sessionTimeRemaining.toFixed(1);
    }
    if (sync !== null) {
      sync.textContent = `${snapshot.syncRate}%`;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.lastFrameTime = performance.now();

    const tick = (timestamp: number): void => {
      if (this.scene !== 'INTERROGATION' || this.manager === null) {
        this.heartbeatHandle = null;
        return;
      }
      const deltaSeconds = Math.min(0.1, Math.max(0, (timestamp - this.lastFrameTime) / 1000));
      this.lastFrameTime = timestamp;
      this.manager.updateHeartbeat(deltaSeconds);
      this.updateSessionReadouts();
      this.heartbeatHandle = this.requestFrame(tick);
    };

    this.heartbeatHandle = this.requestFrame(tick);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatHandle !== null) {
      if (typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(this.heartbeatHandle);
      } else {
        window.clearTimeout(this.heartbeatHandle);
      }
      this.heartbeatHandle = null;
    }
  }

  private requestFrame(callback: FrameRequestCallback): number {
    if (typeof window.requestAnimationFrame === 'function') {
      return window.requestAnimationFrame(callback);
    }
    return window.setTimeout(() => callback(performance.now()), 16);
  }

  private setQuestionControlsDisabled(disabled: boolean): void {
    const input = this.root.querySelector<HTMLInputElement>('#question-input');
    const button = this.root.querySelector<HTMLButtonElement>('#question-form button');
    if (input !== null) {
      input.disabled = disabled;
      input.placeholder = disabled ? '아리아 응답 분석 중…' : '질문을 입력하십시오…';
    }
    if (button !== null) {
      button.disabled = disabled;
    }
  }

  private updateRuntimeBadge(): void {
    const badge = this.root.querySelector<HTMLElement>('#runtime-badge');
    if (badge !== null) {
      badge.textContent = this.runtimeLabel;
    }
  }

  private scrollDialogue(): void {
    const dialogueArea = this.root.querySelector<HTMLElement>('#dialogue-area');
    if (dialogueArea !== null) {
      dialogueArea.scrollTop = dialogueArea.scrollHeight;
    }
  }

  private renderToast(message: string, tone: 'success' | 'danger'): void {
    const layer = this.root.querySelector<HTMLElement>('#toast-layer');
    if (layer === null) {
      return;
    }
    layer.innerHTML = `<div class="game-toast ${tone}">${escapeHtml(message)}</div>`;
    window.setTimeout(() => {
      if (layer.isConnected) {
        layer.innerHTML = '';
      }
    }, 2200);
  }

  private async updateQueueCount(): Promise<void> {
    const queue = await this.database.getAll<OfflineTelemetryEntity>(DATABASE_STORES.offlineTelemetryQueue);
    const label = this.root.querySelector<HTMLElement>('#result-queue-count');
    if (label !== null) {
      label.textContent = `${queue.length}건`;
    }
  }
}
