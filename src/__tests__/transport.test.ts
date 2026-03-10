import { describe, it, expect, afterEach } from "vitest";
import { ClaudeDuetServer } from "../server.js";
import { ClaudeDuetClient } from "../client.js";
import { MockTransport } from "./mock-transport.js";

const TEST_PASSWORD = "test1234";
const TEST_SESSION_CODE = "cd-test1234";

describe("transport-based server + client", () => {
  let server: ClaudeDuetServer;
  let client: ClaudeDuetClient;

  afterEach(async () => {
    if (client) await client.disconnect().catch(() => {});
    if (server) await server.stop().catch(() => {});
  });

  it("guest connects via transport and joins", async () => {
    server = new ClaudeDuetServer({
      hostUser: "eliran",
      password: TEST_PASSWORD,
      sessionCode: TEST_SESSION_CODE,
    });

    const [hostSide, guestSide] = MockTransport.createPair();
    server.attachTransport(hostSide);

    client = new ClaudeDuetClient();
    const result = await client.connectTransport(
      guestSide,
      "benji",
      TEST_PASSWORD,
      TEST_SESSION_CODE,
    );

    expect(result.type).toBe("join_accepted");
    expect(result.hostUser).toBe("eliran");
  });

  it("rejects wrong password via transport", async () => {
    server = new ClaudeDuetServer({
      hostUser: "eliran",
      password: TEST_PASSWORD,
      sessionCode: TEST_SESSION_CODE,
    });

    const [hostSide, guestSide] = MockTransport.createPair();
    server.attachTransport(hostSide);

    client = new ClaudeDuetClient();
    await expect(
      client.connectTransport(guestSide, "benji", "wrongpass", TEST_SESSION_CODE, 500),
    ).rejects.toThrow();
  });

  it("broadcast reaches guest via transport", async () => {
    server = new ClaudeDuetServer({
      hostUser: "eliran",
      password: TEST_PASSWORD,
      sessionCode: TEST_SESSION_CODE,
    });

    const [hostSide, guestSide] = MockTransport.createPair();
    server.attachTransport(hostSide);

    client = new ClaudeDuetClient();
    await client.connectTransport(guestSide, "benji", TEST_PASSWORD, TEST_SESSION_CODE);

    const messages: Record<string, unknown>[] = [];
    client.on("message", (msg) => messages.push(msg));

    server.broadcast({
      type: "stream_chunk",
      text: "Hello via P2P",
      timestamp: Date.now(),
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(messages).toHaveLength(1);
    expect(messages[0].text).toBe("Hello via P2P");
  });

  it("guest sends prompt via transport", async () => {
    server = new ClaudeDuetServer({
      hostUser: "eliran",
      password: TEST_PASSWORD,
      sessionCode: TEST_SESSION_CODE,
    });

    const [hostSide, guestSide] = MockTransport.createPair();
    server.attachTransport(hostSide);

    client = new ClaudeDuetClient();
    await client.connectTransport(guestSide, "benji", TEST_PASSWORD, TEST_SESSION_CODE);

    const prompts: Record<string, unknown>[] = [];
    server.on("prompt", (msg) => prompts.push(msg));

    client.sendPrompt("fix the bug via p2p");

    await new Promise((r) => setTimeout(r, 50));
    expect(prompts).toHaveLength(1);
    expect(prompts[0].user).toBe("benji");
    expect(prompts[0].text).toBe("fix the bug via p2p");
  });

  it("guest chat via transport", async () => {
    server = new ClaudeDuetServer({
      hostUser: "eliran",
      password: TEST_PASSWORD,
      sessionCode: TEST_SESSION_CODE,
    });

    const [hostSide, guestSide] = MockTransport.createPair();
    server.attachTransport(hostSide);

    client = new ClaudeDuetClient();
    await client.connectTransport(guestSide, "benji", TEST_PASSWORD, TEST_SESSION_CODE);

    const chatEvents: Record<string, unknown>[] = [];
    server.on("chat", (msg) => chatEvents.push(msg));

    client.sendChat("hello via p2p");

    await new Promise((r) => setTimeout(r, 50));
    expect(chatEvents).toHaveLength(1);
    expect(chatEvents[0].user).toBe("benji");
    expect(chatEvents[0].text).toBe("hello via p2p");
  });

  it("emits guest_joined and guest_left via transport", async () => {
    server = new ClaudeDuetServer({
      hostUser: "eliran",
      password: TEST_PASSWORD,
      sessionCode: TEST_SESSION_CODE,
    });

    const [hostSide, guestSide] = MockTransport.createPair();
    server.attachTransport(hostSide);

    const joined: string[] = [];
    const left: boolean[] = [];
    server.on("guest_joined", (user: string) => joined.push(user));
    server.on("guest_left", () => left.push(true));

    client = new ClaudeDuetClient();
    await client.connectTransport(guestSide, "benji", TEST_PASSWORD, TEST_SESSION_CODE);

    expect(joined).toEqual(["benji"]);
    expect(server.isGuestConnected()).toBe(true);
    expect(server.getGuestUser()).toBe("benji");

    guestSide.close();
    await new Promise((r) => setTimeout(r, 50));

    expect(left).toEqual([true]);
  });

  it("kickGuest works via transport", async () => {
    server = new ClaudeDuetServer({
      hostUser: "eliran",
      password: TEST_PASSWORD,
      sessionCode: TEST_SESSION_CODE,
    });

    const [hostSide, guestSide] = MockTransport.createPair();
    server.attachTransport(hostSide);

    client = new ClaudeDuetClient();
    await client.connectTransport(guestSide, "benji", TEST_PASSWORD, TEST_SESSION_CODE);

    const disconnected: boolean[] = [];
    client.on("disconnected", () => disconnected.push(true));

    server.kickGuest();

    await new Promise((r) => setTimeout(r, 50));
    expect(server.isGuestConnected()).toBe(false);
  });

  it("overrides user field on guest messages (anti-spoofing)", async () => {
    server = new ClaudeDuetServer({
      hostUser: "eliran",
      password: TEST_PASSWORD,
      sessionCode: TEST_SESSION_CODE,
    });

    const [hostSide, guestSide] = MockTransport.createPair();
    server.attachTransport(hostSide);

    client = new ClaudeDuetClient();
    await client.connectTransport(guestSide, "benji", TEST_PASSWORD, TEST_SESSION_CODE);

    const prompts: Record<string, unknown>[] = [];
    server.on("prompt", (msg) => prompts.push(msg));

    // Send a prompt — the user field should be overridden to "benji"
    client.sendPrompt("test prompt");

    await new Promise((r) => setTimeout(r, 50));
    expect(prompts[0].user).toBe("benji");
    expect(prompts[0].source).toBe("guest");
  });
});
