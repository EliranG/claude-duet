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
import type { DuetTransport } from "./transport.js";

export interface ServerOptions {
  hostUser: string;
  password: string;
  sessionCode: string;
  approvalMode?: boolean;
}

export class ClaudeDuetServer extends EventEmitter {
  private wss?: WebSocketServer;
  private guest?: WebSocket;
  private guestTransport?: DuetTransport;
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

  attachTransport(transport: DuetTransport): void {
    if (this.guest || this.guestTransport) {
      return;
    }

    this.guestTransport = transport;

    transport.on("message", (data: string) => {
      try {
        const decrypted = decrypt(data, this.encryptionKey);
        const msg: unknown = JSON.parse(decrypted);
        this.handleTransportMessage(transport, msg);
      } catch {
        // Ignore malformed or undecryptable messages
      }
    });

    transport.on("close", () => {
      if (transport === this.guestTransport) {
        this.guestTransport = undefined;
        this.guestUser = undefined;
        this.emit("guest_left");
      }
    });
  }

  private handleConnection(ws: WebSocket): void {
    // Only allow one guest
    if (this.guest || this.guestTransport) {
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

  private handleTransportMessage(transport: DuetTransport, msg: unknown): void {
    if (isJoinRequest(msg)) {
      if (msg.passwordHash !== this.options.password) {
        this.sendTransport(transport, {
          type: "join_rejected",
          reason: "Invalid password",
          timestamp: Date.now(),
        });
        return;
      }
      this.guestTransport = transport;
      this.guestUser = msg.user;
      this.sendTransport(transport, {
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
        source: "guest",
        timestamp: Date.now(),
      });
      this.emit("chat", msg);
      return;
    }
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
        source: "guest",
        timestamp: Date.now(),
      });
      this.emit("chat", msg);
      return;
    }
  }

  broadcast(msg: ServerMessage): void {
    const encrypted = encrypt(JSON.stringify(msg), this.encryptionKey);

    if (this.guest?.readyState === WebSocket.OPEN) {
      this.guest.send(encrypted);
    } else if (this.guestTransport?.isOpen()) {
      this.guestTransport.send(encrypted);
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

  private sendTransport(transport: DuetTransport, msg: ServerMessage): void {
    if (transport.isOpen()) {
      const encrypted = encrypt(JSON.stringify(msg), this.encryptionKey);
      transport.send(encrypted);
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
    } else if (this.guestTransport) {
      this.sendTransport(this.guestTransport, {
        type: "error",
        message: "You have been disconnected by the host.",
        timestamp: Date.now(),
      });
      this.guestTransport.close();
      this.guestTransport = undefined;
      this.guestUser = undefined;
    }
  }

  async stop(): Promise<void> {
    this.guest?.close();
    this.guestTransport?.close();
    return new Promise((resolve) => {
      if (this.wss) {
        this.wss.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  isGuestConnected(): boolean {
    return (this.guest?.readyState === WebSocket.OPEN) || (this.guestTransport?.isOpen() ?? false);
  }

  getGuestUser(): string | undefined {
    return this.guestUser;
  }
}
