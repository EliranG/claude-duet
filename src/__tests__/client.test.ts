import { describe, it, expect, afterEach } from "vitest";
import { PairVibeServer } from "../server.js";
import { PairVibeClient } from "../client.js";

describe("PairVibeClient", () => {
  let server: PairVibeServer;
  let client: PairVibeClient;

  afterEach(async () => {
    if (client) await client.disconnect();
    if (server) await server.stop();
  });

  it("connects and joins with correct password", async () => {
    server = new PairVibeServer({ hostUser: "alice", password: "test1234" });
    const port = await server.start();

    client = new PairVibeClient();
    const result = await client.connect(
      `ws://localhost:${port}`,
      "bob",
      "test1234",
    );
    expect(result.type).toBe("join_accepted");
    expect(result.hostUser).toBe("alice");
  });

  it("fails to join with wrong password", async () => {
    server = new PairVibeServer({ hostUser: "alice", password: "test1234" });
    const port = await server.start();

    client = new PairVibeClient();
    await expect(
      client.connect(`ws://localhost:${port}`, "bob", "wrongpass"),
    ).rejects.toThrow("Invalid password");
  });

  it("receives broadcast messages", async () => {
    server = new PairVibeServer({ hostUser: "alice", password: "test1234" });
    const port = await server.start();

    client = new PairVibeClient();
    await client.connect(`ws://localhost:${port}`, "bob", "test1234");

    const messages: any[] = [];
    client.on("message", (msg) => messages.push(msg));

    server.broadcast({
      type: "stream_chunk",
      text: "Hello from Claude",
      timestamp: Date.now(),
    });

    // Wait for message delivery
    await new Promise((r) => setTimeout(r, 50));
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe("stream_chunk");
  });

  it("sends prompts to server", async () => {
    server = new PairVibeServer({ hostUser: "alice", password: "test1234" });
    const port = await server.start();

    client = new PairVibeClient();
    await client.connect(`ws://localhost:${port}`, "bob", "test1234");

    const prompts: any[] = [];
    server.on("prompt", (msg) => prompts.push(msg));

    client.sendPrompt("fix the bug");

    await new Promise((r) => setTimeout(r, 50));
    expect(prompts).toHaveLength(1);
    expect(prompts[0].user).toBe("bob");
    expect(prompts[0].text).toBe("fix the bug");
  });
});
