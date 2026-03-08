declare module "@anthropic-ai/claude-agent-sdk" {
  export function query(options: {
    prompt: string;
    options?: Record<string, unknown>;
  }): AsyncIterable<{
    type: string;
    [key: string]: unknown;
  }>;
}
