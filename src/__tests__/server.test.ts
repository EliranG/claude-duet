import { describe, it, expect, afterEach } from "vitest";
import WebSocket from "ws";
import { ClaudeDuetServer } from "../server.js";

describe("ClaudeDuetServer", () => {
  let server: ClaudeDuetServer;

  afterEach(async () => {
    if (server) await server.stop();
  });

  it("starts on a random port and returns the port", async () => {
    server = new ClaudeDuetServer({ hostUser: "alice", password: "test1234" });
    const port = await server.start();
    expect(port).toBeGreaterThan(0);
  });

  it("accepts a WebSocket connection", async () => {
    server = new ClaudeDuetServer({ hostUser: "alice", password: "test1234" });
    const port = await server.start();

    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => ws.on("open", resolve));

    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  it("rejects connections with wrong password", async () => {
    server = new ClaudeDuetServer({ hostUser: "alice", password: "test1234" });
    const port = await server.start();

    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => ws.on("open", resolve));

    // Send join with wrong password
    ws.send(
      JSON.stringify({
        type: "join",
        user: "bob",
        passwordHash: "wrongpassword",
        timestamp: Date.now(),
      }),
    );

    const response = await new Promise<any>((resolve) => {
      ws.on("message", (data) => resolve(JSON.parse(data.toString())));
    });

    expect(response.type).toBe("join_rejected");
    ws.close();
  });

  it("accepts connections with correct password", async () => {
    server = new ClaudeDuetServer({ hostUser: "alice", password: "test1234" });
    const port = await server.start();

    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => ws.on("open", resolve));

    ws.send(
      JSON.stringify({
        type: "join",
        user: "bob",
        passwordHash: "test1234",
        timestamp: Date.now(),
      }),
    );

    const response = await new Promise<any>((resolve) => {
      ws.on("message", (data) => resolve(JSON.parse(data.toString())));
    });

    expect(response.type).toBe("join_accepted");
    expect(response.hostUser).toBe("alice");
    ws.close();
  });
});
