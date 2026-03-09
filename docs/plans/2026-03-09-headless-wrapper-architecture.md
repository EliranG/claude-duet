# Claude-Duet v0.2: Headless Wrapper Architecture

## What Changed and Why

**v0.1 architecture:** claude-duet runs its own Claude Agent SDK instance. It IS the AI session.

**Problem:** Users are already in a Claude Code session when they get stuck. They want to invite a friend into THAT session — not start a new one in a different tool.

**v0.2 architecture:** claude-duet wraps Claude Code in headless mode (`claude -p --output-format stream-json`). It's a **collaboration layer on top of Claude Code**, not a replacement for it.

```
v0.1:  claude-duet → Agent SDK → Anthropic API
v0.2:  claude-duet → Claude Code (headless, stream-json) → Anthropic API
```

**Why this is better:**
- Users can resume their existing Claude Code session (`--resume` / `--continue`)
- All Claude Code features work (tools, MCP servers, slash commands, permissions)
- No need to implement Claude's tool execution, permissions, or context management
- Session files are shared — context flows seamlessly between solo and duet modes
- Claude Code handles token limits, compaction, and billing

**What we lose:**
- Direct Agent SDK control (we depend on Claude Code CLI being installed)
- Claude Code's native TUI (we provide our own — already built as Ink components)

---

## New User Experience

### The Core Flow: "I'm Stuck, Help Me"

```
# Alice is deep in a Claude Code session, stuck on a bug.
# She exits Claude Code:
alice$ ctrl+c

# Starts a shared session, resuming where she left off:
alice$ claude-duet host --continue

  ✦ claude-duet v0.2.0

  Resuming Claude Code session (last active 2 min ago)...
  Session loaded — 47 messages, $0.32 spent

  ╭─────────────────────────────────────╮
  │  Join command (copied to clipboard):│
  │                                     │
  │  claude-duet join xK9mPqR2          │
  │                                     │
  │  Password: a1b2c3d4                 │
  ╰─────────────────────────────────────╯

  ⏳ Waiting for partner...

# Alice shares the join command via Slack/Discord/iMessage.

# Bob joins from his terminal:
bob$ claude-duet join xK9mPqR2 --password a1b2c3d4

  ✦ Connecting... done.
  ✦ Catching up on 47 messages...

  [alice]: Fix the auth bug in middleware.ts
  [claude]: I see the issue in the JWT validation...
  [alice]: That didn't work, the test still fails
  [claude]: Let me look at the test...
  ... (scrolling through history)

  ✦ You're live! Approval mode is ON.

# Now both are in the session:
bob> @claude I think the issue is the JWT expiry
     check uses < instead of <=

  ⚠ bob wants to prompt Claude:
  "I think the issue is the JWT expiry check uses < instead of <="
  Approve? (y/n): y

  ✦ Claude is thinking...
  Good catch, Bob! The comparison on line 42...

    [tool] Edit: src/auth.ts ✓

  ── turn complete (2.1s, $0.028) ──
```

### After Duet — Alice Continues Solo

```
alice$ /end

  ✦ Session Summary
  Duration:    23 minutes
  Turns:       8
  Cost:        $0.19
  Prompts:     alice: 5, bob: 3

  Session log saved to .claude-duet/sessions/xK9mPqR2.log

  ✦ Tip: Resume this Claude Code session solo with:
     claude --continue

# Alice goes back to regular Claude Code:
alice$ claude --continue

# Claude remembers EVERYTHING — before duet, during duet, after duet.
```

### Fresh Session (No Resume)

```
alice$ claude-duet host

  ✦ Starting fresh Claude Code session...

  (same flow as above, but no history catch-up for joiner)
```

### Interactive Permission Mode

```
alice$ claude-duet host --continue --permission-mode interactive

  ✦ claude-duet v0.2.0
  ✦ Permission mode: interactive (you approve each tool use)

  ...

# During the session, when Claude wants to use a tool:

  ⚠ Claude wants to run:
  [Edit] src/auth.ts (lines 40-45)
  Allow? (y/n): y

  ✦ Claude is editing...

    [tool] Edit: src/auth.ts ✓

# If the host denies:

  ⚠ Claude wants to run:
  [Bash] rm -rf node_modules
  Allow? (y/n): n

  ✦ Tool denied. Claude will adjust approach.
```

### Simplified Join (Single Token)

v0.1 required 3 things: session code + password + URL.
v0.2 encodes everything into a single join token:

```
# Host shows:
  claude-duet join xK9mPqR2 --password a1b2c3d4

# On LAN, the guest auto-discovers the host via the session code.
# For remote, the URL is baked into the token or provided separately.
```

### CLI Reference (v0.2)

```bash
# Host — resume most recent session (recommended flow)
claude-duet host --continue

# Host — resume specific session
claude-duet host --resume <session-id>

# Host — fresh session
claude-duet host

# Host — interactive permission mode
claude-duet host --continue --permission-mode interactive

# Host — all flags
claude-duet host --continue --name alice --no-approval \
  --permission-mode interactive --tunnel cloudflare

# Join
claude-duet join <code> --password <pw> [--url <ws://...>]

# Config
claude-duet config set permissionMode interactive
claude-duet config set permissionMode auto
```

---

## Architecture

