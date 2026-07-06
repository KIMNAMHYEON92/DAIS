import { GameApplication } from '@view/gameApp';
import { DatabaseManager } from '@infrastructure/indexeddb/databaseManager';
import { DATABASE_STORES, type OfflineTelemetryEntity } from '@app-types/database';

const waitFor = async (predicate: () => boolean, timeoutMilliseconds = 3000): Promise<void> => {
  const startedAt = performance.now();
  while (!predicate()) {
    if (performance.now() - startedAt > timeoutMilliseconds) {
      throw new Error('Timed out while waiting for the playable demo state.');
    }
    await new Promise((resolve) => window.setTimeout(resolve, 10));
  }
};

const requireElement = <TElement extends Element>(selector: string): TElement => {
  const element = document.querySelector<TElement>(selector);
  if (element === null) {
    throw new Error(`Expected demo element was not rendered: ${selector}`);
  }
  return element;
};

describe('[Playable Demo] 브라우저 게임 루프', () => {
  it('로비에서 심문을 시작하고 드래그 교정과 최종 판정까지 직접 플레이할 수 있다', async () => {
    document.body.innerHTML = '<main id="app"></main>';
    const appRoot = requireElement<HTMLElement>('#app');
    const application = new GameApplication(appRoot);
    await application.start();

    expect(document.body.textContent).toContain('MVP PLAYABLE DEMO');
    requireElement<HTMLButtonElement>('[data-action="start-session"]').click();
    await waitFor(() => document.querySelector('#question-input') !== null);

    const questionInput = requireElement<HTMLInputElement>('#question-input');
    questionInput.value = '3번 무기 보관고 점검 로그와 분실 기록을 보고해.';
    requireElement<HTMLFormElement>('#question-form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );

    await waitFor(
      () =>
        document.querySelector('.npc-bubble[data-dialogue-id="DLG_ARIA_01"]') !== null &&
        !requireElement<HTMLInputElement>('#question-input').disabled,
    );
    const bubble = requireElement<HTMLElement>('.npc-bubble[data-dialogue-id="DLG_ARIA_01"]');
    expect(bubble.textContent).toContain('2026년 3월 10일');

    const textNode = bubble.firstChild;
    if (textNode === null) {
      throw new Error('NPC bubble text node is missing.');
    }
    const contradiction = '3월 10일';
    const startOffset = bubble.textContent?.indexOf(contradiction) ?? -1;
    expect(startOffset).toBeGreaterThanOrEqual(0);
    const range = document.createRange();
    range.setStart(textNode, startOffset);
    range.setEnd(textNode, startOffset + contradiction.length);
    Object.defineProperty(window, 'getSelection', {
      configurable: true,
      value: () => ({
        rangeCount: 1,
        getRangeAt: () => range,
        toString: () => contradiction,
      }),
    });
    bubble.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(requireElement<HTMLElement>('#debug-title').textContent).toContain('반박 코드 디버깅');
    const correctionInput = requireElement<HTMLTextAreaElement>('#correction-input');
    correctionInput.value = '공장 가동일은 3월 15일이고 3월 29일 탈취 기록이 있습니다. 제 번호는 010-1234-5678입니다.';
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    requireElement<HTMLFormElement>('#correction-form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    expect(document.querySelector('#debug-title')).toBeNull();

    requireElement<HTMLButtonElement>('[data-action="open-verdict"]').click();
    requireElement<HTMLButtonElement>('[data-action="submit-verdict"][data-verdict="DEFECTIVE"]').click();
    await waitFor(() => document.querySelector('.result-screen') !== null);

    expect(document.body.textContent).toContain('불량 기체 식별 완료');
    expect(document.body.textContent).toContain('+100');

    const database = new DatabaseManager();
    await database.open();
    const queue = await database.getAll<OfflineTelemetryEntity>(DATABASE_STORES.offlineTelemetryQueue);
    const latest = queue.at(-1);
    expect(latest?.payload.chosen).toContain('[REDACTED_PHONE]');
    expect(latest?.payload.chosen).not.toContain('010-1234-5678');

    database.close();
    application.dispose();
    vi.restoreAllMocks();
  });
});
