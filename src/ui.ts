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
    });
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
    process.stdout.write(applyBackground(this.background));
  }

  showWelcome(sessionCode: string, password: string, connectUrl?: string): void {
    this.applySessionBackground();
    console.log("");
    console.log(pc.bold(pc.cyan("  \u2726 claude-duet session started")));
    console.log(`  Session code: ${pc.bold(sessionCode)}`);
    console.log(`  Password: ${pc.bold(password)}`);
    if (connectUrl) {
      console.log(`  Connect URL: ${pc.bold(connectUrl)}`);
      console.log("");
      console.log(pc.bold("  Share this command with your partner:"));
      console.log("");
      const joinCmd = `npx claude-duet join ${sessionCode} --password ${password} --url ${connectUrl}`;
      console.log(`  ${pc.green(pc.bold(joinCmd))}`);
      console.log("");
      console.log(pc.dim("  Slack-friendly message (copy & share):"));
      console.log(pc.dim(`  Hey! Join my claude-duet session: \`${joinCmd}\``));
    } else {
      console.log(`  Share these with your partner to join.`);
    }
    console.log("");
  }

  showSystem(message: string): void {
    console.log(pc.dim(`  ${message}`));
  }

  showError(message: string): void {
    console.error(pc.red(`  Error: ${message}`));
  }

  showUserPrompt(user: string, text: string, isHost: boolean): void {
    const color = isHost ? pc.blue : pc.magenta;
    const label = isHost ? `${user} (host)` : user;
    console.log(`\n${color(pc.bold(`[${label}]:`))}\n  ${text}`);
  }

  showStreamChunk(text: string): void {
    process.stdout.write(text);
  }

  showToolUse(tool: string, _input: Record<string, unknown>): void {
    console.log(pc.dim(`  [tool] ${tool}`));
  }

  showToolResult(tool: string, output: string): void {
    console.log(pc.dim(`  [result] ${tool}: ${output.slice(0, 100)}`));
  }

  showTurnComplete(cost: number, durationMs: number): void {
    console.log(pc.dim(`\n  Turn complete: $${cost.toFixed(4)}, ${(durationMs / 1000).toFixed(1)}s`));
  }

  showPartnerJoined(user: string): void {
    console.log(pc.green(`\n  \u2726 ${user} joined the session`));
  }

  showPartnerLeft(user: string): void {
    console.log(pc.yellow(`\n  \u2726 ${user} left the session`));
  }

  showApprovalRequest(promptId: string, user: string, text: string): void {
    console.log(pc.yellow(`\n  \u26A0 ${user} wants to send: "${text}"`));
    console.log(pc.dim(`    (Approval handling via TUI \u2014 auto-approving for now)`));
    // In a full implementation, this would show an interactive approval prompt
    // For now, auto-approve
    if (this.approvalHandler) {
      this.approvalHandler(promptId, true);
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
