import {
  createServer,
  Server,
  IncomingMessage,
  ServerResponse,
} from "node:http";
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";

const DECISION_TIMEOUT_MS = 30_000;

export interface PermissionRequest {
  requestId: string;
  tool: string;
  input: Record<string, unknown>;
}

export interface PermissionDecision {
  requestId: string;
  approved: boolean;
}

interface PendingRequest {
  resolve: (decision: "approve" | "deny") => void;
  timeout: NodeJS.Timeout;
}

export class PermissionServer extends EventEmitter {
  private server: Server | null = null;
  private port: number = 0;
  private pending: Map<string, PendingRequest> = new Map();

  /** Start HTTP server on a random available port (localhost only). */
  async start(): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      const server = createServer((req, res) => this.handleRequest(req, res));

      server.on("error", reject);

      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        if (!addr || typeof addr === "string") {
          reject(new Error("Failed to get server address"));
          return;
        }
        this.port = addr.port;
        this.server = server;
        resolve(this.port);
      });
    });
  }

  /** Handle incoming PermissionRequest hook from Claude Code. */
  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    // Only accept POST /permission
    if (req.method !== "POST" || req.url !== "/permission") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      let hookData: Record<string, unknown>;
      try {
        hookData = JSON.parse(body) as Record<string, unknown>;
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
        return;
      }

      const requestId = randomUUID();
      const tool = typeof hookData.tool === "string" ? hookData.tool : "unknown";
      const input =
        hookData.input && typeof hookData.input === "object" && !Array.isArray(hookData.input)
          ? (hookData.input as Record<string, unknown>)
          : {};

      const permissionRequest: PermissionRequest = { requestId, tool, input };

      // Create a promise that resolves when the host decides
      const decisionPromise = new Promise<"approve" | "deny">((resolveDecision) => {
        const timeout = setTimeout(() => {
          // Auto-deny on timeout
          if (this.pending.has(requestId)) {
            this.pending.delete(requestId);
            resolveDecision("deny");
          }
        }, DECISION_TIMEOUT_MS);

        this.pending.set(requestId, { resolve: resolveDecision, timeout });
      });

      // Emit event for host TUI to display
      this.emit("permission_request", permissionRequest);

      // Wait for host decision, then respond to Claude Code
      decisionPromise.then((decision) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ permissionDecision: decision }));
      });
    });
  }

  /** Host approves or denies a permission request. */
  respond(requestId: string, approved: boolean): void {
    const entry = this.pending.get(requestId);
    if (!entry) {
      return;
    }

    clearTimeout(entry.timeout);
    this.pending.delete(requestId);
    entry.resolve(approved ? "approve" : "deny");
  }

  /** Generate Claude Code hook config for this server. */
  getHookConfig(): object {
    return {
      hooks: {
        PermissionRequest: [
          {
            type: "http",
            url: `http://127.0.0.1:${this.port}/permission`,
            timeout: DECISION_TIMEOUT_MS,
          },
        ],
      },
    };
  }

  getPort(): number {
    return this.port;
  }

  /** Stop the server and auto-deny all pending requests. */
  async stop(): Promise<void> {
    // Auto-deny all pending requests
    for (const [requestId, entry] of this.pending) {
      clearTimeout(entry.timeout);
      entry.resolve("deny");
      this.pending.delete(requestId);
    }

    // Close the HTTP server
    if (this.server) {
      await new Promise<void>((resolve, reject) => {
        this.server!.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
      this.server = null;
    }
  }
}
