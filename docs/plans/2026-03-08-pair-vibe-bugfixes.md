# Claude-Duet Bug Fixes & Enhancements Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 4 user-reported issues: unclear join instructions, broken message visibility, basic README, and add terminal background color during sessions.

**Architecture:** All fixes target the existing console-based TerminalUI (`src/ui.ts`) and command files (`src/commands/host.ts`, `src/commands/join.ts`). Bug #2 requires adding stdin reading to the UI. Bug #4 adds ANSI escape sequences for background color.

**Tech Stack:** TypeScript, picocolors, Node.js readline, ANSI escape codes, vitest

---

## Bug Analysis

### Bug #1: Join Instructions Unclear
**Root cause:** `showWelcome()` in `src/ui.ts:17-24` shows session code and password separately, but the host also prints `Connect URL: ws://...` on a separate line (host.ts:51). The partner has to manually piece together `claude-duet join <code> --password <pw> --url <url>`. Additionally, `resolveSessionUrl()` in `src/commands/join.ts:72-77` just throws — session code doesn't resolve to anything.

### Bug #2: Messages Not Visible Between Host and Partner
**Root cause:** `TerminalUI.onInput()` (ui.ts:74-76) stores a handler, but **nothing reads stdin**. There's no `process.stdin` or `readline` setup. Neither host nor guest can type messages. Secondary issue: host.ts:106 broadcasts `prompt_received` and then router.ts:31-37 broadcasts it AGAIN, causing duplicates if stdin were working.

### Bug #3: README Needs Redesign
**Root cause:** README.md is 96 lines of basic markdown with no badges, no visual design, and incorrectly states "Ink-based terminal UI" when the active UI is console-based. Needs Claude Code branding and future product mention.

### Bug #4: Terminal Background Color During Session
**Root cause:** No ANSI background color codes used anywhere. Need to set a random accessible background on session start and restore on exit.

---

### Task 1: Add stdin input reading to TerminalUI

This is the critical Bug #2 fix — without stdin reading, no one can type.

**Files:**
- Modify: `src/ui.ts:8-85` (add readline setup)
- Test: `src/__tests__/ui.test.ts` (new file)

**Step 1: Write the failing test**

Create `src/__tests__/ui.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TerminalUI } from "../ui.js";

describe("TerminalUI", () => {
  let ui: TerminalUI;

  beforeEach(() => {
    // Suppress console output during tests
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    ui?.close();
    vi.restoreAllMocks();
  });

  it("stores input handler via onInput", () => {
    ui = new TerminalUI({ userName: "alice", role: "host" });
    const handler = vi.fn();
    ui.onInput(handler);
    // Handler is stored (internal) — we verify by simulating input
    ui.simulateInput("hello");
    expect(handler).toHaveBeenCalledWith("hello");
  });

  it("stores approval handler via onApproval", () => {
    ui = new TerminalUI({ userName: "alice", role: "host" });
    const handler = vi.fn();
    ui.onApproval(handler);
    ui.simulateApproval("p1", true);
    expect(handler).toHaveBeenCalledWith("p1", true);
  });

  it("calls startInputLoop to begin reading stdin", () => {
    ui = new TerminalUI({ userName: "alice", role: "host" });
    // startInputLoop should not throw
    expect(() => ui.startInputLoop()).not.toThrow();
  });

  it("showWelcome displays session info", () => {
    ui = new TerminalUI({ userName: "alice", role: "host" });
    ui.showWelcome("cd-abc123", "secret");
    expect(console.log).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/ui.test.ts`
Expected: FAIL — `simulateInput` and `startInputLoop` don't exist yet

**Step 3: Implement stdin reading**

Modify `src/ui.ts` to add:
1. A `startInputLoop()` method that creates a `readline.createInterface` on `process.stdin` and calls `inputHandler` on each line
2. A `simulateInput(text)` method for testing (calls inputHandler directly)
3. A `simulateApproval(promptId, approved)` method for testing
4. Update `close()` to clean up the readline interface