```
Host's machine
┌───────────────────────────────────────────────────────┐
│  claude-duet host                                     │
│                                                       │
│  ┌─────────────────────────────────────────────────┐  │
│  │  Claude Code (child process, headless)           │  │
│  │                                                  │  │
│  │  claude -p --output-format stream-json           │  │
│  │           --input-format stream-json             │  │
│  │           --continue (or --resume <id>)          │  │
│  │           --allowedTools "..." (auto mode)        │  │
│  │           OR PermissionRequest hook (interactive) │  │
│  │                                                  │  │
│  │  stdin  ◄── JSON prompt messages                 │  │
│  │  stdout ──► NDJSON stream (tokens, tools, etc.)  │  │
│  └──────────────▲──────────────┬────────────────────┘  │
│                 │              │                        │
│  ┌──────────────┴──────────────▼────────────────────┐  │
│  │  ClaudeBridge (stream-json adapter)              │  │
│  │                                                  │  │
│  │  • Spawns claude CLI as child process            │  │
│  │  • Writes prompts to stdin as stream-json        │  │
│  │  • Parses NDJSON stdout into ClaudeEvents        │  │
│  │  • Same EventEmitter interface as v0.1           │  │
│  └──────────────▲──────────────┬────────────────────┘  │
│                 │              │                        │
│  ┌──────────────┴──────────────▼────────────────────┐  │
│  │  Prompt Router + Approval Engine                 │  │
│  │  (unchanged from v0.1)                           │  │
│  └──────────────▲──────────────┬────────────────────┘  │
│                 │              │                        │
│  ┌──────────────┴──────────────▼────────────────────┐  │
│  │  WebSocket Server + E2E Encryption               │  │
│  │  (unchanged from v0.1)                           │  │
│  └──────────────▲──────────────┬────────────────────┘  │
│                 │              │                        │
│  ┌──────────────┴──────────────▼────────────────────┐  │
│  │  Terminal UI (Ink-based TUI)                      │  │
│  │                                                  │  │
│  │  • Host sees: prompts, Claude responses, tools   │  │
│  │  • Host approves/rejects guest prompts           │  │
│  │  • Status bar: users, cost, context %            │  │
│  └──────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────┘
            │ WebSocket (E2E encrypted)
            ▼
┌───────────────────────────────────────────────────────┐
│  Guest's machine                                      │
│                                                       │
│  claude-duet join                                     │
│  ├── WebSocket Client + E2E Encryption                │
│  ├── History Catch-up (replayed from host)            │
│  └── Terminal UI (same Ink-based TUI)                 │
└───────────────────────────────────────────────────────┘
```

---

## Context Flow

### The Session File Is the Source of Truth

Claude Code stores all conversations in JSONL files at:
```
~/.claude/projects/<project-path-encoded>/<session-id>.jsonl
```

Whether prompts come through Claude Code's native TUI or through headless stream-json, they all land in the same JSONL file. This means:

| Moment | Alice (host) | Bob (guest) | Claude's context |
|--------|-------------|-------------|-----------------|
| Solo in Claude Code | Full session | N/A | Full session |
| Exit, start duet `--continue` | Full session | Catches up from JSONL | Full session (uninterrupted) |
| During duet | Live | Live | Full session (continuous) |
| End duet, back to solo | Full session | Disconnected | Full session (remembers duet) |
| Duet again later | Full session | Catches up again (including solo work) | Full session |

### Guest History Catch-up

When a guest connects, the host:
1. Reads the session JSONL file from disk
2. Parses it into displayable messages (user prompts, Claude responses, tool calls)
3. Sends a `history_replay` batch to the guest before going live
4. Guest TUI shows a "Catching up on N messages..." indicator, then scrolls through history

New protocol message:
```typescript
// Server → Client (sent once on join, before going live)
{
  type: "history_replay",
  messages: HistoryMessage[],  // parsed from JSONL
  sessionId: string,
  resumedFrom: number,         // message count at resume point
  timestamp: number
}

interface HistoryMessage {
  role: "user" | "assistant" | "tool";
  user?: string;               // who sent it (for user messages)
  text: string;                // display text
  toolName?: string;           // for tool calls
  cost?: number;               // for turn_complete
  timestamp: number;
}
```

---

## Claude Code Integration Layer

### Spawning Claude Code

```typescript
import { spawn } from "node:child_process";

const claude = spawn("claude", [
  "-p",                              // headless (print) mode
  "--output-format", "stream-json",  // NDJSON output
  "--input-format", "stream-json",   // NDJSON input
  "--continue",                      // resume most recent session
  // OR: "--resume", sessionId,      // resume specific session
  "--verbose",                       // include tool details
], {
  cwd: process.cwd(),               // run in current project
  env: { ...process.env },          // inherit user's env (API keys, etc.)
  stdio: ["pipe", "pipe", "pipe"],  // control all streams
});
```

### Stream-JSON Output Format (NDJSON) — Verified

Each line of stdout is a JSON object. Verified against Claude Code v2.1.71:

**1. System init (first message, always):**
```json
{
  "type": "system",
  "subtype": "init",
  "cwd": "/path/to/project",
  "session_id": "b6b4d5d5-361d-4dcb-b7b7-b86b2469d2cb",
  "tools": ["Bash", "Edit", "Read", "Write", "Glob", "Grep", ...],
  "mcp_servers": [{"name": "...", "status": "connected|failed|needs-auth"}],
  "model": "claude-opus-4-6",
  "permissionMode": "bypassPermissions",
  "claude_code_version": "2.1.71",
  "uuid": "..."
}
```
Key fields: `session_id` (needed for resume), `tools` (available tools), `model`, `permissionMode`.

