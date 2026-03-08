import { WebSocketServer, WebSocket } from "ws";
import { EventEmitter } from "node:events";
import type { ClientMessage, ServerMessage } from "./protocol.js";
import {
  isJoinRequest,
  isPromptMessage,
  isApprovalResponse,
  isChatMessage,
} from "./protocol.js";

export interface ServerOptions {
  hostUser: string;
  password: string;
  approvalMode?: boolean;
}

export class ClaudeDuetServer extends EventEmitter {
  private wss?: WebSocketServer;
  private guest?: WebSocket;
  private guestUser?: string;
  private options: Required<ServerOptions>;

  constructor(options: ServerOptions) {
    super();
    this.options = {
      approvalMode: true,
      ...options,
    };
  }

  async start(port = 0): Promise<number> {
    return new Promise((resolve) => {
      this.wss = new WebSocketServer({ port });
      this.wss.on("listening", () => {
        const addr = this.wss!.address();
        const listeningPort = typeof addr === "object" && addr !== null ? addr.port : 0;
        resolve(listeningPort);
      });
      this.wss.on("connection", (ws) => this.handleConnection(ws));
    });
  }

  private handleConnection(ws: WebSocket): void {
    // Only allow one guest
    if (this.guest) {
      ws.send(
        JSON.stringify({
          type: "join_rejected",
          reason: "Session is full",
          timestamp: Date.now(),
        } satisfies ServerMessage),
      );
      ws.close();
      return;
    }

    ws.on("message", (data) => {
      try {
        const msg: unknown = JSON.parse(data.toString());
        this.handleMessage(ws, msg);
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on("close", () => {
      if (ws === this.guest) {
        this.guest = undefined;
        this.guestUser = undefined;
        this.emit("guest_left");
      }
    });
  }

  private handleMessage(ws: WebSocket, msg: unknown): void {
    if (isJoinRequest(msg)) {
      if (msg.passwordHash !== this.options.password) {
        this.send(ws, {
          type: "join_rejected",
          reason: "Invalid password",
          timestamp: Date.now(),
        });
        return;
      }
      this.guest = ws;
      this.guestUser = msg.user;
      this.send(ws, {
        type: "join_accepted",
        sessionId: "session",
        hostUser: this.options.hostUser,
        approvalMode: this.options.approvalMode,
        timestamp: Date.now(),
      });
      this.emit("guest_joined", msg.user);
      return;
    }

    if (isPromptMessage(msg)) {
      this.emit("prompt", msg);
      return;
    }

    if (isApprovalResponse(msg)) {
      this.emit("approval_response", msg);
      return;
    }

    if (isChatMessage(msg)) {
      this.broadcast({
        type: "chat_received",
        user: msg.user,
        text: msg.text,
        timestamp: Date.now(),
      });
      this.emit("chat", msg);
      return;
    }
  }

  broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg);
    if (this.guest?.readyState === WebSocket.OPEN) {
      this.guest.send(data);
    }
    // Also emit locally for host TUI
    this.emit("server_message", msg);
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  kickGuest(): void {
    if (this.guest) {
      this.send(this.guest, {
        type: "error",
        message: "You have been disconnected by the host.",
        timestamp: Date.now(),
      });
      this.guest.close();
      this.guest = undefined;
      this.guestUser = undefined;
    }
  }

  async stop(): Promise<void> {
    this.guest?.close();
    return new Promise((resolve) => {
      if (this.wss) {
        this.wss.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  isGuestConnected(): boolean {
    return this.guest?.readyState === WebSocket.OPEN;
  }

  getGuestUser(): string | undefined {
    return this.guestUser;
  }
}
