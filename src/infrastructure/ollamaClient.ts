export interface OllamaStreamingOptions {
  model: string;
  prompt: string;
  system?: string;
  onToken: (token: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

export interface LocalStreamingClient {
  streamChat(options: OllamaStreamingOptions): Promise<void>;
}

interface OllamaGenerateChunk {
  response?: unknown;
  error?: unknown;
}

export class OllamaLocalClient implements LocalStreamingClient {
  private readonly baseUrl = 'http://localhost:11434';

  public async streamChat(options: OllamaStreamingOptions): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model,
          prompt: options.prompt,
          system: options.system,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API responded with HTTP status ${response.status}`);
      }

      const reader = response.body?.getReader();

      if (reader === undefined) {
        throw new Error('Response body reader could not be generated.');
      }

      const decoder = new TextDecoder();
      let fullText = '';
      let pendingLine = '';
      let streamFinished = false;

      while (!streamFinished) {
        const { done, value } = await reader.read();
        streamFinished = done;
        pendingLine += decoder.decode(value, { stream: !done });

        const lines = pendingLine.split('\n');
        pendingLine = done ? '' : (lines.pop() ?? '');

        for (const line of lines) {
          fullText += this.consumeLine(line, options.onToken);
        }

        if (done) {
          if (pendingLine.trim() !== '') {
            fullText += this.consumeLine(pendingLine, options.onToken);
          }
        }
      }

      options.onComplete(fullText);
    } catch (error) {
      options.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private consumeLine(line: string, onToken: (token: string) => void): string {
    if (line.trim() === '') {
      return '';
    }

    let chunk: OllamaGenerateChunk;

    try {
      chunk = JSON.parse(line) as OllamaGenerateChunk;
    } catch {
      throw new Error('Ollama API returned an invalid JSON stream.');
    }

    if (typeof chunk.error === 'string') {
      throw new Error(`Ollama API stream error: ${chunk.error}`);
    }

    if (typeof chunk.response !== 'string' || chunk.response === '') {
      return '';
    }

    onToken(chunk.response);
    return chunk.response;
  }
}
