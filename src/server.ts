import { WebSocketServer, WebSocket } from "ws";
import { EventEmitter } from "node:events";
import type { ClientMessage, ServerMessage } from "./protocol.js";
import {
  isJoinRequest,
  isPromptMessage,
  isApprovalResponse,
  isChatMessage,
} from "./protocol.js";
import { deriveKey, encrypt, decrypt } from "./crypto.js";

export interface ServerOptions {
  hostUser: string;
  password: string;
  sessionCode: string;
  approvalMode?: boolean;
}

export class ClaudeDuetServer extends EventEmitter {
  private wss?: WebSocketServer;
  private guest?: WebSocket;
  private guestUser?: string;
  private options: Required<ServerOptions>;
  private encryptionKey: Uint8Array;

  constructor(options: ServerOptions) {
    super();
    this.options = {
      approvalMode: true,
      ...options,
    };
    this.encryptionKey = deriveKey(options.password, options.sessionCode);
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
      const payload: ServerMessage = {
        type: "join_rejected",
        reason: "Session is full",
        timestamp: Date.now(),
      };
      ws.send(encrypt(JSON.stringify(payload), this.encryptionKey));
      ws.close();
      return;
    }

    ws.on("message", (data) => {
      try {
        const decrypted = decrypt(data.toString(), this.encryptionKey);
        const msg: unknown = JSON.parse(decrypted);
        this.handleMessage(ws, msg);
      } catch {
        // Ignore malformed or undecryptable messages
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
      msg.user = this.guestUser!;
      msg.source = "guest";
      this.emit("prompt", msg);
      return;
    }

    if (isApprovalResponse(msg)) {
      this.emit("approval_response", msg);
      return;
    }

    if (isChatMessage(msg)) {
      msg.user = this.guestUser!;
      msg.source = "guest";
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
    if (this.guest?.readyState === WebSocket.OPEN) {
      const encrypted = encrypt(JSON.stringify(msg), this.encryptionKey);
      this.guest.send(encrypted);
    }
    // Also emit locally for host TUI
    this.emit("server_message", msg);
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      const encrypted = encrypt(JSON.stringify(msg), this.encryptionKey);
      ws.send(encrypted);
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