**2. Assistant message (Claude's response — text, tool_use, thinking):**
```json
{
  "type": "assistant",
  "message": {
    "model": "claude-opus-4-6",
    "id": "msg_01BCceehkxaDAFXgeFwFmoF7",
    "role": "assistant",
    "content": [
      {"type": "text", "text": "hello stream test"},
      {"type": "tool_use", "id": "toolu_...", "name": "Edit", "input": {...}},
      {"type": "thinking", "thinking": "..."}
    ],
    "stop_reason": null,
    "usage": {
      "input_tokens": 3,
      "output_tokens": 1,
      "cache_creation_input_tokens": 8684,
      "cache_read_input_tokens": 6322
    }
  },
  "session_id": "...",
  "uuid": "..."
}
```
Key: Content is an array of blocks — same format as the Anthropic API. May include `text`, `tool_use`, and `thinking` blocks in the same message. The `usage` field provides token counts.

**3. Rate limit event:**
```json
{
  "type": "rate_limit_event",
  "rate_limit_info": {
    "status": "allowed",
    "resetsAt": 1773068400,
    "rateLimitType": "five_hour"
  }
}
```

**4. Result (turn complete — final message of each turn):**
```json
{
  "type": "result",
  "subtype": "success",
  "is_error": false,
  "duration_ms": 1570,
  "duration_api_ms": 1362,
  "num_turns": 1,
  "result": "hello stream test",
  "stop_reason": "end_turn",
  "session_id": "...",
  "total_cost_usd": 0.0576,
  "usage": {
    "input_tokens": 3,
    "output_tokens": 6,
    "cache_creation_input_tokens": 8684,
    "cache_read_input_tokens": 6322
  },
  "modelUsage": {
    "claude-opus-4-6": {
      "inputTokens": 3,
      "outputTokens": 6,
      "costUSD": 0.0576,
      "contextWindow": 200000,
      "maxOutputTokens": 32000
    }
  }
}
```
Key: `total_cost_usd` for cost tracking, `duration_ms` for turn timing, `modelUsage.*.contextWindow` for context %. The `result` field contains the final text output.

**Full tool-use round-trip (verified):**

When Claude calls a tool, the stream emits separate messages for each step:

```
1. system init
2. assistant (thinking block)     ← Claude's internal reasoning
3. assistant (tool_use block)     ← Claude requests to use a tool
4. rate_limit_event
5. user (tool_result block)       ← Tool execution result
6. assistant (text block)         ← Claude's response using the result
7. result (turn complete)
```

**Key detail:** Each content block comes as a **separate** assistant/user message — thinking is one NDJSON line, tool_use is another, text is another. Content blocks are NOT batched.

**Tool result message (type: "user"):**
```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [{
      "tool_use_id": "toolu_01U2twWzjuT53wPndm2xtugR",
      "type": "tool_result",
      "content": "     1→{\n     2→  \"name\": \"claude-duet\",\n..."
    }]
  },
  "tool_use_result": {
    "type": "text",
    "file": {
      "filePath": "/path/to/file",
      "content": "...",
      "numLines": 5,
      "startLine": 1,
      "totalLines": 63
    }
  },
  "session_id": "...",
  "uuid": "..."
}
```
The `tool_use_result` field has structured metadata (file path, line numbers). The `content` field in the message has the raw text output.

### Stream-JSON Input Format (NDJSON)

Write to stdin to send user messages:

```jsonl
{"type":"user","content":"[bob]: fix the JWT expiry check in auth.ts"}
```

**Note:** The exact input format still needs verification. The `--input-format stream-json` test failed due to a shell quoting issue. Will verify during implementation — if the above format doesn't work, alternatives are `{"role":"user","content":"..."}` or `{"role":"user","content":[{"type":"text","text":"..."}]}`.

### Permission Handling

In headless mode, Claude Code can't show interactive permission dialogs. claude-duet offers two modes — the host chooses at session start:

**Mode A: Auto-approve (default)**

Pre-approve all standard tools. Claude executes without asking. This is the default because it matches how most Claude Code power users already run (with "always allow" permissions).

```
--allowedTools "Edit,Write,Read,Glob,Grep,Bash,Agent,NotebookEdit"
```

CLI: `claude-duet host` (default) or `claude-duet host --permission-mode auto`

**Mode B: Interactive approval (`--permission-mode interactive`)**

Host reviews each tool use in the TUI before Claude executes it. Uses a `PermissionRequest` hook that relays to claude-duet's TUI via a local HTTP server:

```json
{
  "hooks": {
    "PermissionRequest": [{
      "type": "http",
      "url": "http://localhost:PORT/permission",
      "timeout": 30000
    }]
  }
}
```

claude-duet starts a tiny HTTP server, installs the hook config temporarily, and surfaces permission requests to the host:

```
  ⚠ Claude wants to run:
  [Bash] npm test -- --watch
  Allow? (y/n): █
```

The host approves or denies each action. This gives the same safety as normal Claude Code's interactive permission prompts.

CLI: `claude-duet host --permission-mode interactive`

**Wizard integration:**

```
◆  Tool permission mode?
│  ● Auto-approve — Claude runs tools freely (default, recommended)
│  ○ Interactive — you approve each tool use (like normal Claude Code)
```

**Config support:**

```bash
# Set interactive as your default
claude-duet config set permissionMode interactive

# Or per-project
claude-duet config set permissionMode interactive --project
```

### Session Resume

Three modes:

| Flag | Behavior | Use case |
|------|----------|----------|
| (none) | Fresh Claude Code session | New pair session |
| `--continue` | Resume most recent session for this project | "I was just in Claude Code" |
| `--resume <id>` | Resume specific session by ID | Returning to a known session |

Session ID detection: claude-duet reads `~/.claude/projects/<path>/sessions-index.json` to find and list available sessions.

---

## Dependency Changes

### Remove
```
@anthropic-ai/claude-agent-sdk  → replaced by Claude Code CLI (must be installed)
```

### Add
```
(none — child_process is built-in Node.js)
```

### Keep (unchanged)
```
@clack/prompts    — wizard
@inkjs/ui         — TUI components
ink               — React terminal framework
react             — runtime for Ink
ws                — WebSocket
tweetnacl         — encryption
tweetnacl-util    — encoding helpers
nanoid            — session codes
picocolors        — colors
commander         — CLI parsing
qrcode-terminal   — QR display
```

### New prerequisite
```
Claude Code CLI must be installed: npm install -g @anthropic-ai/claude-code
```

---

## File-by-File Impact Analysis

### Source Files — Must Change

| File | Change | Scope |
|------|--------|-------|
| **src/claude.ts** | **REWRITE** — Replace Agent SDK with child process spawning Claude Code in headless mode. Parse NDJSON stdout, write to stdin. Keep same EventEmitter interface. | Major |
| **src/commands/host.ts** | **MODIFY** — Add `--continue`/`--resume` flags. Add session history replay to guest on join. Pass allowed tools to ClaudeBridge. Detect Claude Code installation. | Moderate |
| **src/commands/join.ts** | **MODIFY** — Handle `history_replay` message. Show catch-up phase UI ("Catching up on N messages..."). | Moderate |
| **src/protocol.ts** | **ADD** — New `HistoryReplayMessage` and `HistoryMessage` types. Add to `ServerMessage` union. Add `isHistoryReplay()` type guard. | Small |
| **src/index.ts** | **MODIFY** — Add `--continue` and `--resume <id>` flags to host command. Add Claude Code installation check. | Small |
| **src/types/claude-agent-sdk.d.ts** | **DELETE** — No longer using Agent SDK. | Delete |
| **src/permissions.ts** | **NEW** — Local HTTP server for interactive permission mode. Receives PermissionRequest hooks from Claude Code, emits events to host TUI, responds with approve/deny. | New module |
| **src/config.ts** | **MODIFY** — Add `permissionMode` to `ClaudeDuetConfig` interface. | Small |
| **src/wizard.ts** | **MODIFY** — Add permission mode and session resume wizard steps. | Moderate |

### Source Files — No Changes Needed

| File | Why |
|------|-----|
| **src/router.ts** | Works with any ClaudeBridge — same EventEmitter interface |
| **src/server.ts** | Protocol-independent. May add history replay in `handleConnection()` |
| **src/client.ts** | Protocol-independent |
| **src/session.ts** | Session code/password generation unchanged |
| **src/crypto.ts** | Independent encryption layer |
| **src/connection.ts** | LAN/tunnel/relay unchanged |
| **src/lifecycle.ts** | Metrics tracking unchanged |
| **src/ui.ts** | Display unchanged |
| **src/terminal-colors.ts** | Independent |
| **src/relay-server.ts** | Independent |
| **src/commands/session-commands.ts** | Slash commands unchanged |
| **src/commands/config.ts** | Independent |
| **src/ui/App.tsx** | Independent (not yet wired) |
| **src/ui/StatusBar.tsx** | Independent |
| **src/ui/ChatView.tsx** | Independent |

### Test Files

| Test | Change | Why |
|------|--------|-----|
| **claude.test.ts** | **REWRITE** — Mock child process instead of Agent SDK. Test NDJSON parsing, stdin writing, event emission, error handling, session resume, both permission modes. | Major |
| **permissions.test.ts** | **NEW** — Test PermissionServer HTTP handler, approve/deny flow, timeout behavior, hook config generation. | New |
| **integration.test.ts** | **REWRITE** — Mock Claude Code CLI process. Test full flow: host spawns claude, guest joins, history replay, prompt routing, approval, streaming, both permission modes. | Major |
| **protocol.test.ts** | **ADD** — Tests for `isHistoryReplay()` and new message types. | Small |
| **config.test.ts** | **ADD** — Tests for `permissionMode` config key. | Small |
| **router.test.ts** | **MINOR** — May need to update mock if ClaudeBridge constructor changes. | Minimal |
| All other tests | **NO CHANGE** — They mock at the right abstraction level. | None |

### Documentation

| File | Change | Scope |
|------|--------|-------|
| **README.md** | **REWRITE** — New positioning ("share your Claude Code session"), new UX flow showing `--continue`, updated architecture diagram, Claude Code prerequisite, new "how it works" section. | Major |
| **CONTRIBUTING.md** | **UPDATE** — Updated project structure (remove agent-sdk.d.ts, note claude.ts rewrite). Add Claude Code as dev dependency note. | Moderate |
| **CHANGELOG.md** | **ADD** — v0.2.0 entry documenting headless wrapper architecture. | Small |
| **SECURITY.md** | **UPDATE** — Note that Claude Code runs on host with host's permissions. Add note about `--allowedTools` scope. | Small |
| **docs/plans/2026-03-08-claude-duet-design.md** | **KEEP** — Historical document. Add note at top linking to this new architecture doc. | Trivial |

### Package & Config

| File | Change |
|------|--------|
| **package.json** | Remove `@anthropic-ai/claude-agent-sdk` from deps. Bump version to 0.2.0. Update description. Add `claude-code` to peerDependencies or engines. Update keywords. |
| **tsconfig.json** | No change |
| **.github/workflows/ci.yml** | Add step to install Claude Code CLI for tests (or mock it). |

### GitHub Repository

| Item | Change |
|------|--------|
| **Repo description** | Update to: "Share your Claude Code session with a friend — real-time collaboration for AI pair programming" |
| **Repo topics** | Add: `claude-code`, `pair-programming`, `real-time`, `collaboration` |
| **Social preview** | May want to update to show the new resume flow |

---

## New ClaudeBridge Implementation (Key Design)

The critical change is `src/claude.ts`. Here's the new design:

```typescript
// src/claude.ts — v0.2 (headless wrapper)

import { spawn, ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { createInterface } from "node:readline";

export type PermissionMode = "auto" | "interactive";

export interface ClaudeBridgeOptions {
  resume?: string;           // specific session ID
  continue?: boolean;        // resume most recent
  permissionMode?: PermissionMode;  // auto (default) or interactive
  allowedTools?: string[];   // override default tool list (auto mode)
  cwd?: string;
}

export type ClaudeEvent =
  | { type: "stream_chunk"; text: string }
  | { type: "tool_use"; tool: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool: string; output: string }
  | { type: "turn_complete"; cost: number; durationMs: number }
  | { type: "session_init"; sessionId: string }
  | { type: "permission_request"; tool: string; input: Record<string, unknown>; requestId: string }
  | { type: "error"; message: string };

export class ClaudeBridge extends EventEmitter {
  private process: ChildProcess | null = null;
  private sessionId: string | null = null;
  private busy = false;

  constructor(private options: ClaudeBridgeOptions = {}) {
    super();
  }

  /** Spawn Claude Code in headless stream-json mode */
  async start(): Promise<void> {
    const args = [
      "-p",
      "--output-format", "stream-json",
      "--input-format", "stream-json",
      "--verbose",
    ];

    if (this.options.continue) {
      args.push("--continue");
    } else if (this.options.resume) {
      args.push("--resume", this.options.resume);
    }

    const permMode = this.options.permissionMode || "auto";
    if (permMode === "auto") {
      const tools = this.options.allowedTools || [
        "Edit", "Write", "Read", "Glob", "Grep", "Bash", "Agent", "NotebookEdit"
      ];
      args.push("--allowedTools", tools.join(","));
    }
    // In interactive mode, we don't pass --allowedTools.
    // Instead, we install a PermissionRequest hook that routes
    // permission prompts to our local HTTP server (see PermissionServer).

    this.process = spawn("claude", args, {
      cwd: this.options.cwd || process.cwd(),
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Parse NDJSON from stdout
    const rl = createInterface({ input: this.process.stdout! });
    rl.on("line", (line) => this.handleOutputLine(line));

    // Capture stderr for errors
    const stderrRl = createInterface({ input: this.process.stderr! });
    stderrRl.on("line", (line) => {
      this.emit("error", { type: "error", message: line });
    });

    this.process.on("exit", (code) => {
      this.busy = false;
      if (code !== 0) {
        this.emit("error", { type: "error", message: `Claude Code exited with code ${code}` });
      }
    });
  }

  /** Send a user prompt to Claude Code's stdin */
  sendPrompt(user: string, text: string, options?: { isHost?: boolean }): void {
    if (!this.process?.stdin) {
      this.emit("error", { type: "error", message: "Claude Code not running" });
      return;
    }

    this.busy = true;

    const attribution = options?.isHost
      ? `[${user} (host)]`
      : `[${user}]`;
    const fullPrompt = `${attribution}: ${text}`;

    // Write as stream-json input
    const msg = JSON.stringify({ type: "user", text: fullPrompt });
    this.process.stdin.write(msg + "\n");
  }

  /** Parse a single line of NDJSON output (verified against Claude Code v2.1.71) */
  private handleOutputLine(line: string): void {
    try {
      const msg = JSON.parse(line);

      switch (msg.type) {
        case "system": {
          // Init message — extract session_id, model, tools
          if (msg.subtype === "init" && msg.session_id) {
            this.sessionId = msg.session_id;
            this.emit("session_init", { type: "session_init", sessionId: msg.session_id });
          }
          break;
        }

        case "assistant": {
          // Each assistant message has content array with ONE block
          // (thinking, text, or tool_use — each is a separate NDJSON line)
          const content = msg.message?.content || [];
          for (const block of content) {
            if (block.type === "text") {
              this.emit("stream_chunk", { type: "stream_chunk", text: block.text });
            } else if (block.type === "tool_use") {
              this.emit("tool_use", {
                type: "tool_use",
                tool: block.name,       // e.g. "Edit", "Bash", "Read"
                input: block.input,     // e.g. { file_path: "src/auth.ts", ... }
              });
            }
            // block.type === "thinking" — skip (internal reasoning)
          }
          break;
        }

        case "user": {
          // Tool result — Claude Code executed a tool and returns the output
          const content = msg.message?.content || [];
          for (const block of content) {
            if (block.type === "tool_result") {
              // tool_use_result has structured metadata (file path, etc.)
              const result = msg.tool_use_result;
              const output = result?.file
                ? `${result.file.filePath} (${result.file.totalLines} lines)`
                : (typeof block.content === "string" ? block.content : JSON.stringify(block.content));
              this.emit("tool_result", {
                type: "tool_result",
                tool: result?.type || "unknown",
                output: output,
              });
            }
          }
          break;
        }

        case "result": {
          // Turn complete — final message of each turn
          if (msg.subtype === "success" || msg.subtype === "error") {
            this.busy = false;
            this.emit("turn_complete", {
              type: "turn_complete",
              cost: msg.total_cost_usd || 0,
              durationMs: msg.duration_ms || 0,
            });
          }
          break;
        }

        // rate_limit_event — ignore for now
      }
    } catch {
      // Non-JSON line from Claude Code — ignore or log
    }
  }

  getSessionId(): string | null { return this.sessionId; }
  isBusy(): boolean { return this.busy; }

  /** Gracefully stop Claude Code */
  async stop(): Promise<void> {
    if (this.process) {
      this.process.stdin?.end();
      this.process.kill("SIGTERM");
      this.process = null;
    }
  }
}
```

**Key design decisions:**
1. Same EventEmitter interface as v0.1 — router, server, UI don't change
2. Child process management with graceful shutdown
3. NDJSON line-by-line parsing (readline)
4. User attribution baked into the prompt text (Claude sees `[bob]: fix the bug`)
5. Session resume via `--continue` or `--resume <id>`
6. Permission mode determines how Claude Code tools are authorized

---

## Permission Server (Interactive Mode)

New file: `src/permissions.ts`

When the host chooses `--permission-mode interactive`, claude-duet starts a local HTTP server that receives `PermissionRequest` hooks from Claude Code and surfaces them in the host's TUI.

```typescript
// src/permissions.ts — Local HTTP server for interactive permission approval

import { createServer, Server } from "node:http";
import { EventEmitter } from "node:events";

export interface PermissionRequest {
  requestId: string;
  tool: string;
  input: Record<string, unknown>;
}

export interface PermissionDecision {
  requestId: string;
  approved: boolean;
}

export class PermissionServer extends EventEmitter {
  private server: Server | null = null;
  private port: number = 0;
  private pending: Map<string, {
    resolve: (decision: "approve" | "deny") => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  /** Start HTTP server on a random available port */
  async start(): Promise<number> {
    return new Promise((resolve) => {
      this.server = createServer((req, res) => this.handleRequest(req, res));
      this.server.listen(0, "127.0.0.1", () => {
        const addr = this.server!.address() as { port: number };
        this.port = addr.port;
        resolve(this.port);
      });
    });
  }

  /** Handle incoming PermissionRequest hook from Claude Code */
  private handleRequest(req, res): void {
    // Claude Code POSTs JSON with tool name, input, etc.
    // We emit a "permission_request" event for the host TUI to display
    // Then wait for the host's decision (approve/deny)
    // Respond to Claude Code with the decision
    let body = "";
    req.on("data", (chunk) => body += chunk);
    req.on("end", () => {
      const hookData = JSON.parse(body);
      const requestId = crypto.randomUUID();

      this.emit("permission_request", {
        requestId,
        tool: hookData.tool,
        input: hookData.input,
      });

      // Wait for host decision (with 30s timeout → auto-deny)
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        res.writeHead(200);
        res.end(JSON.stringify({ permissionDecision: "deny" }));
      }, 30000);

      this.pending.set(requestId, {
        resolve: (decision) => {
          clearTimeout(timeout);
          this.pending.delete(requestId);
          res.writeHead(200);
          res.end(JSON.stringify({ permissionDecision: decision }));
        },
        timeout,
      });
    });
  }

  /** Host approves or denies a permission request */
  respond(requestId: string, approved: boolean): void {
    const entry = this.pending.get(requestId);
    if (entry) {
      entry.resolve(approved ? "approve" : "deny");
    }
  }

  /** Generate Claude Code hook config for this server */
  getHookConfig(): object {
    return {
      hooks: {
        PermissionRequest: [{
          type: "http",
          url: `http://127.0.0.1:${this.port}/permission`,
          timeout: 30000,
        }],
      },
    };
  }

  async stop(): Promise<void> {
    // Auto-deny all pending requests
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timeout);
      entry.resolve("deny");
    }
    this.pending.clear();
    this.server?.close();
    this.server = null;
  }
}
```

**How it integrates with ClaudeBridge:**

In interactive mode, ClaudeBridge:
1. Creates a PermissionServer and starts it
2. Writes the hook config to a temp file
3. Passes `--settings <temp-file>` to the `claude` CLI spawn
4. Listens for `permission_request` events and re-emits them as ClaudeEvents
5. Host TUI displays the request and calls `permissionServer.respond(id, approved)`

```
Host TUI:
  ⚠ Claude wants to run:
  [Bash] npm test -- --watch
  Allow? (y/n): y ← host presses 'y'
     ↓
  PermissionServer.respond(requestId, true)
     ↓
  HTTP response: { permissionDecision: "approve" }
     ↓
  Claude Code executes the tool
