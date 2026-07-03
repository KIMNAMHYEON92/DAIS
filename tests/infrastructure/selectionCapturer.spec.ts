import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DomSelectionCapturer } from '@infrastructure/dom/selectionCapturer';
import type { CapturedDragData } from '@app-types/parser';

const dispatchMouseUp = (target: Element): CapturedDragData | null => {
  let captured: CapturedDragData | null = null;
  target.addEventListener(
    'mouseup',
    (event) => {
      if (!(event instanceof MouseEvent)) {
        return;
      }
      captured = DomSelectionCapturer.capture(event);
    },
    { once: true },
  );
  target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  return captured;
};

describe('[Milestone 4] DOM Selection Capturer Tests', () => {
  const mockedGetSelection = window.getSelection;

  beforeEach(() => {
    window.getSelection = (): Selection | null => document.getSelection();
  });

  afterEach(() => {
    window.getSelection()?.removeAllRanges();
    document.body.replaceChildren();
  });

  afterAll(() => {
    window.getSelection = mockedGetSelection;
  });

  it('captures offsets relative to the whole bubble across nested text nodes', () => {
    const bubble = document.createElement('div');
    bubble.className = 'npc-bubble';
    bubble.dataset.dialogueId = 'DLG_ARIA_004';
    bubble.append('보고: ');
    const emphasis = document.createElement('strong');
    emphasis.textContent = '3월 10일';
    bubble.append(emphasis, '부터 폐쇄');
    document.body.append(bubble);

    const range = document.createRange();
    const selectedNode = emphasis.firstChild;
    if (selectedNode === null) {
      throw new Error('test fixture is missing');
    }
    range.setStart(selectedNode, 0);
    range.setEnd(selectedNode, selectedNode.textContent?.length ?? 0);
    window.getSelection()?.addRange(range);

    expect(dispatchMouseUp(emphasis)).toEqual({
      dialogueId: 'DLG_ARIA_004',
      selectedText: '3월 10일',
      startOffset: 4,
      endOffset: 10,
    });
  });

  it('rejects whitespace-only selections', () => {
    const bubble = document.createElement('div');
    bubble.className = 'npc-bubble';
    bubble.dataset.dialogueId = 'DLG_ARIA_004';
    bubble.textContent = '   ';
    document.body.append(bubble);

    const range = document.createRange();
    const textNode = bubble.firstChild;
    if (textNode === null) {
      throw new Error('test fixture is missing');
    }
    range.selectNodeContents(textNode);
    window.getSelection()?.addRange(range);

    expect(dispatchMouseUp(bubble)).toBeNull();
  });

  it('rejects selections from non-NPC bubbles', () => {
    const playerBubble = document.createElement('div');
    playerBubble.className = 'player-bubble';
    playerBubble.dataset.dialogueId = 'DLG_USER_001';
    playerBubble.textContent = '3월 10일';
    document.body.append(playerBubble);

    const range = document.createRange();
    range.selectNodeContents(playerBubble);
    window.getSelection()?.addRange(range);

    expect(dispatchMouseUp(playerBubble)).toBeNull();
  });

  it('rejects a selection that crosses the NPC bubble boundary', () => {
    const outside = document.createTextNode('외부 문장');
    const bubble = document.createElement('div');
    bubble.className = 'npc-bubble';
    bubble.dataset.dialogueId = 'DLG_ARIA_004';
    bubble.textContent = '3월 10일';
    document.body.append(outside, bubble);

    const bubbleText = bubble.firstChild;
    if (bubbleText === null) {
      throw new Error('test fixture is missing');
    }
    const range = document.createRange();
    range.setStart(outside, 0);
    range.setEnd(bubbleText, bubbleText.textContent?.length ?? 0);
    window.getSelection()?.addRange(range);

    expect(dispatchMouseUp(bubble)).toBeNull();
  });
});
