import type { DialogueTurn } from '@app-types/memory';
import type { SummarizerClientInterface } from '@core/memory/memoryPipeline';

interface OllamaSummaryResponse {
  response?: unknown;
}

const SUMMARIZER_SYSTEM_INSTRUCTION = `[CONCISE SUMMARIZATION SYSTEM]

Analyze the conversation history below and summarize it in Korean in under 100 characters.

Focus strictly on: "What information did the player learn?" and "How did the android react?"

Do not include greetings or redundant pleasantries.`;

export class OllamaSummarizerClient implements SummarizerClientInterface {
  private readonly endpoint = 'http://localhost:11434/api/generate';
  private readonly modelName = 'gemma-4-e2b';

  public async requestSummary(rawTurns: DialogueTurn[]): Promise<string> {
    const formattedTurns = rawTurns.map((turn) => `Q: ${turn.userQuery}\nA: ${turn.assistantResponse}`).join('\n');

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.modelName,
          prompt: `[CONVERSATION HISTORY TO SUMMARIZE]\n${formattedTurns}\n[SUMMARY RESULT OUTPUT]`,
          system: SUMMARIZER_SYSTEM_INSTRUCTION,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama summarizer HTTP error: ${response.status}`);
      }

      const payload = (await response.json()) as OllamaSummaryResponse;

      if (typeof payload.response !== 'string' || payload.response.trim() === '') {
        throw new Error('Ollama summarizer returned an empty response.');
      }

      return payload.response.trim();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`[OLLAMA_SUMMARIZE_FAILED] Exception: ${message}`);
    }
  }
}
