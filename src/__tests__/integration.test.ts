import { describe, it, expect, vi, afterEach } from "vitest";
import { PairVibeServer } from "../server.js";
import { PairVibeClient } from "../client.js";
import { PromptRouter } from "../router.js";
import { ClaudeBridge } from "../claude.js";
import { TerminalUI } from "../ui.js";

// Mock the Claude Agent SDK to avoid real API calls
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
}));

describe("integration: host + guest full flow", () => {
  let server: PairVibeServer;
  let client: PairVibeClient;
  let ui: TerminalUI | undefined;

  afterEach(async () => {
    ui?.close();
    ui = undefined;
    if (client) {
      await client.disconnect();
      client = undefined!;
    }
    if (server) {
      await server.stop();
      server = undefined!;
    }
  });

  it("guest connects, sends prompt, host approves, Claude responds", async () => {
    // Setup host
    server = new PairVibeServer({
      hostUser: "alice",
      password: "test1234",
      approvalMode: true,
    });
    const port = await server.start();

    const claude = new ClaudeBridge();
    const router = new PromptRouter(claude, server, {
      hostUser: "alice",
      approvalMode: true,
    });

    // Wire server events to router
    server.on("prompt", (msg) => router.handlePrompt(msg));

    // Track approval requests emitted locally via broadcast
    const approvalRequests: any[] = [];
    server.on("server_message", (msg) => {
      if (msg.type === "approval_request") {
        approvalRequests.push(msg);
      }
    });

    // Guest connects
    client = new PairVibeClient();
    await client.connect(`ws://localhost:${port}`, "bob", "test1234");

    // Guest sends prompt
    client.sendPrompt("fix the bug");
    await new Promise((r) => setTimeout(r, 100));

    // Verify approval was requested
    expect(approvalRequests).toHaveLength(1);
    expect(approvalRequests[0].user).toBe("bob");
    expect(approvalRequests[0].text).toBe("fix the bug");

    // Host approves — mock sendPrompt to avoid real SDK call
    const sendPromptSpy = vi
      .spyOn(claude, "sendPrompt")
      .mockResolvedValue(undefined);
    await router.handleApproval({
      promptId: approvalRequests[0].promptId,
      approved: true,
    });

    // Verify Claude was called
    expect(sendPromptSpy).toHaveBeenCalledWith("bob", "fix the bug", {
      isHost: false,
    });
  });

  it("host can type messages via TerminalUI simulateInput", async () => {
    // Test the UI → handler → claude wiring pattern (no real server needed)
    const claude = new ClaudeBridge();
    const sendPromptSpy = vi.spyOn(claude, "sendPrompt").mockResolvedValue(undefined);

    ui = new TerminalUI({ userName: "alice", role: "host" });
    vi.spyOn(console, "log").mockImplementation(() => {});

    ui.onInput((text) => {
      claude.sendPrompt("alice", text, { isHost: true });
    });

    // Simulate typing via the test helper
    ui.simulateInput("fix the tests");
    await new Promise((r) => setTimeout(r, 50));

    expect(sendPromptSpy).toHaveBeenCalledWith("alice", "fix the tests", { isHost: true });
  });

  it("host prompt is broadcast to guest exactly once", async () => {
    server = new PairVibeServer({
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

    client = new PairVibeClient();
    await client.connect(`ws://localhost:${port}`, "bob", "test1234");

    const received: any[] = [];
    client.on("message", (msg) => {
      if (msg.type === "prompt_received") received.push(msg);
    });

    // Simulate host typing — only router.handlePrompt (not a second broadcast)
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

  it("guest receives streamed responses", async () => {
    server = new PairVibeServer({
      hostUser: "alice",
      password: "test1234",
    });
    const port = await server.start();

    client = new PairVibeClient();
    await client.connect(`ws://localhost:${port}`, "bob", "test1234");

    const messages: any[] = [];
    client.on("message", (msg) => messages.push(msg));

    // Simulate Claude streaming via server broadcast
    server.broadcast({
      type: "stream_chunk",
      text: "Here ",
      timestamp: Date.now(),
    });
    server.broadcast({
      type: "stream_chunk",
      text: "is the fix",
      timestamp: Date.now(),
    });
    server.broadcast({
      type: "turn_complete",
      cost: 0.01,
      durationMs: 1500,
      timestamp: Date.now(),
    });

    await new Promise((r) => setTimeout(r, 100));

    expect(messages).toHaveLength(3);
    expect(messages[0].text).toBe("Here ");
    expect(messages[1].text).toBe("is the fix");
    expect(messages[2].type).toBe("turn_complete");
  });
});
