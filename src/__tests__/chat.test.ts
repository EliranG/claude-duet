import { describe, it, expect, vi, afterEach } from "vitest";
import { ClaudeDuetServer } from "../server.js";
import { ClaudeDuetClient } from "../client.js";
import { isChatMessage } from "../protocol.js";

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
      password: "test1234",
    });
    const port = await server.start();

    client = new ClaudeDuetClient();
    await client.connect(`ws://localhost:${port}`, "benji", "test1234");

    const chatEvents: any[] = [];
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
      password: "test1234",
    });
    const port = await server.start();

    client = new ClaudeDuetClient();
    await client.connect(`ws://localhost:${port}`, "benji", "test1234");

    const received: any[] = [];
    client.on("message", (msg) => {
      if (msg.type === "chat_received") received.push(msg);
    });

    // Simulate host broadcasting a chat
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
      password: "test1234",
    });
    const port = await server.start();

    client = new ClaudeDuetClient();
    await client.connect(`ws://localhost:${port}`, "benji", "test1234");

    const promptEvents: any[] = [];
    const chatEvents: any[] = [];
    server.on("prompt", (msg) => promptEvents.push(msg));
    server.on("chat", (msg) => chatEvents.push(msg));

    client.sendChat("just chatting");
    await new Promise((r) => setTimeout(r, 100));

    expect(chatEvents).toHaveLength(1);
    expect(promptEvents).toHaveLength(0);
  });
});
