export interface ParsedAgentSegment {
  agentId: string;
  content: string;
  isComplete: boolean;
}

const CLOSE_TAG = '</agent>';
const FALLBACK_AGENT_ID = 'SYS_CONSOLE';

/**
 * Incrementally parses agent-tagged output. Incomplete results are cumulative
 * snapshots of the active segment so a view can replace its current text
 * without having to reassemble token deltas.
 */
export class StreamingMarkupParser {
  private buffer = '';
  private activeAgent = '';
  private currentContent = '';

  public write(chunk: string): ParsedAgentSegment[] {
    if (chunk.length === 0) {
      return [];
    }

    this.buffer += chunk;
    const segments: ParsedAgentSegment[] = [];

    while (this.buffer.length > 0) {
      if (this.activeAgent !== '') {
        if (!this.consumeActiveAgent(segments)) {
          break;
        }
        continue;
      }

      const openingTag = this.buffer.match(/^<agent id="([^"]+)">/);
      if (openingTag !== null) {
        this.activeAgent = openingTag[1];
        this.currentContent = '';
        this.buffer = this.buffer.slice(openingTag[0].length);
        continue;
      }

      if (this.buffer.startsWith('<') && !this.buffer.includes('>')) {
        break;
      }

      const nextTagIndex = this.buffer.indexOf('<');
      if (nextTagIndex !== 0) {
        const endIndex = nextTagIndex === -1 ? this.buffer.length : nextTagIndex;
        const content = this.buffer.slice(0, endIndex);
        this.buffer = this.buffer.slice(endIndex);
        segments.push({
          agentId: FALLBACK_AGENT_ID,
          content,
          isComplete: false,
        });
        continue;
      }

      const malformedTagEnd = this.buffer.indexOf('>');
      const endIndex = malformedTagEnd === -1 ? this.buffer.length : malformedTagEnd + 1;
      const content = this.buffer.slice(0, endIndex);
      this.buffer = this.buffer.slice(endIndex);
      segments.push({
        agentId: FALLBACK_AGENT_ID,
        content,
        isComplete: false,
      });
    }

    return segments;
  }

  public flush(): ParsedAgentSegment[] {
    const segments: ParsedAgentSegment[] = [];

    if (this.activeAgent !== '') {
      const trailingClosePrefixLength = this.getTrailingClosePrefixLength(this.buffer);
      this.currentContent += this.buffer.slice(0, this.buffer.length - trailingClosePrefixLength);
      segments.push({
        agentId: this.activeAgent,
        content: this.currentContent,
        isComplete: true,
      });
    } else if (this.buffer.length > 0) {
      segments.push({
        agentId: FALLBACK_AGENT_ID,
        content: this.buffer,
        isComplete: true,
      });
    }

    this.reset();
    return segments;
  }

  private consumeActiveAgent(segments: ParsedAgentSegment[]): boolean {
    const closingTagIndex = this.buffer.indexOf(CLOSE_TAG);

    if (closingTagIndex !== -1) {
      this.currentContent += this.buffer.slice(0, closingTagIndex);
      segments.push({
        agentId: this.activeAgent,
        content: this.currentContent,
        isComplete: true,
      });
      this.buffer = this.buffer.slice(closingTagIndex + CLOSE_TAG.length);
      this.activeAgent = '';
      this.currentContent = '';
      return true;
    }

    const trailingClosePrefixLength = this.getTrailingClosePrefixLength(this.buffer);
    const consumableLength = this.buffer.length - trailingClosePrefixLength;

    if (consumableLength === 0) {
      return false;
    }

    this.currentContent += this.buffer.slice(0, consumableLength);
    this.buffer = this.buffer.slice(consumableLength);
    segments.push({
      agentId: this.activeAgent,
      content: this.currentContent,
      isComplete: false,
    });
    return false;
  }

  private getTrailingClosePrefixLength(value: string): number {
    const maximumLength = Math.min(value.length, CLOSE_TAG.length - 1);

    for (let length = maximumLength; length > 0; length -= 1) {
      if (value.endsWith(CLOSE_TAG.slice(0, length))) {
        return length;
      }
    }

    return 0;
  }

  private reset(): void {
    this.buffer = '';
    this.activeAgent = '';
    this.currentContent = '';
  }
}
