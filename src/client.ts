import WebSocket from "ws";
import { EventEmitter } from "node:events";
import { nanoid } from "nanoid";
import type { ClientMessage, ServerMessage, JoinAccepted } from "./protocol.js";

export class ClaudeDuetClient extends EventEmitter {
  private ws?: WebSocket;
  private user?: string;

  async connect(
    url: string,
    user: string,
    password: string,
  ): Promise<JoinAccepted> {
    this.user = user;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);

      this.ws.on("open", () => {
        this.ws!.send(
          JSON.stringify({
            type: "join",
            user,
            passwordHash: password,
            timestamp: Date.now(),
          } satisfies ClientMessage),
        );
      });

      this.ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString()) as ServerMessage;

          if (msg.type === "join_accepted") {
            // Switch to normal message handling
            this.ws!.removeAllListeners("message");
            this.ws!.on("message", (d) => this.handleMessage(d));
            resolve(msg);
            return;
          }

          if (msg.type === "join_rejected") {
            reject(new Error(msg.reason));
            return;
          }
        } catch {
          reject(new Error("Malformed response from server"));
        }
      });

      this.ws.on("error", (err) => reject(err));
      this.ws.on("close", () => this.emit("disconnected"));
    });
  }

  private handleMessage(data: WebSocket.RawData): void {
    try {
      const msg = JSON.parse(data.toString()) as ServerMessage;
      this.emit("message", msg);
    } catch {
      // Ignore malformed messages
    }
  }

  sendPrompt(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected");
    }
    this.ws.send(
      JSON.stringify({
        type: "prompt",
        id: nanoid(8),
        user: this.user!,
        text,
        timestamp: Date.now(),
      } satisfies ClientMessage),
    );
  }

  sendChat(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected");
    }
    this.ws.send(
      JSON.stringify({
        type: "chat",
        id: nanoid(8),
        user: this.user!,
        text,
        timestamp: Date.now(),
      } satisfies ClientMessage),
    );
  }

  sendApprovalResponse(promptId: string, approved: boolean): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        type: "approval_response",
        promptId,
        approved,
        timestamp: Date.now(),
      } satisfies ClientMessage),
    );
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.ws) {
        this.ws.on("close", () => resolve());
        this.ws.close();
      } else {
        resolve();
      }
    });
  }
}
