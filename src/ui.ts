import pc from "picocolors";
import * as readline from "node:readline";
import { pickSessionBackground, applyBackground, restoreBackground, type SessionBackground } from "./terminal-colors.js";

interface TerminalUIOptions {
  userName: string;
  role: "host" | "guest";
}

export class TerminalUI {
  private options: TerminalUIOptions;
  private inputHandler?: (text: string) => void;
  private approvalHandler?: (promptId: string, approved: boolean) => void;
  private rl?: readline.Interface;
  private background?: SessionBackground;

  constructor(options: TerminalUIOptions) {
    this.options = options;
  }

  private sessionText(text: string): string {
    return this.background ? pc.white(text) : pc.dim(text);
  }

  private showInputPrompt(): void {
    if (this.background) {
      process.stdout.write(pc.gray("⟩ "));
    }
  }

  startInputLoop(): void {
    if (this.rl) return;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: "",
    });
    this.rl.on("line", (line) => {
      const trimmed = line.trim();
      if (trimmed && this.inputHandler) {
        this.inputHandler(trimmed);
      }
      this.showInputPrompt();
    });
    this.showInputPrompt();
  }

  simulateInput(text: string): void {
    if (this.inputHandler) this.inputHandler(text);
  }

  simulateApproval(promptId: string, approved: boolean): void {
    if (this.approvalHandler) this.approvalHandler(promptId, approved);
  }

  applySessionBackground(): void {
    if (this.background) return; // Already applied
    this.background = pickSessionBackground();
    process.stdout.write("\x1b[2J\x1b[H"); // Clear screen + cursor to top
    process.stdout.write(applyBackground(this.background));
  }

  showWelcome(sessionCode: string, password: string, connectUrl?: string): void {
    this.applySessionBackground();

    const violet = (s: string) => pc.magenta(s);
    const dim = (s: string) => this.sessionText(s);
    const bar = violet("  │");

    console.log("");
    console.log(violet("  ┌─────────────────────────────────────────────┐"));
    console.log(`${bar}  ${pc.bold(pc.cyan("✦"))} ${pc.bold(pc.white("claude-duet"))} ${dim("session started")}${" ".repeat(13)}${violet("│")}`);
    console.log(violet("  └─────────────────────────────────────────────┘"));
    console.log("");

    if (connectUrl) {
      const joinCmd = `npx claude-duet join ${sessionCode} --password ${password} --url ${connectUrl}`;
      console.log(`  ${dim("Send your partner this command to join:")}`);
      console.log("");
      console.log(`  ${pc.green("▶")} ${pc.bold(pc.green(joinCmd))}`);
    } else {
      console.log(`  ${pc.cyan("●")} Session code  ${pc.bold(pc.white(sessionCode))}`);
      console.log(`  ${pc.cyan("●")} Password      ${pc.bold(pc.white(password))}`);
      console.log("");
      console.log(`  ${dim("Share these with your partner to join.")}`);
    }

    console.log("");
    console.log(dim("  ─────────────────────────────────────────────"));
    console.log("");
    this.showInputPrompt();
  }

  showSystem(message: string): void {
    console.log(this.sessionText(`  ${message}`));
  }

  showError(message: string): void {
    console.error(pc.red(`  Error: ${message}`));
  }

  showUserPrompt(user: string, text: string, isHost: boolean, mode: "chat" | "claude" = "chat"): void {
    const label = isHost ? `${user} (host)` : user;
    const labelColor = isHost ? pc.cyan : pc.magenta;
    if (mode === "claude") {
      console.log(`\n${pc.bold(labelColor(`[${label}]`))} ${pc.dim("\u2192 \u2726 Claude:")}`);
    } else {
      console.log(`\n${pc.bold(labelColor(`[${label}]:`))}`)
    }
    console.log(`  ${this.background ? pc.white(text) : text}`);
  }

  showClaudeThinking(): void {
    console.log(this.sessionText("  \u2726 Claude is thinking..."));
  }

  showApprovalStatus(status: "pending" | "approved" | "rejected"): void {
    switch (status) {
      case "pending":
        console.log(this.sessionText("  \u23f3 Waiting for host to approve..."));
        break;
      case "approved":
        console.log(pc.green("  \u2705 Approved \u2014 Claude is working..."));
        break;
      case "rejected":
        console.log(pc.red("  \u274c Host rejected your prompt"));
        break;
    }
  }

  showHint(text: string): void {
    console.log(pc.gray(pc.italic(`  ${text}`)));
  }

  showSessionSummary(summary: { duration: string; messageCount: number; cost?: number }): void {
    console.log("");
    console.log(pc.bold("  \u2726 Session ended"));
    console.log(this.sessionText(`  Duration: ${summary.duration}`));
    console.log(this.sessionText(`  Messages: ${summary.messageCount}`));
    if (summary.cost !== undefined && summary.cost > 0) {
      console.log(this.sessionText(`  Cost: $${summary.cost.toFixed(4)}`));
    }
    console.log("");
  }

  showStreamChunk(text: string): void {
    process.stdout.write(text);
  }

  showToolUse(tool: string, _input: Record<string, unknown>): void {
    console.log(this.sessionText(`  [tool] ${tool}`));
  }

  showToolResult(tool: string, output: string): void {
    console.log(this.sessionText(`  [result] ${tool}: ${output.slice(0, 100)}`));
  }

  showTurnComplete(cost: number, durationMs: number): void {
    console.log(this.sessionText(`\n  Turn complete: $${cost.toFixed(4)}, ${(durationMs / 1000).toFixed(1)}s`));
  }

  showPartnerJoined(user: string): void {
    console.log(pc.green(`\n  \u2726 ${user} joined the session`));
  }

  showPartnerLeft(user: string): void {
    console.log(pc.yellow(`\n  \u2726 ${user} left the session`));
  }

  showApprovalRequest(promptId: string, user: string, text: string): void {
    console.log("");
    console.log(pc.yellow(`  \u250c\u2500 ${user} \u2192 Claude ${"─".repeat(Math.max(0, 35 - user.length))}\u2510`));
    console.log(pc.yellow(`  \u2502  "${text.length > 40 ? text.slice(0, 37) + "..." : text}"${" ".repeat(Math.max(0, 40 - Math.min(text.length, 40)))}\u2502`));
    console.log(pc.yellow(`  \u2502  ${pc.bold("[y]")} approve  ${pc.bold("[n]")} reject${" ".repeat(22)}\u2502`));
    console.log(pc.yellow(`  \u2514${"─".repeat(44)}\u2518`));

    // Temporarily switch to raw mode for single keypress
    if (process.stdin.isTTY) {
      this.rl?.pause();
      process.stdin.setRawMode(true);
      process.stdin.resume();

      const handler = (data: Buffer) => {
        const key = data.toString().toLowerCase();
        process.stdin.setRawMode(false);
        process.stdin.removeListener("data", handler);
        this.rl?.resume();

        if (key === "y") {
          console.log(pc.green("  \u2705 Approved"));
          if (this.approvalHandler) this.approvalHandler(promptId, true);
        } else {
          console.log(pc.red("  \u274c Rejected"));
          if (this.approvalHandler) this.approvalHandler(promptId, false);
        }
      };
      process.stdin.on("data", handler);
    } else {
      // Non-TTY (e.g., piped input from test script) — auto-approve
      if (this.approvalHandler) this.approvalHandler(promptId, true);
    }
  }

  onInput(handler: (text: string) => void): void {
    this.inputHandler = handler;
  }

  onApproval(handler: (promptId: string, approved: boolean) => void): void {
    this.approvalHandler = handler;
  }

  close(): void {
    this.rl?.close();
    this.rl = undefined;
    if (this.background) {
      process.stdout.write(restoreBackground());
      this.background = undefined;
    }
  }
}