```typescript
import * as readline from "node:readline";

// In the class:
private rl?: readline.Interface;

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

close(): void {
  this.rl?.close();
  this.rl = undefined;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/ui.test.ts`
Expected: PASS — all 4 tests green

**Step 5: Commit**

```bash
git add src/ui.ts src/__tests__/ui.test.ts
git commit -m "fix: add stdin input reading to TerminalUI"
```

---

### Task 2: Wire stdin input in host and join commands

Now that TerminalUI can read stdin, wire it into the commands.

**Files:**
- Modify: `src/commands/host.ts:21,129` (call startInputLoop, close on exit)
- Modify: `src/commands/join.ts:11,69` (call startInputLoop, close on exit)

**Step 1: Write integration test for host input**

Add to `src/__tests__/integration.test.ts`:

```typescript
it("host can type messages via TerminalUI stdin", async () => {
  server = new ClaudeDuetServer({
    hostUser: "alice",
    password: "test1234",
  });
  const port = await server.start();

  const claude = new ClaudeBridge();
  const sendPromptSpy = vi.spyOn(claude, "sendPrompt").mockResolvedValue(undefined);

  const router = new PromptRouter(claude, server, {
    hostUser: "alice",
    approvalMode: false,
  });

  // Simulate the host command wiring
  const { TerminalUI } = await import("../ui.js");
  const ui = new TerminalUI({ userName: "alice", role: "host" });

  server.on("prompt", (msg) => router.handlePrompt(msg));

  ui.onInput((text) => {
    const msg = {
      type: "prompt" as const,
      id: `host-${Date.now()}`,
      user: "alice",
      text,
      timestamp: Date.now(),
    };
    router.handlePrompt(msg);
  });

  // Simulate typing
  ui.simulateInput("fix the tests");
  await new Promise((r) => setTimeout(r, 100));

  expect(sendPromptSpy).toHaveBeenCalledWith("alice", "fix the tests", { isHost: true });
  ui.close();
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/integration.test.ts`
Expected: FAIL if `simulateInput` not found (or PASS if Task 1 complete)

**Step 3: Add startInputLoop calls to commands**

In `src/commands/host.ts`, after creating the UI and wiring events, add:
```typescript
// After line ~51 (after ui.showSystem(`Connect URL: ...`))
ui.startInputLoop();
```

In `src/commands/join.ts`, after successful connection, add:
```typescript
// After line ~25 (after console.log(""))
ui.startInputLoop();
```

**Step 4: Run tests to verify**

