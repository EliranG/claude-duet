import { EventEmitter } from "node:events";
import type { DuetTransport } from "../transport.js";

export class MockTransport extends EventEmitter implements DuetTransport {
  private peer?: MockTransport;
  private open = true;

  send(data: string): void {
    if (!this.open) throw new Error("Transport closed");
    // Deliver to peer asynchronously (simulates network)
    if (this.peer?.open) {
      setImmediate(() => this.peer?.emit("message", data));
    }
  }

  close(): void {
    if (this.open) {
      this.open = false;
      this.emit("close");
      // Simulate peer disconnect — close the other side too
      if (this.peer?.open) {
        setImmediate(() => this.peer?.close());
      }
    }
  }

  isOpen(): boolean {
    return this.open;
  }

  static createPair(): [MockTransport, MockTransport] {
    const a = new MockTransport();
    const b = new MockTransport();
    a.peer = b;
    b.peer = a;
    return [a, b];
  }
}
