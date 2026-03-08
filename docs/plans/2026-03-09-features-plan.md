# Chat, Config, Suggestions, and Session Continuity — Implementation Plan

**Goal:** Add chat vs Claude prompt distinction, real approval UI, user/project config, in-session slash commands, suggestion hints, and seamless connect/disconnect.

**Architecture:** 6 independent feature modules that integrate through the existing protocol/router/UI layers. Most can be built in parallel.

---

## Feature A: Chat vs Claude Prompt Protocol

### Task A1: Add chat message type to protocol

**Files:**
- Modify: `src/protocol.ts`

**Changes:**
- Add `ChatMessage` interface (client → server): `{ type: "chat", id, user, text, timestamp }`
- Add `ChatReceived` interface (server → client): `{ type: "chat_received", user, text, timestamp }`
- Add to `ClientMessage` union
- Add to `ServerMessage` union
- Add type guard: `isChatMessage()`

### Task A2: Route chat messages through server

**Files:**
- Modify: `src/server.ts`
- Modify: `src/client.ts`

**Changes in server.ts:**
- Import `isChatMessage` guard
- In `handleMessage()`, add case: if `isChatMessage(msg)` → broadcast as `chat_received` to guest + emit `"chat"` event locally (for host UI)

**Changes in client.ts:**
- Add `sendChat(text: string)` method (sends `type: "chat"` message)
- Keep `sendPrompt()` as-is (for Claude prompts)

### Task A3: Input routing — parse `@claude` prefix

**Files:**
- Modify: `src/commands/host.ts`
- Modify: `src/commands/join.ts`

**Host input handler (host.ts `ui.onInput`):**
```typescript
ui.onInput((text) => {
  if (text.startsWith("@claude ")) {
    const prompt = text.slice(8);
    const msg = { type: "prompt", id: `host-${Date.now()}`, user: name, text: prompt, timestamp: Date.now() };
    ui.showUserPrompt(name, prompt, true, "claude");
    router.handlePrompt(msg);
  } else if (text.startsWith("/")) {
    // Slash commands handled in Feature D
    handleSlashCommand(text, ui, server, ...);
  } else {
    // Chat message
    ui.showUserPrompt(name, text, true, "chat");
    server.broadcast({ type: "chat_received", user: name, text, timestamp: Date.now() });
  }
});
```

**Guest input handler (join.ts `ui.onInput`):**
```typescript
ui.onInput((text) => {
  if (text.startsWith("@claude ")) {
    const prompt = text.slice(8);
    ui.showUserPrompt(name, prompt, false, "claude");
    client.sendPrompt(prompt);
  } else if (text.startsWith("/")) {
    handleSlashCommand(text, ui, client, ...);
  } else {
    ui.showUserPrompt(name, text, false, "chat");
    client.sendChat(text);
  }
});
```

### Task A4: Visual distinction in UI

**Files:**
- Modify: `src/ui.ts`

**Changes:**
- Update `showUserPrompt()` signature: add optional `mode: "chat" | "claude"` param
- For `"claude"` mode: show `[User] → ✦ Claude:` label with different color treatment
- For `"chat"` mode (default): show `[User]:` as normal
- Add `showClaudeThinking()` method — displays `✦ Claude is thinking...`

### Task A5: Tests for chat flow

**Files:**
- Create: `src/__tests__/chat.test.ts`

**Tests:**
- Chat message type guard works
- Server broadcasts chat to guest
- Client `sendChat()` sends correct message type
- `@claude` prefix is stripped and routed as prompt
- Regular text is routed as chat
- UI renders chat vs Claude prompts differently

---

## Feature B: Real Approval UI

### Task B1: Approval prompt on host side

**Files:**
- Modify: `src/ui.ts`

**Changes:**
- Replace auto-approve in `showApprovalRequest()` with real interactive prompt
- Show the approval box:
  ```
  ┌─ Benji → Claude ───────────────────────┐
  │  "fix the login bug"                    │
  │  [y] approve  [n] reject               │
  └─────────────────────────────────────────┘
  ```
- Listen for single keypress `y`/`n` (use raw mode temporarily)
- Call `this.approvalHandler(promptId, approved)`

**Implementation approach:**
- Use `process.stdin.setRawMode(true)` temporarily for single-char input
- After approval/rejection, restore readline
- Timeout: auto-reject after 60s with message

### Task B2: Approval status feedback to guest

**Files:**
- Modify: `src/protocol.ts`
- Modify: `src/router.ts`
- Modify: `src/commands/host.ts`
- Modify: `src/commands/join.ts`
- Modify: `src/ui.ts`

