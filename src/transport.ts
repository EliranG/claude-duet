import { EventEmitter } from "node:events";

export interface DuetTransport extends EventEmitter {
  send(data: string): void;
  close(): void;
  isOpen(): boolean;
}

// Events emitted by DuetTransport:
// - "message" (data: string) — received a message
// - "close" () — transport closed
// - "error" (err: Error) — transport error
