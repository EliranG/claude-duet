import WebSocket from "ws";
import { EventEmitter } from "node:events";
import { nanoid } from "nanoid";
import type { ClientMessage, ServerMessage, JoinAccepted } from "./protocol.js";
import { deriveKey, encrypt, decrypt } from "./crypto.js";

const DEFAULT_JOIN_TIMEOUT_MS = 5000;

export class ClaudeDuetClient extends EventEmitter {
  private ws?: WebSocket;
  private user?: string;
  private encryptionKey?: Uint8Array;

  async connect(
    url: string,
    user: string,
    password: string,
    sessionCode: string,
    joinTimeoutMs = DEFAULT_JOIN_TIMEOUT_MS,
  ): Promise<JoinAccepted> {
    this.user = user;
    this.encryptionKey = deriveKey(password, sessionCode);

    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          this.ws?.close();
          reject(new Error("Connection timed out — wrong password or server unreachable"));
        }
      }, joinTimeoutMs);

      const settle = (fn: () => void) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          fn();
        }
      };

      this.ws = new WebSocket(url);

      this.ws.on("open", () => {
        const joinMsg: ClientMessage = {
          type: "join",
          user,
          passwordHash: password,
          timestamp: Date.now(),
        };
        this.ws!.send(encrypt(JSON.stringify(joinMsg), this.encryptionKey!));
      });

      this.ws.on("message", (data) => {
        try {
          const decrypted = decrypt(data.toString(), this.encryptionKey!);
          const msg = JSON.parse(decrypted) as ServerMessage;

          if (msg.type === "join_accepted") {
            settle(() => {
              this.ws!.removeAllListeners("message");
              this.ws!.on("message", (d) => this.handleMessage(d));
              resolve(msg);
            });
            return;
          }

          if (msg.type === "join_rejected") {
            settle(() => reject(new Error(msg.reason)));
            return;
          }
        } catch {
          settle(() => reject(new Error("Malformed response from server")));
        }
      });

      this.ws.on("error", (err) => settle(() => reject(err)));
      this.ws.on("close", () => this.emit("disconnected"));
    });
  }

  private handleMessage(data: WebSocket.RawData): void {
    try {
      const decrypted = decrypt(data.toString(), this.encryptionKey!);
      const msg = JSON.parse(decrypted) as ServerMessage;
      this.emit("message", msg);
    } catch {
      // Ignore malformed or undecryptable messages
    }
  }

  private sendEncrypted(msg: ClientMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected");
    }
    this.ws.send(encrypt(JSON.stringify(msg), this.encryptionKey!));
  }

  sendPrompt(text: string): void {
    this.sendEncrypted({
      type: "prompt",
      id: nanoid(8),
      user: this.user!,
      text,
      timestamp: Date.now(),
    });
  }

  sendChat(text: string): void {
    this.sendEncrypted({
      type: "chat",
      id: nanoid(8),
      user: this.user!,
      text,
      timestamp: Date.now(),
    });
  }

  sendApprovalResponse(promptId: string, approved: boolean): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.sendEncrypted({
      type: "approval_response",
      promptId,
      approved,
      timestamp: Date.now(),
    });
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