**Protocol changes:**
- Add `ApprovalStatus` message: `{ type: "approval_status", promptId, status: "pending" | "approved" | "rejected", timestamp }`
- Add to `ServerMessage` union

**Router changes:**
- In `handlePrompt()` when queuing: broadcast `approval_status: pending`
- In `handleApproval()`: broadcast `approval_status: approved/rejected`

**Host.ts changes:**
- After approval, show `✅ Approved — sending to Claude`
- After rejection, show `❌ Rejected`

**Join.ts changes:**
- Handle `approval_status` message:
  - `pending`: `ui.showSystem("⏳ Waiting for host to approve...")`
  - `approved`: `ui.showSystem("✅ Approved — Claude is working...")`
  - `rejected`: `ui.showSystem("❌ Host rejected your prompt")`

### Task B3: Tests for approval flow

**Files:**
- Modify: `src/__tests__/integration.test.ts`

**Tests:**
- Guest receives `approval_status: pending` when approval mode on
- Guest receives `approval_status: approved` after host approves
- Guest receives `approval_status: rejected` after host rejects
- Host sees approval prompt UI

---

## Feature C: Configuration System

### Task C1: Config file loader

**Files:**
- Create: `src/config.ts`

**Config search order (highest priority first):**
1. CLI flags (already handled by commander)
2. Project: `.claude-duet.json` in current directory (or any parent up to git root)
3. User: `~/.config/claude-duet/config.json`

**Config shape:**
```typescript
interface ClaudeDuetConfig {
  name?: string;
  approvalMode?: boolean;
  port?: number;
  tunnel?: "cloudflare";
  relay?: string;
}
```

**Functions:**
- `loadConfig(): ClaudeDuetConfig` — merges user + project configs
- `loadUserConfig(): Partial<ClaudeDuetConfig>` — reads `~/.config/claude-duet/config.json`
- `loadProjectConfig(): Partial<ClaudeDuetConfig>` — walks up to find `.claude-duet.json`
- `saveUserConfig(config: Partial<ClaudeDuetConfig>): void`
- `saveProjectConfig(config: Partial<ClaudeDuetConfig>): void`
- `getConfigPaths(): { user: string, project: string | null }`

### Task C2: `claude-duet config` CLI command

**Files:**
- Create: `src/commands/config.ts`
- Modify: `src/index.ts`

**Subcommands:**
```
claude-duet config                     # Show merged config + where each value comes from
claude-duet config set <key> <value>   # Set in user config (default)
claude-duet config set <key> <value> --project  # Set in project config
claude-duet config get <key>           # Get a specific value
claude-duet config path                # Show config file paths
claude-duet config edit                # Open config in $EDITOR
```

**index.ts changes:**
- Add `config` command group with subcommands

### Task C3: Wire config into host/join commands

**Files:**
- Modify: `src/commands/host.ts`
- Modify: `src/commands/join.ts`
- Modify: `src/index.ts`

**Changes:**
- In `index.ts` action handlers: call `loadConfig()`, merge with CLI options (CLI wins)
- Default `--name` from config instead of `process.env.USER`
- Default `--port`, `--tunnel`, approval mode from config

### Task C4: Tests for config

**Files:**
- Create: `src/__tests__/config.test.ts`

**Tests:**
- Loads user config from ~/.config/claude-duet/config.json
- Loads project config from .claude-duet.json
- Project overrides user config
- Missing config files return empty
- `saveUserConfig()` writes correct JSON
- `saveProjectConfig()` writes correct JSON
- Config merge works correctly

---

## Feature D: In-Session Slash Commands & Suggestions

### Task D1: Slash command handler

**Files:**
- Create: `src/commands/session-commands.ts`

**Available commands (both host and guest):**
```
/help                — Show available commands
/leave               — Leave the session gracefully
/status              — Show session info (who's connected, approval mode, duration)
/clear               — Clear the terminal
```

**Host-only commands:**
```
/trust               — Switch to trust mode (disable approval)
/approval            — Switch to approval mode
/kick                — Disconnect the guest
```

**Implementation:**
```typescript
interface CommandContext {
  ui: TerminalUI;
  role: "host" | "guest";
  server?: ClaudeDuetServer;
  client?: ClaudeDuetClient;
  onLeave: () => void;
}

function handleSlashCommand(input: string, ctx: CommandContext): boolean {
  // Returns true if handled, false if not a command
}
```

### Task D2: Suggestion hints (gray text)

**Files:**
- Modify: `src/ui.ts`

**Approach:**
- Add `showHint(text: string)` method — writes gray text below prompt
- Contextual hints that update based on state:
  - On connect: `Type a message to chat, or @claude to ask Claude`
  - When idle: `@claude ask something... | /help for commands`
  - When Claude is busy: `Claude is working...`
