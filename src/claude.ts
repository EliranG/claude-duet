import { EventEmitter } from "node:events";
import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PermissionMode = "auto" | "interactive";

export interface ClaudeBridgeOptions {
  resume?: string;             // specific session ID to resume
  continue?: boolean;          // resume most recent session
  permissionMode?: PermissionMode;
  allowedTools?: string[];     // override default tool list (auto mode)
  cwd?: string;
  permissionServerPort?: number; // for interactive mode hook setup
}

export type ClaudeEvent =
  | { type: "stream_chunk"; text: string }
  | { type: "tool_use"; tool: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool: string; output: string }
  | { type: "turn_complete"; cost: number; durationMs: number }
  | { type: "session_init"; sessionId: string }
  | { type: "notice"; message: string }
  | { type: "error"; message: string };

interface FormatOptions {
  isHost?: boolean;
}

// Default tools to auto-approve in auto permission mode
const DEFAULT_ALLOWED_TOOLS = [
  "Edit",
  "Write",
  "Read",
  "Glob",
  "Grep",
  "Bash",
  "Agent",
  "NotebookEdit",
];

// ---------------------------------------------------------------------------
// ClaudeBridge — headless Claude Code wrapper
// ---------------------------------------------------------------------------

export class ClaudeBridge extends EventEmitter {
  private process: ChildProcess | null = null;
  private sessionId: string | null = null;
  private busy = false;
  private options: ClaudeBridgeOptions;

