import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClaudeBridge, type ClaudeEvent } from "../claude.js";
import { spawn } from "node:child_process";
import { PassThrough } from "node:stream";
import { EventEmitter } from "node:events";

// Mock child_process.spawn at the module level
vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

function createMockProcess() {
  const proc = new EventEmitter() as any;
  proc.stdout = new PassThrough();
  proc.stderr = new PassThrough();
  proc.stdin = new PassThrough();
  proc.stdin.writable = true;
  proc.kill = vi.fn();
  proc.pid = 12345;
  return proc;
}

/** Write an NDJSON line to mock stdout and wait a tick for readline to process it */
async function writeLine(proc: any, obj: Record<string, unknown>) {
  proc.stdout.write(JSON.stringify(obj) + "\n");
  // readline processes data asynchronously — give it a tick
  await new Promise((r) => setTimeout(r, 10));
}

describe("ClaudeBridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // formatPrompt
  // ---------------------------------------------------------------------------

  it("formats prompts with user attribution", () => {
    const bridge = new ClaudeBridge();
    expect(bridge.formatPrompt("benji", "fix the bug")).toBe(
      "[benji]: fix the bug",
    );
  });

  it("formats host prompts with (host) label", () => {
    const bridge = new ClaudeBridge();
    expect(bridge.formatPrompt("eliran", "do something", { isHost: true })).toBe(
      "[eliran (host)]: do something",
    );
  });

  // ---------------------------------------------------------------------------
  // EventEmitter interface
  // ---------------------------------------------------------------------------

  it("emits events from the event emitter interface", () => {
    const bridge = new ClaudeBridge();
    const events: ClaudeEvent[] = [];
    bridge.on("event", (e) => events.push(e));
    bridge.emit("event", { type: "stream_chunk", text: "hello" });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("stream_chunk");
  });

  // ---------------------------------------------------------------------------
  // buildArgs — spawn arg verification
  // ---------------------------------------------------------------------------

  it("builds correct args for auto permission mode", async () => {
    const mockProc = createMockProcess();
    vi.mocked(spawn).mockReturnValue(mockProc as any);

    const bridge = new ClaudeBridge();
    await bridge.start();

    const args: string[] = vi.mocked(spawn).mock.calls[0][1] as string[];

    expect(args).toContain("-p");
    expect(args).toContain("--output-format");
    expect(args).toContain("stream-json");
    expect(args).toContain("--input-format");
    expect(args).toContain("--verbose");
    expect(args).toContain("--allowedTools");
  });

  it("builds correct args for interactive permission mode", async () => {
    const mockProc = createMockProcess();
    vi.mocked(spawn).mockReturnValue(mockProc as any);

    const bridge = new ClaudeBridge({ permissionMode: "interactive" });
    await bridge.start();

    const args: string[] = vi.mocked(spawn).mock.calls[0][1] as string[];

    expect(args).toContain("-p");
    expect(args).toContain("--output-format");
    expect(args).toContain("stream-json");
    expect(args).not.toContain("--allowedTools");
  });

  it("builds correct args with --continue", async () => {
    const mockProc = createMockProcess();
    vi.mocked(spawn).mockReturnValue(mockProc as any);

    const bridge = new ClaudeBridge({ continue: true });
    await bridge.start();

    const args: string[] = vi.mocked(spawn).mock.calls[0][1] as string[];
    expect(args).toContain("--continue");
  });

  it("builds correct args with --resume", async () => {
    const mockProc = createMockProcess();
    vi.mocked(spawn).mockReturnValue(mockProc as any);

    const bridge = new ClaudeBridge({ resume: "abc-123" });
    await bridge.start();

    const args: string[] = vi.mocked(spawn).mock.calls[0][1] as string[];
    expect(args).toContain("--resume");
    expect(args).toContain("abc-123");
  });

  // ---------------------------------------------------------------------------
  // NDJSON parsing — event emission
  // ---------------------------------------------------------------------------

  it("parses system init message and emits session_init", async () => {
    const mockProc = createMockProcess();
    vi.mocked(spawn).mockReturnValue(mockProc as any);

    const bridge = new ClaudeBridge();
    const events: ClaudeEvent[] = [];
    bridge.on("event", (e) => events.push(e));

    await bridge.start();

    await writeLine(mockProc, {
      type: "system",
      subtype: "init",
      session_id: "test-session-123",
      tools: ["Bash", "Edit"],
      model: "claude-opus-4-6",
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "session_init",
      sessionId: "test-session-123",
    });
    expect(bridge.getSessionId()).toBe("test-session-123");
  });

  it("parses assistant text blocks and emits stream_chunk", async () => {
    const mockProc = createMockProcess();
    vi.mocked(spawn).mockReturnValue(mockProc as any);

    const bridge = new ClaudeBridge();
    const events: ClaudeEvent[] = [];
    bridge.on("event", (e) => events.push(e));

    await bridge.start();

    await writeLine(mockProc, {
      type: "assistant",
      message: {
        content: [{ type: "text", text: "hello world" }],
      },
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "stream_chunk",
      text: "hello world",
    });
  });

  it("parses assistant tool_use blocks and emits tool_use", async () => {
    const mockProc = createMockProcess();
    vi.mocked(spawn).mockReturnValue(mockProc as any);

    const bridge = new ClaudeBridge();
    const events: ClaudeEvent[] = [];
    bridge.on("event", (e) => events.push(e));

    await bridge.start();

    await writeLine(mockProc, {
      type: "assistant",
      message: {
        content: [
          { type: "tool_use", name: "Edit", input: { file: "test.ts" } },
        ],
      },
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "tool_use",
      tool: "Edit",
      input: { file: "test.ts" },
    });
  });

  it("skips thinking blocks", async () => {
    const mockProc = createMockProcess();
    vi.mocked(spawn).mockReturnValue(mockProc as any);

    const bridge = new ClaudeBridge();
    const events: ClaudeEvent[] = [];
    bridge.on("event", (e) => events.push(e));

    await bridge.start();

    await writeLine(mockProc, {
      type: "assistant",
      message: {
        content: [
          {
            type: "thinking",
            thinking: "Let me consider this...",
          },
        ],
      },
    });

    expect(events).toHaveLength(0);
  });

  it("parses result message and emits turn_complete", async () => {
    const mockProc = createMockProcess();
    vi.mocked(spawn).mockReturnValue(mockProc as any);

    const bridge = new ClaudeBridge();
    const events: ClaudeEvent[] = [];
    bridge.on("event", (e) => events.push(e));

    await bridge.start();

    await writeLine(mockProc, {
      type: "result",
      subtype: "success",
      total_cost_usd: 0.05,
      duration_ms: 1500,
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "turn_complete",
      cost: 0.05,
      durationMs: 1500,
    });
  });

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  it("reports busy state correctly", () => {
    const bridge = new ClaudeBridge();
    expect(bridge.isBusy()).toBe(false);
  });
});
