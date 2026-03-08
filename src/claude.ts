import { EventEmitter } from "node:events";

export type ClaudeEvent =
  | { type: "stream_chunk"; text: string }
  | { type: "tool_use"; tool: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool: string; output: string }
  | { type: "turn_complete"; cost: number; durationMs: number }
  | { type: "notice"; message: string }
  | { type: "error"; message: string };

interface FormatOptions {
  isHost?: boolean;
}

export class ClaudeBridge extends EventEmitter {
  private sessionId?: string;
  private isRunning = false;
  private sdkWarningShown = false;

  formatPrompt(user: string, text: string, options?: FormatOptions): string {
    const label = options?.isHost ? `${user} (host)` : user;
    return `[${label}]: ${text}`;
  }

  async sendPrompt(user: string, text: string, options?: FormatOptions): Promise<void> {
    if (this.isRunning) {
      throw new Error("Claude is already processing a prompt");
    }
    this.isRunning = true;
    const formattedPrompt = this.formatPrompt(user, text, options);

    try {
      // Dynamic import to allow mocking and to avoid hard failure
      // if the SDK is not installed
      const { query } = await import("@anthropic-ai/claude-agent-sdk");

      for await (const message of query({
        prompt: formattedPrompt,
        options: {
          includePartialMessages: true,
          ...(this.sessionId ? { resume: this.sessionId } : {}),
        },
      })) {
        if (message.type === "system" && "session_id" in message) {
          this.sessionId = message.session_id as string;
        }

        if (message.type === "stream_event") {
          const event = (message as any).event;
          if (event?.type === "content_block_delta" && event.delta?.type === "text_delta") {
            this.emit("event", { type: "stream_chunk", text: event.delta.text } satisfies ClaudeEvent);
          }
        }

        if (message.type === "tool_use" || (message as any).tool) {
          this.emit("event", {
            type: "tool_use",
            tool: (message as any).tool || "unknown",
            input: (message as any).input || {},
          } satisfies ClaudeEvent);
        }

        if (message.type === "result") {
          this.emit("event", {
            type: "turn_complete",
            cost: (message as any).cost || 0,
            durationMs: (message as any).duration_ms || 0,
          } satisfies ClaudeEvent);
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const isSdkMissing =
        errMsg.includes("Cannot find package") || errMsg.includes("Cannot find module");

      if (isSdkMissing) {
        if (!this.sdkWarningShown) {
          this.sdkWarningShown = true;
          this.emit("event", {
            type: "notice",
            message: "Claude Agent SDK not available \u2014 prompts will be echoed but not sent to Claude.",
          } satisfies ClaudeEvent);
        }
        // Silently skip on subsequent attempts
      } else {
        this.emit("event", {
          type: "error",
          message: errMsg,
        } satisfies ClaudeEvent);
      }
    } finally {
      this.isRunning = false;
    }
  }

  getSessionId(): string | undefined {
    return this.sessionId;
  }

  isBusy(): boolean {
    return this.isRunning;
  }
}