- Show hint after each message display and after prompt
- The hint is a single gray line that gets overwritten when user types

**Implementation:**
```typescript
private currentHint?: string;

showHint(text: string): void {
  this.currentHint = text;
  // Write hint on a new line in gray, store cursor position
  process.stdout.write(`\n${pc.gray(pc.italic(text))}`);
  // Move cursor back up to prompt line
  process.stdout.write("\x1b[1A\x1b[999C"); // Up 1, end of line
}

clearHint(): void {
  if (this.currentHint) {
    // Move down, clear line, move back up
    process.stdout.write("\x1b[1B\x1b[2K\x1b[1A");
    this.currentHint = undefined;
  }
}
```

- Call `clearHint()` at the start of every `rl.on("line")` handler
- Call `showHint()` after showing the prompt indicator

### Task D3: Tests for slash commands

**Files:**
- Create: `src/__tests__/session-commands.test.ts`

**Tests:**
- `/help` shows command list
- `/leave` calls onLeave
- `/status` shows session info
- `/trust` only works for host
- Unknown command shows error
- Non-slash input returns false (not handled)

---

## Feature E: Seamless Connect/Disconnect

### Task E1: Graceful leave with session summary

**Files:**
- Modify: `src/commands/host.ts`
- Modify: `src/commands/join.ts`
- Modify: `src/ui.ts`

**Changes:**
- On `/leave` or Ctrl+C: show session summary (duration, messages sent, cost)
- Restore terminal background
- Clean exit back to shell prompt
- Don't `process.exit()` for `/leave` — just clean up and let the process end naturally

**UI addition:**
```typescript
showSessionSummary(summary: { duration: string, messageCount: number, cost?: number }): void {
  console.log("");
  console.log(pc.bold("  ✦ Session ended"));
  console.log(`  Duration: ${summary.duration}`);
  console.log(`  Messages: ${summary.messageCount}`);
  if (summary.cost !== undefined) {
    console.log(`  Cost: $${summary.cost.toFixed(4)}`);
  }
  console.log("");
}
```

### Task E2: Reconnect support

**Files:**
- Modify: `src/server.ts`
- Modify: `src/session.ts`

**Changes:**
- Server allows reconnection: if `guest_left` and same user reconnects within 5 min, accept
- Session tracks `lastDisconnect` timestamp
- On reconnect: broadcast `chat_received` with system message "Benji reconnected"

### Task E3: Tests for connect/disconnect

**Files:**
- Modify: `src/__tests__/integration.test.ts`

**Tests:**
- Guest can reconnect after disconnect
- Session summary shows correct stats
- `/leave` triggers clean shutdown

---

## Feature F: Update Existing Tests

### Task F1: Update ui.test.ts for new signatures

**Files:**
- Modify: `src/__tests__/ui.test.ts`

**Changes:**
- Update `showUserPrompt` tests: add `mode` parameter
- Add test for `showClaudeThinking()`
- Add test for `showHint()` / `clearHint()`
- Add test for `showSessionSummary()`
- Update `showApprovalRequest` test (now shows real prompt, not auto-approve)

### Task F2: Update integration tests

**Files:**
- Modify: `src/__tests__/integration.test.ts`

**Changes:**
- Update `TerminalUI` simulateInput calls to account for `@claude` prefix routing
- Test that chat messages don't go to Claude
- Test that `@claude` messages do go to Claude

---

## Parallel Execution Plan

These can run simultaneously:

| Agent | Tasks | Files touched |
|-------|-------|---------------|
| Agent 1 | C1, C2, C4 | `src/config.ts` (new), `src/commands/config.ts` (new), `src/__tests__/config.test.ts` (new), `src/index.ts` |
| Agent 2 | A1, A2, A5 | `src/protocol.ts`, `src/server.ts`, `src/client.ts`, `src/__tests__/chat.test.ts` (new) |
| Agent 3 | D1, D3 | `src/commands/session-commands.ts` (new), `src/__tests__/session-commands.test.ts` (new) |

Then sequentially (depends on agents above):

| Agent | Tasks | Files touched |
|-------|-------|---------------|
| Agent 4 | A3, A4, B1, B2, D2, E1, C3, F1, F2 | `src/ui.ts`, `src/commands/host.ts`, `src/commands/join.ts`, `src/router.ts`, `src/__tests__/ui.test.ts`, `src/__tests__/integration.test.ts` |
| Agent 5 | E2, E3, B3 | `src/server.ts`, `src/session.ts`, `src/__tests__/integration.test.ts` |

Note: Agents 4 and 5 both touch integration.test.ts — run Agent 5 after Agent 4.
