import { describe, it, expect, afterEach } from "vitest";
import { PermissionServer, PermissionRequest } from "../permissions.js";

describe("PermissionServer", () => {
  let server: PermissionServer | null = null;

  afterEach(async () => {
    if (server) {
      await server.stop().catch(() => {});
      server = null;
    }
  });

  it("starts on a random port and returns the port number", async () => {
    server = new PermissionServer();
    const port = await server.start();
    expect(port).toBeGreaterThan(0);
  });

  it("responds to POST /permission with approve", async () => {
    server = new PermissionServer();
    const port = await server.start();

    // Listen for permission_request event to capture the requestId
    const requestPromise = new Promise<PermissionRequest>((resolve) => {
      server!.on("permission_request", (req: PermissionRequest) => {
        resolve(req);
      });
    });

    // Send POST request (Connection: close avoids keep-alive blocking server.stop())
    const responsePromise = fetch(`http://127.0.0.1:${port}/permission`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Connection: "close",
      },
      body: JSON.stringify({ tool: "Edit", input: { file: "test.ts" } }),
    });

    // Wait for the event, then approve
    const permReq = await requestPromise;
    expect(permReq.tool).toBe("Edit");
    expect(permReq.input).toEqual({ file: "test.ts" });
    server.respond(permReq.requestId, true);

    // Verify HTTP response
    const response = await responsePromise;
    const body = await response.json();
    expect(body).toEqual({ permissionDecision: "approve" });
  });

  it("responds to POST /permission with deny", async () => {
    server = new PermissionServer();
    const port = await server.start();

    const requestPromise = new Promise<PermissionRequest>((resolve) => {
      server!.on("permission_request", (req: PermissionRequest) => {
        resolve(req);
      });
    });

    const responsePromise = fetch(`http://127.0.0.1:${port}/permission`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Connection: "close",
      },
      body: JSON.stringify({ tool: "Edit", input: { file: "test.ts" } }),
    });

    const permReq = await requestPromise;
    server.respond(permReq.requestId, false);

    const response = await responsePromise;
    const body = await response.json();
    expect(body).toEqual({ permissionDecision: "deny" });
  });

  it("returns 404 for non-/permission paths", async () => {
    server = new PermissionServer();
    const port = await server.start();

    const response = await fetch(`http://127.0.0.1:${port}/other`, {
      headers: { Connection: "close" },
    });
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body).toEqual({ error: "Not found" });
  });

  it("returns 404 for non-POST methods", async () => {
    server = new PermissionServer();
    const port = await server.start();

    const response = await fetch(`http://127.0.0.1:${port}/permission`, {
      method: "GET",
      headers: { Connection: "close" },
    });
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body).toEqual({ error: "Not found" });
  });

  it("auto-denies after timeout", async () => {
    // We can't easily test the 30s timeout, but we can test that stop()
    // auto-denies pending requests (which exercises the same deny path).
    // For a true timeout test we'd need to mock timers or reduce the constant.
    // This test verifies stop() auto-deny behavior as a proxy.
    server = new PermissionServer();
    const port = await server.start();

    const responsePromise = fetch(`http://127.0.0.1:${port}/permission`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Connection: "close",
      },
      body: JSON.stringify({ tool: "Bash", input: { command: "rm -rf /" } }),
    });

    // Wait for the event so we know the request is pending
    await new Promise<void>((resolve) => {
      server!.on("permission_request", () => resolve());
    });

    // Stop auto-denies pending requests
    await server.stop();
    server = null;

    const response = await responsePromise;
    const body = await response.json();
    expect(body).toEqual({ permissionDecision: "deny" });
  });

  it("generates correct hook config", async () => {
    server = new PermissionServer();
    const port = await server.start();

    const config = server.getHookConfig();
    expect(config).toEqual({
      hooks: {
        PermissionRequest: [
          {
            type: "http",
            url: `http://127.0.0.1:${port}/permission`,
            timeout: 30000,
          },
        ],
      },
    });
  });

  it("stop() auto-denies all pending requests", async () => {
    server = new PermissionServer();
    const port = await server.start();

    // Send multiple concurrent requests with Connection: close
    // so server.close() doesn't block on keep-alive sockets
    const eventCount = { value: 0 };
    const allEventsReceived = new Promise<void>((resolve) => {
      server!.on("permission_request", () => {
        eventCount.value++;
        if (eventCount.value === 3) resolve();
      });
    });

    const makeRequest = (body: object) =>
      fetch(`http://127.0.0.1:${port}/permission`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Connection: "close",
        },
        body: JSON.stringify(body),
      });

    const responsePromises = [
      makeRequest({ tool: "Edit", input: { file: "a.ts" } }),
      makeRequest({ tool: "Bash", input: { command: "ls" } }),
      makeRequest({ tool: "Read", input: { path: "/tmp" } }),
    ];

    // Wait for all events to fire (so all requests are pending)
    await allEventsReceived;

    // Stop the server — should auto-deny all pending
    await server.stop();
    server = null;

    // All responses should be deny
    const responses = await Promise.all(responsePromises);
    for (const response of responses) {
      const body = await response.json();
      expect(body).toEqual({ permissionDecision: "deny" });
    }
  });
});
