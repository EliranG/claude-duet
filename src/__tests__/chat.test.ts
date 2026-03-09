import { describe, it, expect, afterEach } from "vitest";
import { ClaudeDuetServer } from "../server.js";
import { ClaudeDuetClient } from "../client.js";
import { isChatMessage } from "../protocol.js";

const TEST_PASSWORD = "test1234";
const TEST_SESSION_CODE = "cd-test1234";

describe("chat messages", () => {
  let server: ClaudeDuetServer;
  let client: ClaudeDuetClient;

  afterEach(async () => {
    if (client) {
      await client.disconnect().catch(() => {});
      client = undefined!;
    }
    if (server) {
      await server.stop().catch(() => {});
      server = undefined!;
    }
  });

  it("isChatMessage type guard works", () => {
    expect(isChatMessage({ type: "chat", id: "1", user: "benji", text: "hi", timestamp: 1 })).toBe(true);
    expect(isChatMessage({ type: "prompt", id: "1", user: "benji", text: "hi", timestamp: 1 })).toBe(false);
    expect(isChatMessage(null)).toBe(false);
  });

  it("client.sendChat sends a chat message", async () => {
    server = new ClaudeDuetServer({
      hostUser: "eliran",
      password: TEST_PASSWORD,
      sessionCode: TEST_SESSION_CODE,
    });
    const port = await server.start();

    client = new ClaudeDuetClient();
    await client.connect(`ws://localhost:${port}`, "benji", TEST_PASSWORD, TEST_SESSION_CODE);

    const chatEvents: Record<string, unknown>[] = [];
    server.on("chat", (msg) => chatEvents.push(msg));

    client.sendChat("hello eliran!");
    await new Promise((r) => setTimeout(r, 100));

    expect(chatEvents).toHaveLength(1);
    expect(chatEvents[0].user).toBe("benji");
    expect(chatEvents[0].text).toBe("hello eliran!");
  });

  it("server broadcasts chat_received to guest", async () => {
    server = new ClaudeDuetServer({
      hostUser: "eliran",
      password: TEST_PASSWORD,
      sessionCode: TEST_SESSION_CODE,
    });
    const port = await server.start();

    client = new ClaudeDuetClient();
    await client.connect(`ws://localhost:${port}`, "benji", TEST_PASSWORD, TEST_SESSION_CODE);

    const received: Record<string, unknown>[] = [];
    client.on("message", (msg) => {
      if (msg.type === "chat_received") received.push(msg);
    });

    server.broadcast({
      type: "chat_received",
      user: "eliran",
      text: "hey benji!",
      timestamp: Date.now(),
    });

    await new Promise((r) => setTimeout(r, 100));

    expect(received).toHaveLength(1);
    expect(received[0].user).toBe("eliran");
    expect(received[0].text).toBe("hey benji!");
  });

  it("chat messages do not trigger prompt event", async () => {
    server = new ClaudeDuetServer({
      hostUser: "eliran",
      password: TEST_PASSWORD,
      sessionCode: TEST_SESSION_CODE,
    });
    const port = await server.start();

    client = new ClaudeDuetClient();
    await client.connect(`ws://localhost:${port}`, "benji", TEST_PASSWORD, TEST_SESSION_CODE);

    const promptEvents: Record<string, unknown>[] = [];
    const chatEvents: Record<string, unknown>[] = [];
    server.on("prompt", (msg) => promptEvents.push(msg));
    server.on("chat", (msg) => chatEvents.push(msg));

    client.sendChat("just chatting");
    await new Promise((r) => setTimeout(r, 100));

    expect(chatEvents).toHaveLength(1);
    expect(promptEvents).toHaveLength(0);
  });
});