```

---

## Session History Reader (New Module)

New file: `src/history.ts`

```typescript
// src/history.ts — Read Claude Code session JSONL for history replay

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export interface HistoryMessage {
  role: "user" | "assistant" | "tool";
  user?: string;
  text: string;
  toolName?: string;
  cost?: number;
  timestamp: number;
}

/** Find the session JSONL file for a given session ID */
export async function findSessionFile(sessionId: string): Promise<string | null> {
  // Claude Code stores sessions at:
  // ~/.claude/projects/<encoded-path>/<session-id>.jsonl
  // We need to search for the session ID across project dirs
  const claudeDir = join(homedir(), ".claude", "projects");
  // ... search logic
}

/** Parse a Claude Code session JSONL into displayable messages */
export async function parseSessionHistory(filePath: string): Promise<HistoryMessage[]> {
  const content = await readFile(filePath, "utf-8");
  const lines = content.split("\n").filter(Boolean);
  const messages: HistoryMessage[] = [];

  for (const line of lines) {
    try {
      const record = JSON.parse(line);
      // Map JSONL records to HistoryMessage
      // (depends on Claude Code's JSONL format)
    } catch {
      // skip malformed lines
    }
  }

  return messages;
}

/** Find the most recent session for the current project */
export async function findRecentSession(projectPath: string): Promise<{
  sessionId: string;
  filePath: string;
  messageCount: number;
  lastActive: Date;
} | null> {
  // Read sessions-index.json for the project
  // Return most recent session
}
```

---

## Implementation Order

### Phase 1: Core Architecture Swap (must ship together)

| # | Task | Files | Depends on |
|---|------|-------|-----------|
| 1 | Rewrite ClaudeBridge for headless stream-json | `src/claude.ts` | — |
| 2 | Delete Agent SDK types | `src/types/claude-agent-sdk.d.ts` | — |
| 3 | Add `--continue`/`--resume`/`--permission-mode` flags to CLI | `src/index.ts` | — |
| 4 | Create PermissionServer for interactive mode | `src/permissions.ts` (new) | — |
| 5 | Add `permissionMode` to config | `src/config.ts` | — |
| 6 | Update wizard with resume + permission mode steps | `src/wizard.ts` | 5 |
| 7 | Update host command for new ClaudeBridge + permission modes | `src/commands/host.ts` | 1, 4 |
| 8 | Add Claude Code installation check | `src/commands/host.ts` | 1 |
| 9 | Rewrite ClaudeBridge tests (both permission modes) | `src/__tests__/claude.test.ts` | 1 |
| 10 | Add PermissionServer tests | `src/__tests__/permissions.test.ts` (new) | 4 |
| 11 | Update integration tests | `src/__tests__/integration.test.ts` | 1, 7 |
| 12 | Update package.json (deps, version, description) | `package.json` | — |

### Phase 2: Guest History Catch-up

| # | Task | Files | Depends on |
|---|------|-------|-----------|
| 13 | Create session history reader | `src/history.ts` (new) | — |
| 14 | Add HistoryReplayMessage to protocol | `src/protocol.ts` | — |
| 15 | Send history to guest on join | `src/server.ts`, `src/commands/host.ts` | 13, 14 |
| 16 | Display history catch-up in guest UI | `src/commands/join.ts` | 14 |
| 17 | Add history tests | `src/__tests__/history.test.ts` (new) | 13 |
| 18 | Update protocol tests | `src/__tests__/protocol.test.ts` | 14 |

### Phase 3: Documentation & Polish

| # | Task | Files | Depends on |
|---|------|-------|-----------|
| 19 | Rewrite README.md | `README.md` | 1-18 |
| 20 | Update CONTRIBUTING.md | `CONTRIBUTING.md` | 1-18 |
| 21 | Update CHANGELOG.md | `CHANGELOG.md` | 1-18 |
| 22 | Update SECURITY.md | `SECURITY.md` | — |
| 23 | Add architecture note to original design doc | `docs/plans/2026-03-08-claude-duet-design.md` | — |
| 24 | Update GitHub repo description + topics | GitHub | 19 |
| 25 | Update CI workflow | `.github/workflows/ci.yml` | 12 |

---

## Wizard Changes

The setup wizard (`src/wizard.ts`) adds two new steps:

```
◆  Resume an existing Claude Code session?
│  ● Yes — continue where you left off (recommended)
│  ○ No — start a fresh session
│
◆  Which session to resume?
│  ● auth-bug-fix (2 min ago, 47 messages, $0.32)
│  ○ refactor-api (yesterday, 123 messages, $1.45)
│  ○ Enter session ID manually
│
◆  Tool permission mode?
│  ● Auto-approve — Claude runs tools freely (default, recommended)
│  ○ Interactive — you approve each tool use (like normal Claude Code)
```

Session list is read from `~/.claude/projects/<path>/sessions-index.json`.

---

## What the Guest Sees (UI Spec)

### Catch-up Phase

```
  ✦ Connected to alice's session
  ✦ Catching up on 47 messages...
  ─────────────────────────────────────────

  [alice]: Fix the auth bug in middleware.ts

  The JWT validation in src/middleware/auth.ts has
  an off-by-one error in the expiry check...

    [tool] Read: src/middleware/auth.ts ✓
    [tool] Edit: src/middleware/auth.ts ✓

  ── turn complete ($0.028) ──

  [alice]: That didn't work, the test still fails

  Let me look at the test file to understand
  what assertion is failing...

    [tool] Read: src/__tests__/auth.test.ts ✓

  ── turn complete ($0.019) ──

  ... (47 messages)

  ─────────────────────────────────────────
  ✦ You're live! Approval mode is ON.
  ✦ Type a message to chat, or @claude to prompt.
