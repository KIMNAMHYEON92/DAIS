import type { CapturedDragData } from '@app-types/parser';

const NPC_BUBBLE_SELECTOR = '.npc-bubble';
const DIALOGUE_ID_ATTRIBUTE = 'data-dialogue-id';

export class DomSelectionCapturer {
  public static capture(mouseEvent: MouseEvent): CapturedDragData | null {
    const targetElement = mouseEvent.target instanceof Element ? mouseEvent.target : null;
    const bubbleElement = targetElement?.closest<HTMLElement>(NPC_BUBBLE_SELECTOR) ?? null;

    if (bubbleElement === null) {
      return null;
    }

    const dialogueId = bubbleElement.getAttribute(DIALOGUE_ID_ATTRIBUTE);
    if (dialogueId === null || dialogueId.trim() === '') {
      return null;
    }

    const selection = window.getSelection();
    if (selection === null || selection.rangeCount === 0) {
      return null;
    }

    const range = selection.getRangeAt(0);
    if (
      range.collapsed ||
      !bubbleElement.contains(range.startContainer) ||
      !bubbleElement.contains(range.endContainer)
    ) {
      return null;
    }

    const selectedText = range.toString();
    if (selectedText.trim() === '') {
      return null;
    }

    const precedingContent = range.cloneRange();
    precedingContent.selectNodeContents(bubbleElement);
    precedingContent.setEnd(range.startContainer, range.startOffset);

    const startOffset = precedingContent.toString().length;

    return {
      dialogueId,
      selectedText,
      startOffset,
      endOffset: startOffset + selectedText.length,
    };
  }
}
