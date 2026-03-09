import { describe, it, expect, afterEach } from "vitest";
import WebSocket from "ws";
import { ClaudeDuetServer } from "../server.js";
import { deriveKey, encrypt, decrypt } from "../crypto.js";

const TEST_PASSWORD = "test1234";
const TEST_SESSION_CODE = "cd-test1234";
const TEST_KEY = deriveKey(TEST_PASSWORD, TEST_SESSION_CODE);

describe("ClaudeDuetServer", () => {
  let server: ClaudeDuetServer;

  afterEach(async () => {
    if (server) await server.stop();
  });

  it("starts on a random port and returns the port", async () => {
    server = new ClaudeDuetServer({ hostUser: "eliran", password: TEST_PASSWORD, sessionCode: TEST_SESSION_CODE });
    const port = await server.start();
    expect(port).toBeGreaterThan(0);
  });

  it("accepts a WebSocket connection", async () => {
    server = new ClaudeDuetServer({ hostUser: "eliran", password: TEST_PASSWORD, sessionCode: TEST_SESSION_CODE });
    const port = await server.start();

    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => ws.on("open", resolve));

    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  it("rejects connections with wrong password", async () => {
    server = new ClaudeDuetServer({ hostUser: "eliran", password: TEST_PASSWORD, sessionCode: TEST_SESSION_CODE });
    const port = await server.start();

    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => ws.on("open", resolve));

    ws.send(
      encrypt(
        JSON.stringify({
          type: "join",
          user: "benji",
          passwordHash: "wrongpassword",
          timestamp: Date.now(),
        }),
        TEST_KEY,
      ),
    );

    const response = await new Promise<Record<string, unknown>>((resolve) => {
      ws.on("message", (data) => {
        const decrypted = decrypt(data.toString(), TEST_KEY);
        resolve(JSON.parse(decrypted));
      });
    });

    expect(response.type).toBe("join_rejected");
    ws.close();
  });

  it("accepts connections with correct password", async () => {
    server = new ClaudeDuetServer({ hostUser: "eliran", password: TEST_PASSWORD, sessionCode: TEST_SESSION_CODE });
    const port = await server.start();

    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => ws.on("open", resolve));

    ws.send(
      encrypt(
        JSON.stringify({
          type: "join",
          user: "benji",
          passwordHash: TEST_PASSWORD,
          timestamp: Date.now(),
        }),
        TEST_KEY,
      ),
    );

    const response = await new Promise<Record<string, unknown>>((resolve) => {
      ws.on("message", (data) => {
        const decrypted = decrypt(data.toString(), TEST_KEY);
        resolve(JSON.parse(decrypted));
      });
    });

    expect(response.type).toBe("join_accepted");
    expect(response.hostUser).toBe("eliran");
    ws.close();
  });

  it("overrides user field on guest prompt messages with stored guestUser", async () => {
    server = new ClaudeDuetServer({ hostUser: "eliran", password: TEST_PASSWORD, sessionCode: TEST_SESSION_CODE });
    const port = await server.start();

    const promptReceived = new Promise<Record<string, unknown>>((resolve) => {
      server.on("prompt", (msg) => resolve(msg));
    });

    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => ws.on("open", resolve));

    ws.send(
      encrypt(
        JSON.stringify({
          type: "join",
          user: "benji",
          passwordHash: TEST_PASSWORD,
          timestamp: Date.now(),
        }),
        TEST_KEY,
      ),
    );

    await new Promise<void>((resolve) => {
      ws.on("message", () => resolve());
    });

    ws.send(
      encrypt(
        JSON.stringify({
          type: "prompt",
          id: "spoof-1",
          user: "eliran",
          text: "spoofed prompt",
          timestamp: Date.now(),
        }),
        TEST_KEY,
      ),
    );

    const msg = await promptReceived;
    expect(msg.user).toBe("benji");
    expect(msg.source).toBe("guest");
    ws.close();
  });

  it("overrides user field on guest chat messages with stored guestUser", async () => {
    server = new ClaudeDuetServer({ hostUser: "eliran", password: TEST_PASSWORD, sessionCode: TEST_SESSION_CODE });
    const port = await server.start();

    const chatReceived = new Promise<Record<string, unknown>>((resolve) => {
      server.on("chat", (msg) => resolve(msg));
    });

    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => ws.on("open", resolve));

    ws.send(
      encrypt(
        JSON.stringify({
          type: "join",
          user: "benji",
          passwordHash: TEST_PASSWORD,
          timestamp: Date.now(),
        }),
        TEST_KEY,
      ),
    );

    await new Promise<void>((resolve) => {
      ws.on("message", () => resolve());
    });

    ws.send(
      encrypt(
        JSON.stringify({
          type: "chat",
          id: "chat-spoof-1",
          user: "eliran",
          text: "spoofed chat",
          timestamp: Date.now(),
        }),
        TEST_KEY,
      ),
    );

    const msg = await chatReceived;
    expect(msg.user).toBe("benji");
    expect(msg.source).toBe("guest");
    ws.close();
  });

  it("sends encrypted messages on the wire (not plaintext JSON)", async () => {
    server = new ClaudeDuetServer({ hostUser: "eliran", password: TEST_PASSWORD, sessionCode: TEST_SESSION_CODE });
    const port = await server.start();

    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => ws.on("open", resolve));

    ws.send(
      encrypt(
        JSON.stringify({
          type: "join",
          user: "benji",
          passwordHash: TEST_PASSWORD,
          timestamp: Date.now(),
        }),
        TEST_KEY,
      ),
    );

    const rawData = await new Promise<string>((resolve) => {
      ws.on("message", (data) => resolve(data.toString()));
    });

    // The raw wire data must NOT be valid JSON (it's base64 encrypted)
    expect(() => JSON.parse(rawData)).toThrow();

    // But decrypting it yields valid JSON
    const decrypted = decrypt(rawData, TEST_KEY);
    const parsed = JSON.parse(decrypted);
    expect(parsed.type).toBe("join_accepted");

    ws.close();
  });
});
