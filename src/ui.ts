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
  private rawMode = false;
  private lineBuffer = "";
  private rawHandler?: (data: Buffer) => void;

  constructor(options: TerminalUIOptions) {
    this.options = options;
  }

  private sessionText(text: string): string {
    return this.background ? pc.white(text) : pc.dim(text);
  }

  private showInputPrompt(): void {
    process.stdout.write(pc.gray("⟩ "));
  }

  private getSuggestions(): Array<{ trigger: string; completion: string; display: string }> {
    const suggestions: Array<{ trigger: string; completion: string; display: string }> = [
      { trigger: "@", completion: "@claude ", display: "@claude <prompt>" },
      { trigger: "@c", completion: "@claude ", display: "@claude <prompt>" },
      { trigger: "@cl", completion: "@claude ", display: "@claude <prompt>" },
      { trigger: "@cla", completion: "@claude ", display: "@claude <prompt>" },
      { trigger: "@clau", completion: "@claude ", display: "@claude <prompt>" },
      { trigger: "@claud", completion: "@claude ", display: "@claude <prompt>" },
      { trigger: "@claude", completion: "@claude ", display: "@claude <prompt>" },
      { trigger: "/h", completion: "/help", display: "/help" },
      { trigger: "/he", completion: "/help", display: "/help" },
      { trigger: "/hel", completion: "/help", display: "/help" },
      { trigger: "/s", completion: "/status", display: "/status" },
      { trigger: "/st", completion: "/status", display: "/status" },
      { trigger: "/sta", completion: "/status", display: "/status" },
      { trigger: "/stat", completion: "/status", display: "/status" },
      { trigger: "/statu", completion: "/status", display: "/status" },
      { trigger: "/c", completion: "/clear", display: "/clear" },
      { trigger: "/cl", completion: "/clear", display: "/clear" },
      { trigger: "/cle", completion: "/clear", display: "/clear" },
      { trigger: "/clea", completion: "/clear", display: "/clear" },
      { trigger: "/l", completion: "/leave", display: "/leave" },
      { trigger: "/le", completion: "/leave", display: "/leave" },
      { trigger: "/lea", completion: "/leave", display: "/leave" },
      { trigger: "/leav", completion: "/leave", display: "/leave" },
    ];

    if (this.options.role === "host") {
      suggestions.push(
        { trigger: "/t", completion: "/trust", display: "/trust" },
        { trigger: "/tr", completion: "/trust", display: "/trust" },
        { trigger: "/tru", completion: "/trust", display: "/trust" },
        { trigger: "/trus", completion: "/trust", display: "/trust" },
        { trigger: "/a", completion: "/approval", display: "/approval" },
        { trigger: "/ap", completion: "/approval", display: "/approval" },
        { trigger: "/app", completion: "/approval", display: "/approval" },
        { trigger: "/appr", completion: "/approval", display: "/approval" },
        { trigger: "/appro", completion: "/approval", display: "/approval" },
        { trigger: "/approv", completion: "/approval", display: "/approval" },
        { trigger: "/approva", completion: "/approval", display: "/approval" },
        { trigger: "/k", completion: "/kick", display: "/kick" },
        { trigger: "/ki", completion: "/kick", display: "/kick" },
        { trigger: "/kic", completion: "/kick", display: "/kick" },
      );
    }

    return suggestions;
  }

  private findSuggestion(input: string): { completion: string; ghost: string } | null {
    if (!input) return null;
    const lower = input.toLowerCase();
    const match = this.getSuggestions().find((s) => s.trigger === lower);
    if (!match) return null;
    // Ghost text is the part not yet typed
    const ghost = match.completion.slice(input.length);
    if (!ghost) return null;
    return { completion: match.completion, ghost };
  }

  private redrawLine(): void {
    // Clear current line and rewrite
    process.stdout.write(`\r\x1b[2K`);
    process.stdout.write(pc.gray("⟩ "));
    process.stdout.write(pc.white(this.lineBuffer));

    // Show ghost suggestion
    const suggestion = this.findSuggestion(this.lineBuffer);
    if (suggestion) {
      process.stdout.write(pc.dim(suggestion.ghost));
      // Move cursor back to end of actual input
      process.stdout.write(`\x1b[${suggestion.ghost.length}D`);
    }
  }

  startInputLoop(): void {
    if (this.rawMode) return;

    // Use raw mode for inline ghost suggestions if TTY
    if (process.stdin.isTTY) {
      this.rawMode = true;
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf8");

      this.showInputPrompt();

      this.rawHandler = (data: Buffer) => {
        const str = data.toString();

        for (let i = 0; i < str.length; i++) {
          const ch = str[i];
          const code = ch.charCodeAt(0);

          // Ctrl+C
          if (code === 3) {
            process.emit("SIGINT" as any);
            return;
          }

          // Enter
          if (code === 13 || code === 10) {
            process.stdout.write("\n");
            const trimmed = this.lineBuffer.trim();
            this.lineBuffer = "";
            if (trimmed && this.inputHandler) {
              this.inputHandler(trimmed);
            }
            this.showInputPrompt();
            continue;
          }

          // Tab or Right arrow → accept suggestion
          if (code === 9 || (code === 27 && str[i + 1] === "[" && str[i + 2] === "C")) {
            const suggestion = this.findSuggestion(this.lineBuffer);
            if (suggestion) {
              this.lineBuffer = suggestion.completion;
              this.redrawLine();
            }
            if (code === 27) i += 2; // skip escape sequence
            continue;
          }

          // Backspace
          if (code === 127 || code === 8) {
            if (this.lineBuffer.length > 0) {
              this.lineBuffer = this.lineBuffer.slice(0, -1);
              this.redrawLine();
            }
            continue;
          }

          // Escape sequences (arrows etc.) — skip
          if (code === 27) {
            // Consume the rest of the escape sequence
            if (str[i + 1] === "[") {
              i += 2; // skip ESC [ X
            }
            continue;
          }

          // Regular printable character
          if (code >= 32) {
            this.lineBuffer += ch;
            this.redrawLine();
          }
        }
      };

      process.stdin.on("data", this.rawHandler as any);
    } else {
      // Non-TTY fallback (piped input) — use readline
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

  showWelcome(sessionCode: string, password: string, connectUrl?: string, joinCmd?: string): void {
    this.applySessionBackground();

    const violet = (s: string) => pc.magenta(s);
    const dim = (s: string) => this.sessionText(s);
    const bar = violet("  │");

    console.log("");
    console.log(violet("  ┌─────────────────────────────────────────────┐"));
    console.log(`${bar}  ${pc.bold(pc.cyan("✦"))} ${pc.bold(pc.white("claude-duet"))} ${dim("session started")}${" ".repeat(13)}${violet("│")}`);
    console.log(violet("  └─────────────────────────────────────────────┘"));
    console.log("");

    if (joinCmd) {
      // Custom join command (P2P or other)
      console.log(`  ${dim("Send your partner this command to join:")}`);
      console.log("");
      console.log(`  ${pc.green("▶")} ${pc.bold(pc.green(joinCmd))}`);
    } else if (connectUrl) {
      const cmd = `npx claude-duet join ${sessionCode} --password ${password} --url ${connectUrl}`;
      console.log(`  ${dim("Send your partner this command to join:")}`);
      console.log("");
      console.log(`  ${pc.green("▶")} ${pc.bold(pc.green(cmd))}`);
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

  showUserPrompt(user: string, text: string, role: "host" | "guest", mode: "chat" | "claude" = "chat"): void {
    const isSelf = role === this.options.role;
    const partnerColor = role === "host" ? pc.cyan : pc.yellow;

    if (isSelf) {
      // Self messages — subtle since you just typed it
      if (mode === "claude") {
        console.log(`\n${pc.dim("you \u2192 \u2726 Claude:")}`);
      } else {
        console.log(`\n${pc.dim("you:")}`);
      }
    } else {
      // Partner messages — prominent with name and color
      if (mode === "claude") {
        console.log(`\n${pc.bold(partnerColor(user))} ${pc.dim("\u2192 \u2726 Claude:")}`);
      } else {
        console.log(`\n${pc.bold(partnerColor(user + ":"))}`);
      }
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

    if (process.stdin.isTTY) {
      // If we're in raw mode, temporarily detach the main input handler
      // so the approval keypress handler can take over
      if (this.rawMode && this.rawHandler) {
        process.stdin.removeListener("data", this.rawHandler as any);
      } else {
        this.rl?.pause();
        process.stdin.setRawMode(true);
        process.stdin.resume();
      }

      const handler = (data: Buffer) => {
        const key = data.toString().toLowerCase();
        process.stdin.removeListener("data", handler);

        if (this.rawMode && this.rawHandler) {
          // Re-attach the main raw input handler
          process.stdin.on("data", this.rawHandler as any);
          this.showInputPrompt();
        } else {
          process.stdin.setRawMode(false);
          this.rl?.resume();
        }

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
    if (this.rawMode && this.rawHandler) {
      process.stdin.removeListener("data", this.rawHandler as any);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      this.rawMode = false;
      this.rawHandler = undefined;
    }
    this.rl?.close();
    this.rl = undefined;
    if (this.background) {
      process.stdout.write(restoreBackground());
      this.background = undefined;
    }
  }
}