Run: `npx vitest run`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/commands/host.ts src/commands/join.ts src/__tests__/integration.test.ts
git commit -m "fix: wire stdin reading in host and join commands"
```

---

### Task 3: Fix duplicate prompt_received broadcast

Host prompts are broadcast twice: once in host.ts:106 and again in router.ts:31-37.

**Files:**
- Modify: `src/commands/host.ts:97-108` (remove duplicate broadcast)
- Test: `src/__tests__/integration.test.ts` (add test)

**Step 1: Write the failing test**

Add to `src/__tests__/integration.test.ts`:

```typescript
it("host prompt is broadcast to guest exactly once", async () => {
  server = new ClaudeDuetServer({
    hostUser: "alice",
    password: "test1234",
  });
  const port = await server.start();

  const claude = new ClaudeBridge();
  vi.spyOn(claude, "sendPrompt").mockResolvedValue(undefined);

  const router = new PromptRouter(claude, server, {
    hostUser: "alice",
    approvalMode: false,
  });

  server.on("prompt", (msg) => router.handlePrompt(msg));

  client = new ClaudeDuetClient();
  await client.connect(`ws://localhost:${port}`, "bob", "test1234");

  const received: any[] = [];
  client.on("message", (msg) => {
    if (msg.type === "prompt_received") received.push(msg);
  });

  // Simulate host typing
  const msg = {
    type: "prompt" as const,
    id: "host-1",
    user: "alice",
    text: "hello bob",
    timestamp: Date.now(),
  };
  router.handlePrompt(msg);
  await new Promise((r) => setTimeout(r, 200));

  // Should receive EXACTLY one prompt_received, not two
  expect(received).toHaveLength(1);
  expect(received[0].user).toBe("alice");
  expect(received[0].text).toBe("hello bob");
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/integration.test.ts`
Expected: FAIL — `received` has length 2 (duplicate broadcast)

Wait — actually the host.ts `ui.onInput` handler currently does BOTH broadcast AND router.handlePrompt. But in this test we call `router.handlePrompt` directly, so we'd only get 1 broadcast from the router. The duplication only happens when going through the full host command flow.

Revised approach: The fix is to remove the `server.broadcast` from host.ts:106 since the router already does it. The test above should pass if we only call `router.handlePrompt`. Let's also add a test that simulates the full flow.

**Step 3: Remove duplicate broadcast from host.ts**

In `src/commands/host.ts`, change the `ui.onInput` handler (lines 97-108):

From:
```typescript
ui.onInput((text) => {
  const msg = {
    type: "prompt" as const,
    id: `host-${Date.now()}`,
    user: options.name,
    text,
    timestamp: Date.now(),
  };
  ui.showUserPrompt(options.name, text, true);
  server.broadcast({ type: "prompt_received", promptId: msg.id, user: msg.user, text: msg.text, timestamp: Date.now() });
  router.handlePrompt(msg);
});
```

To:
```typescript
ui.onInput((text) => {
  const msg = {
    type: "prompt" as const,
    id: `host-${Date.now()}`,
    user: options.name,
    text,
    timestamp: Date.now(),
  };
  ui.showUserPrompt(options.name, text, true);
  router.handlePrompt(msg);
});
```

The router's `handlePrompt()` already broadcasts `prompt_received` (router.ts:31-37), so the host.ts broadcast was a duplicate.

**Step 4: Run test to verify it passes**

Run: `npx vitest run`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/commands/host.ts src/__tests__/integration.test.ts
git commit -m "fix: remove duplicate prompt_received broadcast for host messages"
```

---

### Task 4: Show guest's own message locally

When the guest types a prompt, they don't see it locally — they only see it if the server echoes it back. Add local display.

**Files:**
- Modify: `src/commands/join.ts:54-56` (show own message locally)
- Modify: `src/commands/join.ts:31-51` (skip prompt_received for own messages to avoid duplicates)

**Step 1: Write the failing test**

This is hard to unit test since it's command wiring. We'll test the logic pattern:

Add to `src/__tests__/ui.test.ts`:

```typescript
it("showUserPrompt displays formatted message", () => {
  ui = new TerminalUI({ userName: "bob", role: "guest" });
  ui.showUserPrompt("bob", "hello world", false);
  expect(console.log).toHaveBeenCalled();
  // Verify the output includes the user name and message
  const calls = (console.log as any).mock.calls;
  const output = calls.map((c: any[]) => c.join(" ")).join("\n");
  expect(output).toContain("bob");
  expect(output).toContain("hello world");
});
```

**Step 2: Run test to verify it passes (this is a characterization test)**

Run: `npx vitest run src/__tests__/ui.test.ts`
Expected: PASS — this verifies `showUserPrompt` works

**Step 3: Fix guest input display**

In `src/commands/join.ts`, modify the `onInput` handler:

From:
```typescript
ui.onInput((text) => {
  client.sendPrompt(text);
});
```

To:
```typescript
ui.onInput((text) => {
  ui.showUserPrompt(options.name, text, false);
  client.sendPrompt(text);
});
```

And add deduplication in the message handler — skip `prompt_received` if user matches self:

From:
```typescript
client.on("message", (msg) => {
  switch (msg.type) {
    case "prompt_received":
      ui.showUserPrompt(msg.user, msg.text, false);
      break;
```

To:
```typescript
client.on("message", (msg) => {
  switch (msg.type) {
    case "prompt_received":
      // Skip own messages (already shown locally when typed)
      if (msg.user === options.name) break;
      ui.showUserPrompt(msg.user, msg.text, false);
      break;
```

**Step 4: Run tests to verify**

Run: `npx vitest run`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/commands/join.ts src/__tests__/ui.test.ts
git commit -m "fix: show guest's own message locally, deduplicate echoed messages"
```

---

### Task 5: Host skips own prompt_received from router broadcast

Same deduplication on the host side — the router broadcasts prompt_received for ALL prompts, including host's own. The host already shows own message via `ui.showUserPrompt` in the onInput handler (host.ts:105). Need to ensure the broadcast echo doesn't display it again.

**Files:**
- Modify: `src/commands/host.ts:117-121` (filter out own prompt_received)

**Step 1: Verify the current behavior**

Read `src/commands/host.ts:117-121` — the host currently only listens for `approval_request` from `server_message`. The `prompt_received` from the router broadcast goes to `server.broadcast` → `emit("server_message")` → but host doesn't handle `prompt_received` there, so it's already ignored locally. No fix needed here.

However, the host DOES handle guest prompts via `server.on("prompt")` at host.ts:83-86, which shows the guest's message. The router then broadcasts `prompt_received` for the same message. Check if the host's `server_message` listener catches it — it doesn't (only handles `approval_request`). So the host is fine.

**Actually:** The host already shows the guest message at host.ts:84 (`ui.showUserPrompt(msg.user, msg.text, false)`), and the router's `prompt_received` broadcast is only sent to the WebSocket guest (not displayed locally by host since host.ts:117-121 filters for approval_request only). So NO duplicate on host side.

**This task is already handled — skip it. Mark as N/A.**

**Step 2: Run all tests to confirm nothing is broken**

Run: `npx vitest run`
Expected: All tests PASS

---

### Task 6: Generate copy-paste join command for host

The host needs to show a single command the partner can copy and share.

**Files:**
- Modify: `src/ui.ts:17-24` (update showWelcome to accept URL, generate one-liner)
- Modify: `src/commands/host.ts:50-51` (pass URL to showWelcome)
- Test: `src/__tests__/ui.test.ts` (add test for join command output)

**Step 1: Write the failing test**

Add to `src/__tests__/ui.test.ts`:

```typescript
it("showWelcome displays a copy-paste join command", () => {
  ui = new TerminalUI({ userName: "alice", role: "host" });
  ui.showWelcome("cd-abc123", "secret", "ws://192.168.1.5:4567");
  const calls = (console.log as any).mock.calls;
  const output = calls.map((c: any[]) => c.join(" ")).join("\n");
  // Should contain the full join command
  expect(output).toContain("npx claude-duet join cd-abc123 --password secret --url ws://192.168.1.5:4567");
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/ui.test.ts`
Expected: FAIL — `showWelcome` doesn't accept a URL parameter yet

**Step 3: Update showWelcome to generate join command**

In `src/ui.ts`, modify `showWelcome`:

```typescript
showWelcome(sessionCode: string, password: string, connectUrl?: string): void {
  console.log("");
  console.log(pc.bold(pc.cyan("  ✦ claude-duet session started")));
  console.log(`  Session code: ${pc.bold(sessionCode)}`);
  console.log(`  Password: ${pc.bold(password)}`);
  if (connectUrl) {
    console.log(`  Connect URL: ${pc.bold(connectUrl)}`);
    console.log("");
    console.log(pc.bold("  Share this command with your partner:"));
    console.log("");
    const joinCmd = `npx claude-duet join ${sessionCode} --password ${password} --url ${connectUrl}`;
    console.log(`  ${pc.green(pc.bold(joinCmd))}`);
  } else {
    console.log(`  Share these with your partner to join.`);
  }
  console.log("");
}
```

In `src/commands/host.ts`, pass the URL to showWelcome:

Change:
```typescript
ui.showWelcome(session.code, session.password);
ui.showSystem(`Connect URL: ${connInfo.displayUrl}`);
```

To:
```typescript
ui.showWelcome(session.code, session.password, connInfo.displayUrl);
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/ui.ts src/commands/host.ts src/__tests__/ui.test.ts
git commit -m "feat: show copy-paste join command when hosting a session"
```

---

### Task 7: Add Slack-friendly share message

Add a method that formats a share message for Slack/chat. Show it below the join command.

**Files:**
- Modify: `src/ui.ts` (add `getShareMessage` method, show in `showWelcome`)
- Test: `src/__tests__/ui.test.ts` (test share message)

**Step 1: Write the failing test**

Add to `src/__tests__/ui.test.ts`:

```typescript
it("showWelcome includes a Slack-friendly share message", () => {
  ui = new TerminalUI({ userName: "alice", role: "host" });
  ui.showWelcome("cd-abc123", "secret", "ws://192.168.1.5:4567");
  const calls = (console.log as any).mock.calls;
  const output = calls.map((c: any[]) => c.join(" ")).join("\n");
  // Should include clipboard-friendly Slack text
  expect(output).toContain("claude-duet");
  expect(output).toContain("Slack");
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/ui.test.ts`
Expected: FAIL — no "Slack" text in output yet

**Step 3: Add Slack share section to showWelcome**

In `src/ui.ts`, update the `showWelcome` method. After the join command, add:

```typescript
if (connectUrl) {
  // ... existing join command display ...
  console.log("");
  console.log(pc.dim("  Slack-friendly message (copy & share):"));
  const slackMsg = `Hey! Join my claude-duet session:\n\`npx claude-duet join ${sessionCode} --password ${password} --url ${connectUrl}\``;
  console.log(pc.dim(`  ${slackMsg}`));
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/ui.ts src/__tests__/ui.test.ts
git commit -m "feat: add Slack-friendly share message to host welcome"
```

---

### Task 8: Auto-install via npx in join command

The join command shown to partners uses `npx claude-duet join ...` which auto-installs. But `resolveSessionUrl()` currently throws an error. The session code is purely decorative. Since we always need `--url`, ensure the UX is clear.

**Files:**
- Modify: `src/commands/join.ts:72-77` (improve error message)
- Modify: `src/index.ts:33-50` (make --password and --url required together, improve help)

**Step 1: Write the failing test**

Add to `src/__tests__/ui.test.ts`:

```typescript
it("resolveSessionUrl gives helpful error when --url not provided", async () => {
  // We test this indirectly — the error message should be helpful
  const { joinCommand } = await import("../commands/join.js");
  // Mock process.exit to prevent test from exiting
  const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => { throw new Error("exit"); });
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  try {
    await joinCommand("cd-test123", { name: "bob", password: "pw" });
  } catch {
    // Expected — process.exit or thrown error
  }

  // The error should mention --url
  const errorOutput = errorSpy.mock.calls.map(c => c.join(" ")).join("\n");
  expect(errorOutput).toContain("--url");
  exitSpy.mockRestore();
});
```

**Step 2: Run test — this may already pass with current error**

Run: `npx vitest run src/__tests__/ui.test.ts`
Expected: May PASS or FAIL depending on error path

**Step 3: Improve the error message**

In `src/commands/join.ts`, update `resolveSessionUrl`:

```typescript
async function resolveSessionUrl(sessionCode: string): Promise<string> {
  throw new Error(
    `Session discovery not available — use --url to connect directly.\n` +
    `  Ask the host for the join command, or run:\n` +
    `  claude-duet join ${sessionCode} --password <password> --url ws://<host-ip>:<port>`
  );
}
```

**Step 4: Run tests to verify**

Run: `npx vitest run`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/commands/join.ts src/__tests__/ui.test.ts
git commit -m "fix: improve error message when --url not provided in join"
```

---

### Task 9: Terminal background color on session start

Set a random accessible background color when a session starts, restore on exit.

**Files:**
- Create: `src/terminal-colors.ts` (color utilities)
- Test: `src/__tests__/terminal-colors.test.ts` (new)
- Modify: `src/ui.ts` (apply/restore background)

**Step 1: Write the failing test**

Create `src/__tests__/terminal-colors.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { pickSessionBackground, applyBackground, restoreBackground } from "../terminal-colors.js";

describe("terminal-colors", () => {
  it("pickSessionBackground returns an ANSI escape code", () => {
    const bg = pickSessionBackground();
    // Should start with ESC[
    expect(bg.apply).toMatch(/^\x1b\[/);
  });

  it("pickSessionBackground returns different colors across calls", () => {
    const colors = new Set<string>();
    for (let i = 0; i < 20; i++) {
      colors.add(pickSessionBackground().name);
    }
    // Should have at least 2 different colors over 20 calls
    expect(colors.size).toBeGreaterThan(1);
  });

  it("applyBackground returns an ANSI string", () => {
    const bg = pickSessionBackground();
    const result = applyBackground(bg);
    expect(typeof result).toBe("string");
    expect(result).toContain("\x1b[");
  });

  it("restoreBackground returns reset sequence", () => {
    const result = restoreBackground();
    expect(result).toContain("\x1b[");
  });

  it("picks colors with good text contrast", () => {
    const bg = pickSessionBackground();
    // textColor should be either light or dark
    expect(["white", "black"]).toContain(bg.textColor);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/terminal-colors.test.ts`
Expected: FAIL — `src/terminal-colors.ts` doesn't exist yet

**Step 3: Create terminal-colors.ts**

Create `src/terminal-colors.ts`:

```typescript
export interface SessionBackground {
  name: string;
  apply: string;       // ANSI escape to set background
  textColor: "white" | "black";  // For accessible text
}

// Curated dark backgrounds that work well with terminal text
// All chosen for readability with white text
const BACKGROUNDS: SessionBackground[] = [
  { name: "deep-purple",  apply: "\x1b[48;2;30;20;60m",   textColor: "white" },
  { name: "midnight-blue", apply: "\x1b[48;2;15;25;55m",  textColor: "white" },
  { name: "dark-teal",    apply: "\x1b[48;2;10;40;45m",   textColor: "white" },
  { name: "deep-green",   apply: "\x1b[48;2;15;35;25m",   textColor: "white" },
  { name: "dark-plum",    apply: "\x1b[48;2;45;20;45m",   textColor: "white" },
  { name: "navy",         apply: "\x1b[48;2;10;15;45m",   textColor: "white" },
  { name: "dark-maroon",  apply: "\x1b[48;2;45;15;20m",   textColor: "white" },
  { name: "charcoal-violet", apply: "\x1b[48;2;35;25;50m", textColor: "white" },
];

export function pickSessionBackground(): SessionBackground {
  const idx = Math.floor(Math.random() * BACKGROUNDS.length);
  return BACKGROUNDS[idx];
}

export function applyBackground(bg: SessionBackground): string {
  // Set background for entire terminal using ANSI
  // \x1b[2J clears screen, bg.apply sets background for new content
  return `${bg.apply}`;
}

export function restoreBackground(): string {
  // Reset all attributes including background
  return "\x1b[0m\x1b[49m";
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/terminal-colors.test.ts`
Expected: All 5 tests PASS

**Step 5: Commit**

```bash
git add src/terminal-colors.ts src/__tests__/terminal-colors.test.ts
git commit -m "feat: add terminal background color utilities for session"
```

---

### Task 10: Apply background color in TerminalUI

Wire the background color into the UI lifecycle.

**Files:**
- Modify: `src/ui.ts` (apply on welcome, restore on close)
- Test: `src/__tests__/ui.test.ts` (test background applied)

**Step 1: Write the failing test**

Add to `src/__tests__/ui.test.ts`:

```typescript
it("applies terminal background on showWelcome", () => {
  const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  ui = new TerminalUI({ userName: "alice", role: "host" });
  ui.showWelcome("cd-abc123", "secret", "ws://localhost:3000");

  // Check that an ANSI background escape was written
  const allWrites = writeSpy.mock.calls.map(c => String(c[0])).join("");
  expect(allWrites).toContain("\x1b[48;2;");
});

it("restores terminal background on close", () => {
  const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  ui = new TerminalUI({ userName: "alice", role: "host" });
  ui.showWelcome("cd-abc123", "secret", "ws://localhost:3000");
  ui.close();

  const allWrites = writeSpy.mock.calls.map(c => String(c[0])).join("");
  // Should contain reset sequence
  expect(allWrites).toContain("\x1b[0m");
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/ui.test.ts`
Expected: FAIL — no background escape written yet

**Step 3: Wire background color into TerminalUI**

In `src/ui.ts`, add:

```typescript
import { pickSessionBackground, applyBackground, restoreBackground, type SessionBackground } from "./terminal-colors.js";

// In the class, add field:
private background?: SessionBackground;

// In showWelcome, before the first console.log:
this.background = pickSessionBackground();
process.stdout.write(applyBackground(this.background));

// In close():
close(): void {
  this.rl?.close();
  this.rl = undefined;
  if (this.background) {
    process.stdout.write(restoreBackground());
    this.background = undefined;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/ui.ts src/__tests__/ui.test.ts
git commit -m "feat: apply random background color during claude-duet session"
```

---

### Task 11: Redesign README

**Files:**
- Modify: `README.md` (full rewrite)

**Step 1: No test needed for README — this is documentation**

**Step 2: Rewrite README.md**

Key changes:
1. Add badges (npm version, license, CI status)
2. Mention "Currently supports Claude Code" + future product plans
3. Better visual structure with emojis and sections
4. Fix "Ink-based terminal UI" claim (it's console-based)
5. Add "How to Share" section showing the one-liner
6. Add visual ASCII art or styled header

New README content:

```markdown
<div align="center">

# ✦ claude-duet

**Two developers, one Claude. Claude duet coding in real-time.**

[![npm version](https://img.shields.io/npm/v/claude-duet)](https://www.npmjs.com/package/claude-duet)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Share your AI coding session with a partner. Host runs the AI,
partner sends prompts — both see everything in real-time.

</div>

---

> **Currently supports [Claude Code](https://claude.ai/code) (Anthropic's CLI).**
> Support for other AI coding tools (Codex CLI, Gemini CLI, etc.) is planned for future releases.

## Quick Start

```bash
# Host a session (installs automatically via npx)
npx claude-duet host

# Share the join command shown in your terminal with your partner
# They run it — that's it!
```

The host terminal will display a ready-to-share command like:

```
npx claude-duet join cd-a1b2c3d4 --password mypassword --url ws://192.168.1.5:4567
```

Send it via Slack, Discord, or any chat. Your partner runs it and you're paired up.

## How It Works

```
┌──────────────┐     WebSocket      ┌──────────────┐
│   Host       │◄──────────────────►│   Partner    │
│   Claude Code│     encrypted      │   Terminal   │
│   + Server   │                    │   Client     │
└──────────────┘                    └──────────────┘
```

1. **Host** runs Claude Code locally via the Agent SDK and starts a WebSocket server
2. **Partner** connects and sends prompts to the shared session
3. **Both** see Claude's responses stream in real-time
4. All communication is **end-to-end encrypted** (NaCl secretbox)
5. **Approval mode** (default): host reviews partner prompts before execution

## Connection Modes

| Mode | Command | Use Case |
|------|---------|----------|
| **LAN Direct** | `npx claude-duet host` | Same network, zero config |
| **SSH Tunnel** | `ssh -L 3000:localhost:3000 host` | Remote, proven security |
| **Cloudflare Tunnel** | `npx claude-duet host --tunnel cloudflare` | Remote, no server needed |
| **Self-hosted Relay** | `npx claude-duet host --relay wss://relay.example.com` | Custom infrastructure |

## Security

- **E2E Encryption** — NaCl secretbox (XSalsa20-Poly1305) with scrypt key derivation
- **Approval Mode** — Host reviews partner prompts before execution (on by default)
- **No Third-Party Relay** — LAN direct is default; SSH recommended for remote
- **Host Controls** — All Claude Code operations run on the host machine only

## Commands

```
npx claude-duet                          # Interactive wizard
npx claude-duet host                     # Host on LAN (default)
npx claude-duet host --no-approval       # Host without approval mode
npx claude-duet host --tunnel cloudflare # Host via Cloudflare tunnel
npx claude-duet relay                    # Run a relay server
npx claude-duet join <code> --password <pw> --url <url>  # Join a session
```

## Session Commands

| Command | Description |
|---------|-------------|
| `Ctrl+C` | Graceful shutdown with session summary |

## Roadmap

- [ ] Support for additional AI coding tools (Codex CLI, Gemini CLI, etc.)
- [ ] Rich terminal UI with Ink (React for the terminal)
- [ ] Session recording and playback
- [ ] Multi-guest sessions

## Development

```bash
git clone https://github.com/elirang/claude-duet.git
cd claude-duet
npm install
npm run build
npm test
```

## License

[MIT](LICENSE)

---

<div align="center">
<sub>Built with Claude Code ✦</sub>
</div>
```

**Step 3: Write the file**

Save the README content above.

**Step 4: Commit**

```bash
git add README.md
git commit -m "docs: redesign README with Claude Code branding and future product roadmap"
```

---

### Task 12: End-to-end verification

Manually verify the product works by running tests and checking the build.

**Files:** None (verification only)

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS (including new ui.test.ts and terminal-colors.test.ts)

**Step 2: Build the project**

Run: `npm run build`
Expected: No TypeScript errors

**Step 3: Verify the CLI help**

Run: `node dist/index.js --help`
Expected: Shows claude-duet commands

**Step 4: Verify host command starts**

Run: `node dist/index.js host --name testhost -p 0`
Expected: Shows the ✦ claude-duet session started banner with a copy-paste join command, terminal background color changes. `Ctrl+C` to exit, background restores.

**Step 5: Commit any final fixes if needed**

---

## Task Summary

| Task | Bug | Description | Files |
|------|-----|-------------|-------|
| 1 | #2 | Add stdin input reading to TerminalUI | ui.ts, ui.test.ts |
| 2 | #2 | Wire stdin in host and join commands | host.ts, join.ts, integration.test.ts |
| 3 | #2 | Fix duplicate prompt_received broadcast | host.ts, integration.test.ts |
| 4 | #2 | Show guest's own message locally | join.ts, ui.test.ts |
| 5 | #2 | (N/A — host side already correct) | — |
| 6 | #1 | Generate copy-paste join command | ui.ts, host.ts, ui.test.ts |
| 7 | #1 | Add Slack-friendly share message | ui.ts, ui.test.ts |
| 8 | #1 | Improve --url error message | join.ts, ui.test.ts |
| 9 | #4 | Terminal background color utilities | terminal-colors.ts, terminal-colors.test.ts |
| 10 | #4 | Wire background color into UI | ui.ts, ui.test.ts |
| 11 | #3 | Redesign README | README.md |
| 12 | all | End-to-end verification | — |
