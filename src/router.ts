import type { ClaudeBridge } from "./claude.js";
import type { ClaudeDuetServer } from "./server.js";
import type { PromptMessage, ServerMessage } from "./protocol.js";

interface RouterOptions {
  hostUser: string;
  approvalMode: boolean;
}

interface PendingPrompt {
  msg: PromptMessage;
  timestamp: number;
}

export class PromptRouter {
  private pending = new Map<string, PendingPrompt>();
  private claude: ClaudeBridge;
  private server: ClaudeDuetServer;
  private options: RouterOptions;

  constructor(claude: ClaudeBridge, server: ClaudeDuetServer, options: RouterOptions) {
    this.claude = claude;
    this.server = server;
    this.options = options;
  }

  async handlePrompt(msg: PromptMessage): Promise<void> {
    const isHost = msg.user === this.options.hostUser;

    // Broadcast that prompt was received
    this.server.broadcast({
      type: "prompt_received",
      promptId: msg.id,
      user: msg.user,
      text: msg.text,
      timestamp: Date.now(),
    });

    if (isHost || !this.options.approvalMode) {
      await this.executePrompt(msg, isHost);
      return;
    }

    // Queue for approval
    this.pending.set(msg.id, { msg, timestamp: Date.now() });
    this.server.broadcast({
      type: "approval_request",
      promptId: msg.id,
      user: msg.user,
      text: msg.text,
      timestamp: Date.now(),
    });
    this.server.broadcast({
      type: "approval_status",
      promptId: msg.id,
      status: "pending",
      timestamp: Date.now(),
    } as any);
  }

  async handleApproval(response: { promptId: string; approved: boolean }): Promise<void> {
    const pending = this.pending.get(response.promptId);
    if (!pending) return;

    this.pending.delete(response.promptId);

    this.server.broadcast({
      type: "approval_status",
      promptId: response.promptId,
      status: response.approved ? "approved" : "rejected",
      timestamp: Date.now(),
    } as any);

    if (response.approved) {
      await this.executePrompt(pending.msg, false);
    }
    // If rejected, just discard silently
  }

  private async executePrompt(msg: PromptMessage, isHost: boolean): Promise<void> {
    await this.claude.sendPrompt(msg.user, msg.text, { isHost });
  }

  setApprovalMode(enabled: boolean): void {
    this.options.approvalMode = enabled;
  }
}