  constructor(options: ClaudeBridgeOptions = {}) {
    super();
    this.options = options;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Spawn the Claude Code CLI in headless mode and start parsing output.
   * Resolves once the process is running (does not wait for session_init).
   */
  async start(): Promise<void> {
    const args = this.buildArgs();

    // Strip CLAUDECODE env var to bypass nesting protection.
    // This is safe: we're spawning a separate headless process, not nesting TUIs.
    // Also needed when user exits Claude Code and runs claude-duet in the same shell.
    const env = { ...process.env };
    delete env.CLAUDECODE;

    this.process = spawn("claude", args, {
      cwd: this.options.cwd ?? process.cwd(),
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Set up NDJSON line-by-line parser on stdout
    if (this.process.stdout) {
      const rl = createInterface({ input: this.process.stdout });
      rl.on("line", (line) => this.handleOutputLine(line));
    }

    // Emit stderr as error events
    if (this.process.stderr) {
      const stderrRl = createInterface({ input: this.process.stderr });
      stderrRl.on("line", (line) => {
        if (line.trim()) {
          this.emit("event", { type: "error", message: line } satisfies ClaudeEvent);
        }
      });
    }

    // Handle process exit
    this.process.on("error", (err) => {
      this.emit("event", {
        type: "error",
        message: `Failed to start Claude Code: ${err.message}`,
      } satisfies ClaudeEvent);
      this.busy = false;
    });

    this.process.on("exit", (code, signal) => {
      if (code !== null && code !== 0) {
        this.emit("event", {
          type: "error",
          message: `Claude Code exited with code ${code}`,
        } satisfies ClaudeEvent);
      }
      this.process = null;
      this.busy = false;
    });
  }

  /**
   * Format a prompt string with user attribution.
   * Kept for backward compatibility — used by the router.
   */
  formatPrompt(user: string, text: string, options?: FormatOptions): string {
    const label = options?.isHost ? `${user} (host)` : user;
    return `[${label}]: ${text}`;
  }

  /**
   * Send a prompt to the Claude Code process via stdin.
   * Non-async — just writes to the pipe.
   */
  sendPrompt(user: string, text: string, options?: FormatOptions): void {
    if (!this.process?.stdin?.writable) {
      this.emit("event", {
        type: "error",
        message: "Claude Code process is not running",
      } satisfies ClaudeEvent);
      return;
    }

    if (this.busy) {
      this.emit("event", {
        type: "error",
        message: "Claude is already processing a prompt",
      } satisfies ClaudeEvent);
      return;
    }

    this.busy = true;
    const fullPrompt = this.formatPrompt(user, text, options);
    const message = JSON.stringify({
      type: "user",
      message: {
        role: "user",
        content: [{ type: "text", text: fullPrompt }],
      },
    });
    this.process.stdin.write(message + "\n");
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  isBusy(): boolean {
    return this.busy;
  }

  /**
   * Gracefully shut down the Claude Code process.
   */
  async stop(): Promise<void> {
    if (!this.process) return;

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        // Force kill if graceful shutdown takes too long
        this.process?.kill("SIGKILL");
        resolve();
      }, 5000);

      this.process!.on("exit", () => {
        clearTimeout(timeout);
        this.process = null;
        resolve();
      });

      // Graceful: close stdin then SIGTERM
      if (this.process!.stdin?.writable) {
        this.process!.stdin.end();
      }
      this.process!.kill("SIGTERM");
    });
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  /**
   * Build the CLI args array for spawning Claude Code.
   */
  private buildArgs(): string[] {
    const args = [
      "-p",                          // headless (print) mode
      "--output-format", "stream-json",
      "--input-format", "stream-json",
      "--verbose",
    ];

    // Session resume flags
    if (this.options.resume) {
      args.push("--resume", this.options.resume);
    } else if (this.options.continue) {
      args.push("--continue");
    }

    // Permission mode
    const mode = this.options.permissionMode ?? "auto";
    if (mode === "auto") {
      const tools = this.options.allowedTools ?? DEFAULT_ALLOWED_TOOLS;
      args.push("--allowedTools", tools.join(","));
    }
    // For interactive mode, we don't pass --allowedTools.
    // The host command will set up a PermissionRequest hook using permissionServerPort.

    return args;
  }

  /**
   * Parse a single NDJSON line from Claude Code stdout and emit typed events.
   *
   * Verified against Claude Code v2.1.71 stream-json format:
   *   - type: "system" + subtype: "init"  → session_init
   *   - type: "assistant"                 → stream_chunk / tool_use (from content blocks)
   *   - type: "user"                      → tool_result
   *   - type: "result"                    → turn_complete
   *   - type: "rate_limit_event"          → ignored
   */
  private handleOutputLine(line: string): void {
    if (!line.trim()) return;

    let parsed: any;
    try {
      parsed = JSON.parse(line);
    } catch {
      // Not valid JSON — ignore (e.g., debug output)
      return;
    }

    switch (parsed.type) {
      case "system":
        this.handleSystemMessage(parsed);
        break;

      case "assistant":
        this.handleAssistantMessage(parsed);
        break;

      case "user":
        this.handleUserMessage(parsed);
        break;

      case "result":
        this.handleResultMessage(parsed);
        break;

      case "rate_limit_event":
        // Ignore
        break;

      default:
        // Unknown type — skip silently
        break;
    }
  }

  private handleSystemMessage(msg: any): void {
    if (msg.subtype === "init" && msg.session_id) {
      this.sessionId = msg.session_id;
      this.emit("event", {
        type: "session_init",
        sessionId: msg.session_id,
      } satisfies ClaudeEvent);
    }
  }

  private handleAssistantMessage(msg: any): void {
    const content = msg.message?.content;
    if (!Array.isArray(content)) return;

    for (const block of content) {
      switch (block.type) {
        case "text":
          if (block.text) {
            this.emit("event", {
              type: "stream_chunk",
              text: block.text,
            } satisfies ClaudeEvent);
          }
          break;

        case "tool_use":
          this.emit("event", {
            type: "tool_use",
            tool: block.name ?? "unknown",
            input: block.input ?? {},
          } satisfies ClaudeEvent);
          break;

        case "thinking":
          // Skip thinking blocks
          break;
      }
    }
  }

  private handleUserMessage(msg: any): void {
    // User messages in stream-json contain tool_result blocks
    const content = msg.message?.content;
    if (!Array.isArray(content)) return;

    for (const block of content) {
      if (block.type === "tool_result") {
        // Extract tool name from the tool_use_result metadata if available,
        // otherwise use a generic label
        const toolName = msg.tool_use_result?.file?.filePath
          ? "Read"
          : "tool";
        const output =
          typeof block.content === "string"
            ? block.content
            : JSON.stringify(block.content ?? "");

        this.emit("event", {
          type: "tool_result",
          tool: toolName,
          output,
        } satisfies ClaudeEvent);
      }
    }
  }

  private handleResultMessage(msg: any): void {
    this.busy = false;
    this.emit("event", {
      type: "turn_complete",
      cost: msg.total_cost_usd ?? 0,
      durationMs: msg.duration_ms ?? 0,
    } satisfies ClaudeEvent);
  }
}