```

### Live Phase

Same as v0.1 — identical UI for host and guest, real-time streaming.

---

## Error Handling

| Error | Detection | User-facing message |
|-------|-----------|-------------------|
| Claude Code not installed | `which claude` fails on startup | "Claude Code CLI is required. Install with: npm install -g @anthropic-ai/claude-code" |
| Claude Code crashes | Child process exits with non-zero code | "Claude Code exited unexpectedly. Session saved. Resume with: claude-duet host --continue" |
| No session to resume | `--continue` but no sessions exist | "No recent Claude Code session found. Starting fresh." |
| Session ID not found | `--resume <id>` but ID doesn't exist | "Session <id> not found. Available sessions: ..." |
| API key missing | Claude Code reports auth error on stderr | "Claude Code needs an API key. Run 'claude' to set up." |
| Permission denied (auto mode) | Tool not in allowedTools list | "Tool <name> was blocked. To allow it, restart with: --allowedTools '...'" |
| Permission denied (interactive mode) | Host denies in TUI | Claude sees denial, adjusts approach |
| Permission hook timeout | Host doesn't respond within 30s | Auto-deny, show warning to host |

---

## Testing Strategy

### Mocking Claude Code

Tests should NOT require a real Claude Code installation. The ClaudeBridge tests mock the child process:

```typescript
// Mock child process for tests
vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => {
    const proc = new EventEmitter() as MockChildProcess;
    proc.stdin = new PassThrough();
    proc.stdout = new PassThrough();
    proc.stderr = new PassThrough();
    proc.kill = vi.fn();
    return proc;
  }),
}));

