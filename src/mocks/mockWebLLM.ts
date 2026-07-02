import { vi } from 'vitest';

interface MockChatRequest {
  readonly messages: readonly { readonly content: string }[];
}

vi.mock('@mlc-ai/web-llm', () => ({
  CreateEngine: vi.fn().mockImplementation(async () => ({
    reload: vi.fn().mockResolvedValue(true),
    chat: {
      completions: {
        create: vi.fn().mockImplementation(async function* (request: MockChatRequest) {
          const latestMessage = request.messages.at(-1);
          const dummyReply = `[MOCK_STREAMING] 응답: ${latestMessage?.content ?? ''}`;

          for (const char of dummyReply) {
            yield { choices: [{ delta: { content: char } }] };
          }
        }),
      },
    },
  })),
}));
