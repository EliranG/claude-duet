import { describe, it, expect, vi, afterEach } from "vitest";
import { ClaudeDuetServer } from "../server.js";
import { ClaudeDuetClient } from "../client.js";
import { PromptRouter } from "../router.js";
import { ClaudeBridge } from "../claude.js";
import { TerminalUI } from "../ui.js";

const TEST_PASSWORD = "test1234";
const TEST_SESSION_CODE = "cd-test1234";

describe("integration: host + guest full flow", () => {
  let server: ClaudeDuetServer;
  let client: ClaudeDuetClient;
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
    server = new ClaudeDuetServer({
      hostUser: "eliran",
      password: TEST_PASSWORD,
      sessionCode: TEST_SESSION_CODE,
      approvalMode: true,
    });
    const port = await server.start();

    const claude = new ClaudeBridge();
    const router = new PromptRouter(claude, server, {
      hostUser: "eliran",
      approvalMode: true,
    });

    server.on("prompt", (msg) => router.handlePrompt(msg));

    const approvalRequests: Record<string, unknown>[] = [];
    server.on("server_message", (msg) => {
      if (msg.type === "approval_request") {
        approvalRequests.push(msg);
      }
    });

    client = new ClaudeDuetClient();
    await client.connect(`ws://localhost:${port}`, "benji", TEST_PASSWORD, TEST_SESSION_CODE);

    client.sendPrompt("fix the bug");
    await new Promise((r) => setTimeout(r, 100));

    expect(approvalRequests).toHaveLength(1);
    expect(approvalRequests[0].user).toBe("benji");
    expect(approvalRequests[0].text).toBe("fix the bug");

    const sendPromptSpy = vi
      .spyOn(claude, "sendPrompt")
      .mockReturnValue(undefined);
    await router.handleApproval({
      promptId: approvalRequests[0].promptId as string,
      approved: true,
    });

    expect(sendPromptSpy).toHaveBeenCalledWith("benji", "fix the bug", {
      isHost: false,
    });
  });

  it("host can type messages via TerminalUI simulateInput", async () => {
    const claude = new ClaudeBridge();
    const sendPromptSpy = vi.spyOn(claude, "sendPrompt").mockReturnValue(undefined);

    ui = new TerminalUI({ userName: "eliran", role: "host" });
    vi.spyOn(console, "log").mockImplementation(() => {});

    ui.onInput((text) => {
      claude.sendPrompt("eliran", text, { isHost: true });
    });

    ui.simulateInput("fix the tests");
    await new Promise((r) => setTimeout(r, 50));

    expect(sendPromptSpy).toHaveBeenCalledWith("eliran", "fix the tests", { isHost: true });
  });

  it("host prompt is broadcast to guest exactly once", async () => {
    server = new ClaudeDuetServer({
      hostUser: "eliran",
      password: TEST_PASSWORD,
      sessionCode: TEST_SESSION_CODE,
    });
    const port = await server.start();

    const claude = new ClaudeBridge();
    vi.spyOn(claude, "sendPrompt").mockReturnValue(undefined);

    const router = new PromptRouter(claude, server, {
      hostUser: "eliran",
      approvalMode: false,
    });

    client = new ClaudeDuetClient();
    await client.connect(`ws://localhost:${port}`, "benji", TEST_PASSWORD, TEST_SESSION_CODE);

    const received: Record<string, unknown>[] = [];
    client.on("message", (msg) => {
      if (msg.type === "prompt_received") received.push(msg);
    });

    const msg = {
      type: "prompt" as const,
      id: "host-1",
      user: "eliran",
      text: "hello benji",
      source: "host" as const,
      timestamp: Date.now(),
    };
    router.handlePrompt(msg);
    await new Promise((r) => setTimeout(r, 200));

    expect(received).toHaveLength(1);
    expect(received[0].user).toBe("eliran");
    expect(received[0].text).toBe("hello benji");
  });

  it("chat messages are not sent to Claude", async () => {
    server = new ClaudeDuetServer({
      hostUser: "eliran",
      password: TEST_PASSWORD,
      sessionCode: TEST_SESSION_CODE,
    });
    const port = await server.start();

    const claude = new ClaudeBridge();
    const sendPromptSpy = vi.spyOn(claude, "sendPrompt").mockReturnValue(undefined);

    client = new ClaudeDuetClient();
    await client.connect(`ws://localhost:${port}`, "benji", TEST_PASSWORD, TEST_SESSION_CODE);

    client.sendChat("just chatting");
    await new Promise((r) => setTimeout(r, 100));

    expect(sendPromptSpy).not.toHaveBeenCalled();
  });

  it("guest receives streamed responses", async () => {
    server = new ClaudeDuetServer({
      hostUser: "eliran",
      password: TEST_PASSWORD,
      sessionCode: TEST_SESSION_CODE,
    });
    const port = await server.start();

    client = new ClaudeDuetClient();
    await client.connect(`ws://localhost:${port}`, "benji", TEST_PASSWORD, TEST_SESSION_CODE);

    const messages: Record<string, unknown>[] = [];
    client.on("message", (msg) => messages.push(msg));

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