// Simulate Claude Code NDJSON output
function simulateClaudeOutput(stdout: PassThrough, messages: object[]) {
  for (const msg of messages) {
    stdout.write(JSON.stringify(msg) + "\n");
  }
}
```

### CI Changes

The CI workflow doesn't need Claude Code installed because all integration tests mock the child process. If we want E2E tests with real Claude Code in the future, they'd run in a separate workflow with API credentials.

---

## Open Questions

### Remaining

1. **Stream-json input format** — The exact JSON format for sending user prompts via `--input-format stream-json` stdin needs verification. Test failed due to shell quoting. Will verify during implementation by trying `{"type":"user","content":"..."}` and falling back to alternatives.

### Answered

**Stream-json output format** — **ANSWERED.** Verified against Claude Code v2.1.71. Requires `--verbose` flag. Four message types:
- `{type: "system", subtype: "init"}` — session init with session_id, tools, model, version
- `{type: "assistant", message: {content: [{type: "text"}, {type: "tool_use"}, {type: "thinking"}]}}` — Claude's response, same content block format as Anthropic API
- `{type: "rate_limit_event"}` — rate limit status
- `{type: "result", subtype: "success|error"}` — turn complete with `total_cost_usd`, `duration_ms`, and `modelUsage` including `contextWindow` (200000) and `maxOutputTokens` (32000)

**Context window info** — **ANSWERED.** The `result` message includes `modelUsage.*.contextWindow` (200000) and token counts (`input_tokens`, `output_tokens`, cache tokens). We can calculate context usage as `(input_tokens + output_tokens) / contextWindow * 100`.

**Tool-use round-trip** — **ANSWERED.** Each step is a separate NDJSON line:
1. `assistant` with `{type: "thinking"}` block
2. `assistant` with `{type: "tool_use", id, name, input}` block
3. `user` with `{type: "tool_result", tool_use_id, content}` block + `tool_use_result` metadata
4. `assistant` with `{type: "text"}` block (Claude's response using the result)
Tool results include structured metadata in `tool_use_result` (e.g., `file.filePath`, `file.totalLines`).

### Answered

4. **Session file format** — **ANSWERED.** JSONL format confirmed from reading actual session files:
   - `type: "user"` — user prompts. Content blocks: `{type: "text", text}`, `{type: "image", source}`.
   - `type: "assistant"` — Claude responses. Content blocks: `{type: "thinking", thinking}`, `{type: "text", text}`, `{type: "tool_use", id, name, input}`.
   - `type: "user"` (tool results) — Content blocks: `{type: "tool_result", tool_use_id, content}`.
   - `type: "progress"` — Hook progress events (skip for history replay).
   - `type: "system"` — Hook summaries, stop reasons (skip for history replay).
   - `type: "file-history-snapshot"` — Git snapshots (skip for history replay).
   - `type: "last-prompt"` — Last prompt metadata (skip for history replay).
   - Each record includes: `uuid`, `parentUuid`, `sessionId`, `timestamp`, `version`, `gitBranch`.

5. **Permission handling** — **DECIDED.** Ship v0.2 with both modes: auto-approve (default) and interactive (opt-in via `--permission-mode interactive`). Both ship in Phase 1.
