# Claude-Duet Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build `claude-duet`, an npm CLI tool that lets two users share a Claude Code session in real-time with E2E encryption and approval mode.

**Architecture:** Host runs Claude Agent SDK + WebSocket server. Joiner connects via WebSocket — directly on LAN (default), or through an optional tunnel/relay for remote. All messages are E2E encrypted. Host can approve/reject joiner's prompts.

**Tech Stack:** TypeScript, `ink` + `@inkjs/ui` (React terminal UI), `@clack/prompts` (setup wizard), `@anthropic-ai/claude-agent-sdk`, `ws`, `commander`, `tweetnacl`, `nanoid`, `picocolors`, `qrcode-terminal` (zero third-party relay dependencies)

**UX:** Interactive setup wizard by default (@clack/prompts), Ink-based session TUI (like Claude Code), CLI flags for power users/scripts.

**Connection Tiers:**
| Tier | Mode | Third-Party? | How |
|------|------|:---:|-----|
| 1 (default) | Direct LAN/VPN | None | `ws://192.168.x.x:PORT` |
| 2 (recommended remote) | SSH tunnel | None | `ssh -L` (user's own SSH) |
| 3 (opt-in) | Cloudflare Quick Tunnel | User's own `cloudflared` | `--tunnel cloudflare` |
| 3 (opt-in) | Self-hosted relay | Your own server | `--relay wss://relay.company.com` |
| 4 (future) | Supabase Broadcast | Supabase (opt-in dep) | `--relay supabase` |

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/index.ts` (CLI entry point, empty)
- Create: `.gitignore`

**Step 1: Initialize the npm package**

```bash
mkdir -p src
```

Create `package.json`:
```json
{
  "name": "claude-duet",
  "version": "0.1.0",
  "description": "Claude Duet — share a Claude Code session with a partner",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "claude-duet": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "keywords": ["claude", "pair-programming", "ai", "collaboration", "vibe-coding"],
  "license": "MIT"
}
```

**Step 2: Install dependencies**

```bash
npm install commander ws nanoid tweetnacl tweetnacl-util @anthropic-ai/claude-agent-sdk ink @inkjs/ui react @clack/prompts picocolors qrcode-terminal
npm install -D typescript @types/node @types/ws @types/react vitest
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "sourceMap": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Create .gitignore**

```
node_modules/
dist/
*.tsbuildinfo
```

**Step 5: Create empty entry point**

Create `src/index.ts`:
```typescript
#!/usr/bin/env node
console.log("claude-duet");
```

**Step 6: Verify it builds**

```bash
npx tsc
node dist/index.js
```
Expected: prints "claude-duet"

**Step 7: Commit**

```bash
git add package.json tsconfig.json src/index.ts .gitignore
git commit -m "chore: scaffold claude-duet project"
```

---

## Task 2: Message Protocol Types

**Files:**
- Create: `src/protocol.ts`
- Create: `src/__tests__/protocol.test.ts`

**Step 1: Write the test for message type guards**

Create `src/__tests__/protocol.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import {
  isPromptMessage,
  isStreamChunk,
  isApprovalRequest,
  isPresenceMessage,
  type PromptMessage,
  type StreamChunk,
} from "../protocol.js";

describe("protocol type guards", () => {
  it("identifies a prompt message", () => {
    const msg: PromptMessage = {
      type: "prompt",
      id: "abc",
      user: "bob",
      text: "fix the bug",
      timestamp: Date.now(),
    };
    expect(isPromptMessage(msg)).toBe(true);
    expect(isStreamChunk(msg)).toBe(false);
  });

  it("identifies a stream chunk", () => {
    const msg: StreamChunk = {
      type: "stream_chunk",
      text: "Here is the fix...",
      timestamp: Date.now(),
    };
    expect(isStreamChunk(msg)).toBe(true);
    expect(isPromptMessage(msg)).toBe(false);
  });

  it("identifies an approval request", () => {
    const msg = {
      type: "approval_request",
      promptId: "abc",
      user: "bob",
      text: "delete all files",
      timestamp: Date.now(),
    };
    expect(isApprovalRequest(msg)).toBe(true);
  });

  it("identifies a presence message", () => {
    const msg = {
      type: "presence",
      users: [{ name: "alice", role: "host" }],
      timestamp: Date.now(),
    };
    expect(isPresenceMessage(msg)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/protocol.test.ts
```
Expected: FAIL — module not found

**Step 3: Implement the protocol types**

Create `src/protocol.ts`:
```typescript
// ---- Base ----

export interface BaseMessage {
  type: string;
  timestamp: number;
}

// ---- Client → Server ----

export interface PromptMessage extends BaseMessage {
  type: "prompt";
  id: string;
  user: string;
  text: string;
}

export interface TypingMessage extends BaseMessage {
  type: "typing";
  user: string;
  isTyping: boolean;
}

export interface ApprovalResponse extends BaseMessage {
  type: "approval_response";
  promptId: string;
  approved: boolean;
}

export interface JoinRequest extends BaseMessage {
  type: "join";
  user: string;
  passwordHash: string;
}

// ---- Server → Client(s) ----

export interface JoinAccepted extends BaseMessage {
  type: "join_accepted";
  sessionId: string;
  hostUser: string;
  approvalMode: boolean;
}

export interface JoinRejected extends BaseMessage {
  type: "join_rejected";
  reason: string;
}

export interface PromptReceived extends BaseMessage {
  type: "prompt_received";
  promptId: string;
  user: string;
  text: string;
}

export interface ApprovalRequest extends BaseMessage {
  type: "approval_request";
  promptId: string;
  user: string;
  text: string;
}

export interface StreamChunk extends BaseMessage {
  type: "stream_chunk";
  text: string;
}

export interface ToolUseMessage extends BaseMessage {
  type: "tool_use";
  tool: string;
  input: Record<string, unknown>;
}

export interface ToolResultMessage extends BaseMessage {
  type: "tool_result";
  tool: string;
  output: string;
}

export interface TurnComplete extends BaseMessage {
  type: "turn_complete";
  cost: number;
  durationMs: number;
}

export interface PresenceMessage extends BaseMessage {
  type: "presence";
  users: Array<{ name: string; role: "host" | "guest" }>;
}

export interface ErrorMessage extends BaseMessage {
  type: "error";
  message: string;
}

// ---- Union Types ----

export type ClientMessage =
  | PromptMessage
  | TypingMessage
  | ApprovalResponse
  | JoinRequest;

export type ServerMessage =
  | JoinAccepted
  | JoinRejected
  | PromptReceived
  | ApprovalRequest
  | StreamChunk
  | ToolUseMessage
  | ToolResultMessage
  | TurnComplete
  | PresenceMessage
  | ErrorMessage;

export type Message = ClientMessage | ServerMessage;

// ---- Type Guards ----

export function isPromptMessage(msg: unknown): msg is PromptMessage {
  return isObject(msg) && msg.type === "prompt";
}

export function isStreamChunk(msg: unknown): msg is StreamChunk {
  return isObject(msg) && msg.type === "stream_chunk";
}

export function isApprovalRequest(msg: unknown): msg is ApprovalRequest {
  return isObject(msg) && msg.type === "approval_request";
}

export function isApprovalResponse(msg: unknown): msg is ApprovalResponse {
  return isObject(msg) && msg.type === "approval_response";
}

export function isPresenceMessage(msg: unknown): msg is PresenceMessage {
  return isObject(msg) && msg.type === "presence";
}

export function isJoinRequest(msg: unknown): msg is JoinRequest {
  return isObject(msg) && msg.type === "join";
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && "type" in val;
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/__tests__/protocol.test.ts
```
Expected: PASS (all 4 tests)

**Step 5: Commit**

```bash
git add src/protocol.ts src/__tests__/protocol.test.ts
git commit -m "feat: define message protocol types and guards"
```

---

## Task 3: Encryption Layer

**Files:**
- Create: `src/crypto.ts`
- Create: `src/__tests__/crypto.test.ts`

**Step 1: Write the test**

Create `src/__tests__/crypto.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { deriveKey, encrypt, decrypt } from "../crypto.js";

describe("crypto", () => {
  it("derives deterministic keys from password + session code", () => {
    const key1 = deriveKey("mypassword", "pv-abc123");
    const key2 = deriveKey("mypassword", "pv-abc123");
    expect(key1).toEqual(key2);
  });

  it("derives different keys for different passwords", () => {
    const key1 = deriveKey("password1", "pv-abc123");
    const key2 = deriveKey("password2", "pv-abc123");
    expect(key1).not.toEqual(key2);
  });

  it("encrypts and decrypts a message roundtrip", () => {
    const key = deriveKey("mypassword", "pv-abc123");
    const plaintext = JSON.stringify({ type: "prompt", text: "hello" });
    const encrypted = encrypt(plaintext, key);
    expect(encrypted).not.toBe(plaintext);
    const decrypted = decrypt(encrypted, key);
    expect(decrypted).toBe(plaintext);
  });

  it("fails to decrypt with wrong key", () => {
    const key1 = deriveKey("password1", "pv-abc123");
    const key2 = deriveKey("password2", "pv-abc123");
    const encrypted = encrypt("secret", key1);
    expect(() => decrypt(encrypted, key2)).toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/crypto.test.ts
```
Expected: FAIL

**Step 3: Implement encryption**

Create `src/crypto.ts`:
```typescript
import nacl from "tweetnacl";
import { decodeUTF8, encodeUTF8, encodeBase64, decodeBase64 } from "tweetnacl-util";
import { scryptSync } from "node:crypto";

const KEY_LENGTH = nacl.secretbox.keyLength; // 32 bytes

export function deriveKey(password: string, sessionCode: string): Uint8Array {
  const salt = decodeUTF8(sessionCode);
  const keyBuffer = scryptSync(password, salt, KEY_LENGTH, {
    N: 16384,
    r: 8,
    p: 1,
  });
  return new Uint8Array(keyBuffer);
}

export function encrypt(plaintext: string, key: Uint8Array): string {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const messageBytes = decodeUTF8(plaintext);
  const box = nacl.secretbox(messageBytes, nonce, key);
  const fullMessage = new Uint8Array(nonce.length + box.length);
  fullMessage.set(nonce);
  fullMessage.set(box, nonce.length);
  return encodeBase64(fullMessage);
}

export function decrypt(ciphertext: string, key: Uint8Array): string {
  const fullMessage = decodeBase64(ciphertext);
  const nonce = fullMessage.slice(0, nacl.secretbox.nonceLength);
  const box = fullMessage.slice(nacl.secretbox.nonceLength);
  const decrypted = nacl.secretbox.open(box, nonce, key);
  if (!decrypted) {
    throw new Error("Decryption failed — wrong password or corrupted message");
  }
  return encodeUTF8(decrypted);
}
```

**Step 4: Run tests**

```bash
npx vitest run src/__tests__/crypto.test.ts
```
Expected: PASS (all 4 tests)

**Step 5: Commit**

```bash
git add src/crypto.ts src/__tests__/crypto.test.ts
git commit -m "feat: add E2E encryption with NaCl secretbox + scrypt"
```

---

## Task 4: Session Manager

**Files:**
- Create: `src/session.ts`
- Create: `src/__tests__/session.test.ts`

**Step 1: Write the test**

Create `src/__tests__/session.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SessionManager } from "../session.js";

describe("SessionManager", () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager();
  });

  it("creates a session with a code and password", () => {
    const session = manager.create("alice");
    expect(session.code).toMatch(/^pv-[a-z0-9]+$/);
    expect(session.password).toBeTruthy();
    expect(session.hostUser).toBe("alice");
  });

  it("validates a correct session code + password", () => {
    const session = manager.create("alice");
    expect(manager.validate(session.code, session.password)).toBe(true);
  });

  it("rejects wrong password", () => {
    const session = manager.create("alice");
    expect(manager.validate(session.code, "wrong")).toBe(false);
  });

  it("rejects unknown session code", () => {
    expect(manager.validate("pv-nonexistent", "any")).toBe(false);
  });

  it("adds a guest to a session", () => {
    const session = manager.create("alice");
    manager.addGuest(session.code, "bob");
    const info = manager.getSession(session.code);
    expect(info?.guestUser).toBe("bob");
  });

  it("expires sessions after timeout", () => {
    vi.useFakeTimers();
    const session = manager.create("alice");
    vi.advanceTimersByTime(5 * 60 * 1000 + 1); // 5 min + 1ms
    expect(manager.validate(session.code, session.password)).toBe(false);
    vi.useRealTimers();
  });

  it("does not expire claimed sessions", () => {
    vi.useFakeTimers();
    const session = manager.create("alice");
    manager.addGuest(session.code, "bob");
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(manager.validate(session.code, session.password)).toBe(true);
    vi.useRealTimers();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/session.test.ts
```
Expected: FAIL

**Step 3: Implement**

Create `src/session.ts`:
```typescript
import { nanoid } from "nanoid";
import { randomBytes } from "node:crypto";

export interface Session {
  code: string;
  password: string;
  hostUser: string;
  guestUser?: string;
  createdAt: number;
}

const UNCLAIMED_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export class SessionManager {
  private sessions = new Map<string, Session>();

  create(hostUser: string): Session {
    const code = `pv-${nanoid(8).toLowerCase()}`;
    const password = randomBytes(4).toString("hex"); // 8-char hex
    const session: Session = {
      code,
      password,
      hostUser,
      createdAt: Date.now(),
    };
    this.sessions.set(code, session);
    return session;
  }

  validate(code: string, password: string): boolean {
    const session = this.sessions.get(code);
    if (!session) return false;
    if (!session.guestUser && Date.now() - session.createdAt > UNCLAIMED_EXPIRY_MS) {
      this.sessions.delete(code);
      return false;
    }
    return session.password === password;
  }

  addGuest(code: string, guestUser: string): void {
    const session = this.sessions.get(code);
    if (session) {
      session.guestUser = guestUser;
    }
  }

  getSession(code: string): Session | undefined {
    return this.sessions.get(code);
  }

  destroy(code: string): void {
    this.sessions.delete(code);
  }
}
```

**Step 4: Run tests**

```bash
npx vitest run src/__tests__/session.test.ts
```
Expected: PASS (all 7 tests)

**Step 5: Commit**

```bash
git add src/session.ts src/__tests__/session.test.ts
git commit -m "feat: add session manager with codes, auth, and expiry"
```

---

## Task 5: Claude Code Integration

**Files:**
- Create: `src/claude.ts`
- Create: `src/__tests__/claude.test.ts`

**Step 1: Write the test**

Create `src/__tests__/claude.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { ClaudeBridge, type ClaudeEvent } from "../claude.js";

// We mock the Agent SDK since we can't run Claude in tests
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
}));

describe("ClaudeBridge", () => {
  it("formats prompts with user attribution", () => {
    const bridge = new ClaudeBridge();
    const formatted = bridge.formatPrompt("bob", "fix the login bug");
    expect(formatted).toBe("[bob]: fix the login bug");
  });

  it("formats prompts from host without prefix option", () => {
    const bridge = new ClaudeBridge();
    const formatted = bridge.formatPrompt("alice", "do something", { isHost: true });
    expect(formatted).toBe("[alice (host)]: do something");
  });

  it("emits events from the event emitter interface", () => {
    const bridge = new ClaudeBridge();
    const events: ClaudeEvent[] = [];
    bridge.on("event", (e) => events.push(e));
    bridge.emit("event", { type: "stream_chunk", text: "hello" });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("stream_chunk");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/claude.test.ts
```
Expected: FAIL

**Step 3: Implement**

Create `src/claude.ts`:
```typescript
import { EventEmitter } from "node:events";

export type ClaudeEvent =
  | { type: "stream_chunk"; text: string }
  | { type: "tool_use"; tool: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool: string; output: string }
  | { type: "turn_complete"; cost: number; durationMs: number }
  | { type: "error"; message: string };

interface FormatOptions {
  isHost?: boolean;
}

export class ClaudeBridge extends EventEmitter {
  private sessionId?: string;
  private isRunning = false;

  formatPrompt(user: string, text: string, options?: FormatOptions): string {
    const label = options?.isHost ? `${user} (host)` : user;
    return `[${label}]: ${text}`;
  }

  async sendPrompt(user: string, text: string, options?: FormatOptions): Promise<void> {
    if (this.isRunning) {
      throw new Error("Claude is already processing a prompt");
    }
    this.isRunning = true;
    const formattedPrompt = this.formatPrompt(user, text, options);

    try {
      // Dynamic import to allow mocking and to avoid hard failure
      // if the SDK is not installed
      const { query } = await import("@anthropic-ai/claude-agent-sdk");

      for await (const message of query({
        prompt: formattedPrompt,
        options: {
          includePartialMessages: true,
          ...(this.sessionId ? { resume: this.sessionId } : {}),
        },
      })) {
        if (message.type === "system" && "session_id" in message) {
          this.sessionId = message.session_id as string;
        }

        if (message.type === "stream_event") {
          const event = (message as any).event;
          if (event?.type === "content_block_delta" && event.delta?.type === "text_delta") {
            this.emit("event", { type: "stream_chunk", text: event.delta.text } satisfies ClaudeEvent);
          }
        }

        if (message.type === "tool_use" || (message as any).tool) {
          this.emit("event", {
            type: "tool_use",
            tool: (message as any).tool || "unknown",
            input: (message as any).input || {},
          } satisfies ClaudeEvent);
        }

        if (message.type === "result") {
          this.emit("event", {
            type: "turn_complete",
            cost: (message as any).cost || 0,
            durationMs: (message as any).duration_ms || 0,
          } satisfies ClaudeEvent);
        }
      }
    } catch (err) {
      this.emit("event", {
        type: "error",
        message: err instanceof Error ? err.message : String(err),
      } satisfies ClaudeEvent);
    } finally {
      this.isRunning = false;
    }
  }

  getSessionId(): string | undefined {
    return this.sessionId;
  }

  isBusy(): boolean {
    return this.isRunning;
  }
}
```

**Step 4: Run tests**

```bash
npx vitest run src/__tests__/claude.test.ts
```
Expected: PASS (all 3 tests)

**Step 5: Commit**

```bash
git add src/claude.ts src/__tests__/claude.test.ts
git commit -m "feat: add Claude Code bridge with Agent SDK integration"
```

---

## Task 6: WebSocket Server (Host Side)

**Files:**
- Create: `src/server.ts`
- Create: `src/__tests__/server.test.ts`

**Step 1: Write the test**

Create `src/__tests__/server.test.ts`:
```typescript
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
    ws.send(JSON.stringify({
      type: "join",
      user: "bob",
      passwordHash: "wrongpassword",
      timestamp: Date.now(),
    }));

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

    ws.send(JSON.stringify({
      type: "join",
      user: "bob",
      passwordHash: "test1234",
      timestamp: Date.now(),
    }));

    const response = await new Promise<any>((resolve) => {
      ws.on("message", (data) => resolve(JSON.parse(data.toString())));
    });

    expect(response.type).toBe("join_accepted");
    expect(response.hostUser).toBe("alice");
    ws.close();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/server.test.ts
```
Expected: FAIL

**Step 3: Implement**

Create `src/server.ts`:
```typescript
import { WebSocketServer, WebSocket } from "ws";
import { EventEmitter } from "node:events";
import type { ClientMessage, ServerMessage } from "./protocol.js";
import { isJoinRequest, isPromptMessage, isApprovalResponse, isPresenceMessage } from "./protocol.js";

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
        const listeningPort = typeof addr === "object" ? addr.port : 0;
        resolve(listeningPort);
      });
      this.wss.on("connection", (ws) => this.handleConnection(ws));
    });
  }

  private handleConnection(ws: WebSocket): void {
    // Only allow one guest
    if (this.guest) {
      ws.send(JSON.stringify({
        type: "join_rejected",
        reason: "Session is full",
        timestamp: Date.now(),
      } satisfies ServerMessage));
      ws.close();
      return;
    }

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
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
```

**Step 4: Run tests**

```bash
npx vitest run src/__tests__/server.test.ts
```
Expected: PASS (all 4 tests)

**Step 5: Commit**

```bash
git add src/server.ts src/__tests__/server.test.ts
git commit -m "feat: add WebSocket server with auth and single-guest model"
```

---

## Task 7: WebSocket Client (Joiner Side)

**Files:**
- Create: `src/client.ts`
- Create: `src/__tests__/client.test.ts`

**Step 1: Write the test**

Create `src/__tests__/client.test.ts`:
```typescript
import { describe, it, expect, afterEach } from "vitest";
import { ClaudeDuetServer } from "../server.js";
import { ClaudeDuetClient } from "../client.js";

describe("ClaudeDuetClient", () => {
  let server: ClaudeDuetServer;
  let client: ClaudeDuetClient;

  afterEach(async () => {
    if (client) await client.disconnect();
    if (server) await server.stop();
  });

  it("connects and joins with correct password", async () => {
    server = new ClaudeDuetServer({ hostUser: "alice", password: "test1234" });
    const port = await server.start();

    client = new ClaudeDuetClient();
    const result = await client.connect(`ws://localhost:${port}`, "bob", "test1234");
    expect(result.type).toBe("join_accepted");
    expect(result.hostUser).toBe("alice");
  });

  it("fails to join with wrong password", async () => {
    server = new ClaudeDuetServer({ hostUser: "alice", password: "test1234" });
    const port = await server.start();

    client = new ClaudeDuetClient();
    await expect(
      client.connect(`ws://localhost:${port}`, "bob", "wrongpass")
    ).rejects.toThrow("Invalid password");
  });

  it("receives broadcast messages", async () => {
    server = new ClaudeDuetServer({ hostUser: "alice", password: "test1234" });
    const port = await server.start();

    client = new ClaudeDuetClient();
    await client.connect(`ws://localhost:${port}`, "bob", "test1234");

    const messages: any[] = [];
    client.on("message", (msg) => messages.push(msg));

    server.broadcast({
      type: "stream_chunk",
      text: "Hello from Claude",
      timestamp: Date.now(),
    });

    // Wait for message delivery
    await new Promise((r) => setTimeout(r, 50));
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe("stream_chunk");
  });

  it("sends prompts to server", async () => {
    server = new ClaudeDuetServer({ hostUser: "alice", password: "test1234" });
    const port = await server.start();

    client = new ClaudeDuetClient();
    await client.connect(`ws://localhost:${port}`, "bob", "test1234");

    const prompts: any[] = [];
    server.on("prompt", (msg) => prompts.push(msg));

    client.sendPrompt("fix the bug");

    await new Promise((r) => setTimeout(r, 50));
    expect(prompts).toHaveLength(1);
    expect(prompts[0].user).toBe("bob");
    expect(prompts[0].text).toBe("fix the bug");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/client.test.ts
```
Expected: FAIL

**Step 3: Implement**

Create `src/client.ts`:
```typescript
import WebSocket from "ws";
import { EventEmitter } from "node:events";
import { nanoid } from "nanoid";
import type { ClientMessage, ServerMessage, JoinAccepted } from "./protocol.js";

export class ClaudeDuetClient extends EventEmitter {
  private ws?: WebSocket;
  private user?: string;

  async connect(url: string, user: string, password: string): Promise<JoinAccepted> {
    this.user = user;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);

      this.ws.on("open", () => {
        this.ws!.send(JSON.stringify({
          type: "join",
          user,
          passwordHash: password,
          timestamp: Date.now(),
        } satisfies ClientMessage));
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
      // Ignore malformed
    }
  }

  sendPrompt(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected");
    }
    this.ws.send(JSON.stringify({
      type: "prompt",
      id: nanoid(8),
      user: this.user!,
      text,
      timestamp: Date.now(),
    } satisfies ClientMessage));
  }

  sendApprovalResponse(promptId: string, approved: boolean): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      type: "approval_response",
      promptId,
      approved,
      timestamp: Date.now(),
    } satisfies ClientMessage));
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
```

**Step 4: Run tests**

```bash
npx vitest run src/__tests__/client.test.ts
```
Expected: PASS (all 4 tests)

**Step 5: Commit**

```bash
git add src/client.ts src/__tests__/client.test.ts
git commit -m "feat: add WebSocket client with join, messaging, and prompts"
```

---

## Task 8: Prompt Router (Orchestrator)

**Files:**
- Create: `src/router.ts`
- Create: `src/__tests__/router.test.ts`

This is the core orchestrator that wires the server, Claude bridge, and approval logic together.

**Step 1: Write the test**

Create `src/__tests__/router.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PromptRouter } from "../router.js";
import { ClaudeBridge } from "../claude.js";
import { ClaudeDuetServer } from "../server.js";
import type { PromptMessage } from "../protocol.js";

// Mock Claude bridge
vi.mock("../claude.js", () => ({
  ClaudeBridge: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    sendPrompt: vi.fn().mockResolvedValue(undefined),
    formatPrompt: vi.fn((user: string, text: string) => `[${user}]: ${text}`),
    isBusy: vi.fn().mockReturnValue(false),
  })),
}));

describe("PromptRouter", () => {
  it("routes host prompts directly to Claude", async () => {
    const claude = new ClaudeBridge();
    const server = { broadcast: vi.fn(), on: vi.fn() } as any;

    const router = new PromptRouter(claude, server, { hostUser: "alice", approvalMode: true });

    const msg: PromptMessage = {
      type: "prompt",
      id: "1",
      user: "alice",
      text: "fix the bug",
      timestamp: Date.now(),
    };

    await router.handlePrompt(msg);
    expect(claude.sendPrompt).toHaveBeenCalledWith("alice", "fix the bug", { isHost: true });
  });

  it("queues guest prompts for approval when approval mode is on", async () => {
    const claude = new ClaudeBridge();
    const server = { broadcast: vi.fn(), on: vi.fn() } as any;

    const router = new PromptRouter(claude, server, { hostUser: "alice", approvalMode: true });

    const msg: PromptMessage = {
      type: "prompt",
      id: "1",
      user: "bob",
      text: "delete everything",
      timestamp: Date.now(),
    };

    await router.handlePrompt(msg);

    // Should NOT call Claude directly
    expect(claude.sendPrompt).not.toHaveBeenCalled();
    // Should broadcast approval request
    expect(server.broadcast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "approval_request", user: "bob" })
    );
  });

  it("routes guest prompts directly when approval mode is off", async () => {
    const claude = new ClaudeBridge();
    const server = { broadcast: vi.fn(), on: vi.fn() } as any;

    const router = new PromptRouter(claude, server, { hostUser: "alice", approvalMode: false });

    const msg: PromptMessage = {
      type: "prompt",
      id: "1",
      user: "bob",
      text: "fix the bug",
      timestamp: Date.now(),
    };

    await router.handlePrompt(msg);
    expect(claude.sendPrompt).toHaveBeenCalledWith("bob", "fix the bug", { isHost: false });
  });

  it("executes prompt after approval", async () => {
    const claude = new ClaudeBridge();
    const server = { broadcast: vi.fn(), on: vi.fn() } as any;

    const router = new PromptRouter(claude, server, { hostUser: "alice", approvalMode: true });

    // Queue a prompt
    const msg: PromptMessage = {
      type: "prompt",
      id: "prompt-1",
      user: "bob",
      text: "fix the bug",
      timestamp: Date.now(),
    };
    await router.handlePrompt(msg);

    // Approve it
    await router.handleApproval({ promptId: "prompt-1", approved: true });
    expect(claude.sendPrompt).toHaveBeenCalledWith("bob", "fix the bug", { isHost: false });
  });

  it("discards prompt after rejection", async () => {
    const claude = new ClaudeBridge();
    const server = { broadcast: vi.fn(), on: vi.fn() } as any;

    const router = new PromptRouter(claude, server, { hostUser: "alice", approvalMode: true });

    const msg: PromptMessage = {
      type: "prompt",
      id: "prompt-1",
      user: "bob",
      text: "delete everything",
      timestamp: Date.now(),
    };
    await router.handlePrompt(msg);
    await router.handleApproval({ promptId: "prompt-1", approved: false });

    expect(claude.sendPrompt).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/router.test.ts
```
Expected: FAIL

**Step 3: Implement**

Create `src/router.ts`:
```typescript
import type { ClaudeBridge } from "./claude.js";
import type { ClaudeDuetServer } from "./server.js";
import type { PromptMessage, ServerMessage } from "./protocol.js";

interface RouterOptions {
  hostUser: string;
  approvalMode: boolean;
}

interface PendingPrompt {
  msg: PromptMessage;
  timestamp: number;
}

export class PromptRouter {
  private pending = new Map<string, PendingPrompt>();
  private claude: ClaudeBridge;
  private server: ClaudeDuetServer;
  private options: RouterOptions;

  constructor(claude: ClaudeBridge, server: ClaudeDuetServer, options: RouterOptions) {
    this.claude = claude;
    this.server = server;
    this.options = options;
  }

  async handlePrompt(msg: PromptMessage): Promise<void> {
    const isHost = msg.user === this.options.hostUser;

    // Broadcast that prompt was received
    this.server.broadcast({
      type: "prompt_received",
      promptId: msg.id,
      user: msg.user,
      text: msg.text,
      timestamp: Date.now(),
    });

    if (isHost || !this.options.approvalMode) {
      await this.executePrompt(msg, isHost);
      return;
    }

    // Queue for approval
    this.pending.set(msg.id, { msg, timestamp: Date.now() });
    this.server.broadcast({
      type: "approval_request",
      promptId: msg.id,
      user: msg.user,
      text: msg.text,
      timestamp: Date.now(),
    });
  }

  async handleApproval(response: { promptId: string; approved: boolean }): Promise<void> {
    const pending = this.pending.get(response.promptId);
    if (!pending) return;

    this.pending.delete(response.promptId);

    if (response.approved) {
      await this.executePrompt(pending.msg, false);
    }
    // If rejected, just discard silently
  }

  private async executePrompt(msg: PromptMessage, isHost: boolean): Promise<void> {
    await this.claude.sendPrompt(msg.user, msg.text, { isHost });
  }

  setApprovalMode(enabled: boolean): void {
    this.options.approvalMode = enabled;
  }
}
```

**Step 4: Run tests**

```bash
npx vitest run src/__tests__/router.test.ts
```
Expected: PASS (all 5 tests)

**Step 5: Commit**

```bash
git add src/router.ts src/__tests__/router.test.ts
git commit -m "feat: add prompt router with approval mode"
```

---

## Task 9: Connection Layer (LAN Auto-Detect + Optional Remote)

**Files:**
- Create: `src/connection.ts`
- Create: `src/relay-server.ts`
- Create: `src/__tests__/connection.test.ts`

**Design:** Zero third-party relay dependencies. Connection tiers:
1. **Direct LAN** (default) — auto-detect local IP, display for sharing
2. **Cloudflare Quick Tunnel** (opt-in) — user's own `cloudflared` binary, no account needed
3. **Self-hosted relay** (opt-in) — `claude-duet relay` command, ~50 LOC WebSocket proxy included in package
4. **Custom URL** — `--url ws://anything` for SSH tunnels, Tailscale, VPN, etc.

**Step 1: Write the tests**

Create `src/__tests__/connection.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { getLocalIP, formatConnectionInfo } from "../connection.js";

describe("connection utilities", () => {
  it("detects a local IP address", () => {
    const ip = getLocalIP();
    // Should return a non-loopback IPv4 address
    expect(ip).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
    expect(ip).not.toBe("127.0.0.1");
  });

  it("formats connection info for LAN mode", () => {
    const info = formatConnectionInfo({ mode: "lan", host: "192.168.1.42", port: 9876 });
    expect(info.url).toBe("ws://192.168.1.42:9876");
    expect(info.displayUrl).toBe("ws://192.168.1.42:9876");
  });

  it("formats connection info for tunnel mode", () => {
    const info = formatConnectionInfo({
      mode: "tunnel",
      host: "random-slug.trycloudflare.com",
      port: 443,
    });
    expect(info.url).toBe("wss://random-slug.trycloudflare.com");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/connection.test.ts
```
Expected: FAIL

**Step 3: Implement connection utilities**

Create `src/connection.ts`:
```typescript
import { networkInterfaces } from "node:os";
import { spawn, type ChildProcess } from "node:child_process";

export function getLocalIP(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "127.0.0.1";
}

export interface ConnectionInfo {
  url: string;
  displayUrl: string;
  mode: "lan" | "tunnel" | "relay" | "custom";
  cleanup?: () => void;
}

export function formatConnectionInfo(opts: {
  mode: "lan" | "tunnel" | "relay" | "custom";
  host: string;
  port: number;
}): ConnectionInfo {
  if (opts.mode === "tunnel") {
    const url = `wss://${opts.host}`;
    return { url, displayUrl: url, mode: opts.mode };
  }
  const url = `ws://${opts.host}:${opts.port}`;
  return { url, displayUrl: url, mode: opts.mode };
}

// Cloudflare Quick Tunnel — user must have `cloudflared` installed
export async function startCloudflareTunnel(localPort: number): Promise<ConnectionInfo> {
  return new Promise((resolve, reject) => {
    const proc = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${localPort}`], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    const timeout = setTimeout(() => {
      proc.kill();
      reject(new Error(
        "cloudflared timed out. Install it with: brew install cloudflared"
      ));
    }, 30000);

    // cloudflared prints the URL to stderr
    proc.stderr!.on("data", (data: Buffer) => {
      stderr += data.toString();
      const match = stderr.match(/https:\/\/[\w-]+\.trycloudflare\.com/);
      if (match) {
        clearTimeout(timeout);
        const httpsUrl = match[0];
        const wssUrl = httpsUrl.replace("https://", "wss://");
        resolve({
          url: wssUrl,
          displayUrl: wssUrl,
          mode: "tunnel",
          cleanup: () => proc.kill(),
        });
      }
    });

    proc.on("error", () => {
      clearTimeout(timeout);
      reject(new Error(
        "cloudflared not found. Install: brew install cloudflared\n" +
        "Or use --url to connect directly (LAN, SSH tunnel, Tailscale, etc.)"
      ));
    });
  });
}
```

**Step 4: Implement the self-hosted relay server**

Create `src/relay-server.ts`:
```typescript
import { WebSocketServer, WebSocket } from "ws";

// A minimal WebSocket relay server (~50 LOC) that teams can self-host.
// It pairs two clients into a "room" and relays messages between them.
// It sees only ciphertext (E2E encrypted by the clients).

interface Room {
  host?: WebSocket;
  guest?: WebSocket;
}

export function startRelayServer(port: number): void {
  const rooms = new Map<string, Room>();
  const wss = new WebSocketServer({ port });

  console.log(`claude-duet relay listening on ws://0.0.0.0:${port}`);

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "/", `http://localhost:${port}`);
    const roomId = url.searchParams.get("room");
    const role = url.searchParams.get("role"); // "host" or "guest"

    if (!roomId || !role) {
      ws.close(4000, "Missing room or role query param");
      return;
    }

    let room = rooms.get(roomId);
    if (!room) {
      room = {};
      rooms.set(roomId, room);
    }

    if (role === "host") {
      if (room.host) {
        ws.close(4001, "Room already has a host");
        return;
      }
      room.host = ws;
    } else {
      if (room.guest) {
        ws.close(4002, "Room already has a guest");
        return;
      }
      room.guest = ws;
    }

    // Relay messages to the other peer (opaque — we don't parse them)
    ws.on("message", (data) => {
      const peer = role === "host" ? room!.guest : room!.host;
      if (peer?.readyState === WebSocket.OPEN) {
        peer.send(data);
      }
    });

    ws.on("close", () => {
      if (role === "host") room!.host = undefined;
      else room!.guest = undefined;
      // Clean up empty rooms
      if (!room!.host && !room!.guest) {
        rooms.delete(roomId);
      }
    });
  });
}
```

**Step 5: Run tests**

```bash
npx vitest run src/__tests__/connection.test.ts
```
Expected: PASS (all 3 tests)

**Step 6: Commit**

```bash
git add src/connection.ts src/relay-server.ts src/__tests__/connection.test.ts
git commit -m "feat: add connection layer with LAN auto-detect, Cloudflare tunnel, and self-hosted relay"
```

---

## Task 10: Setup Wizard (@clack/prompts)

**Files:**
- Create: `src/wizard.ts`

The interactive setup flow that runs when user types `claude-duet` with no args.
Uses @clack/prompts for beautiful Claude Code-inspired interactive prompts.

**Step 1: Implement the wizard**

Create `src/wizard.ts`:
```typescript
import * as p from "@clack/prompts";
import pc from "picocolors";

export interface WizardResult {
  mode: "host" | "join" | "relay";
  name: string;
  // Host options
  connectionType?: "lan" | "ssh" | "cloudflare" | "relay";
  trustMode?: "approval" | "trusted";
  port?: number;
  relayUrl?: string;
  // Join options
  sessionCode?: string;
  password?: string;
  url?: string;
  // Relay options
  relayPort?: number;
}

export async function runWizard(): Promise<WizardResult | null> {
  p.intro(`${pc.bgCyan(pc.black(" claude-duet "))} ${pc.dim("v0.1.0")}`);

  const mode = await p.select({
    message: "What would you like to do?",
    options: [
      { value: "host", label: "Host a session", hint: "you run Claude Code" },
      { value: "join", label: "Join a session", hint: "connect to a partner" },
      { value: "relay", label: "Run a relay server", hint: "for remote teams" },
    ],
  }) as "host" | "join" | "relay";

  if (p.isCancel(mode)) { p.cancel("Cancelled."); return null; }

  const name = await p.text({
    message: "Your display name?",
    placeholder: process.env.USER || "developer",
    defaultValue: process.env.USER || "developer",
  }) as string;

  if (p.isCancel(name)) { p.cancel("Cancelled."); return null; }

  if (mode === "host") return runHostWizard(name);
  if (mode === "join") return runJoinWizard(name);
  return runRelayWizard(name);
}

async function runHostWizard(name: string): Promise<WizardResult | null> {
  const connectionType = await p.select({
    message: "How will your partner connect?",
    options: [
      { value: "lan", label: "Same network (LAN / VPN)", hint: "default, no setup needed" },
      { value: "ssh", label: "SSH tunnel", hint: "partner has SSH access to this machine" },
      { value: "cloudflare", label: "Cloudflare tunnel", hint: "requires cloudflared installed" },
      { value: "relay", label: "Self-hosted relay", hint: "connect via your team's relay server" },
    ],
  }) as "lan" | "ssh" | "cloudflare" | "relay";

  if (p.isCancel(connectionType)) { p.cancel("Cancelled."); return null; }

  let relayUrl: string | undefined;
  if (connectionType === "relay") {
    relayUrl = await p.text({
      message: "Relay server URL?",
      placeholder: "wss://relay.mycompany.com",
    }) as string;
    if (p.isCancel(relayUrl)) { p.cancel("Cancelled."); return null; }
  }

  const trustMode = await p.select({
    message: "Trust mode?",
    options: [
      { value: "approval", label: "Approval mode", hint: "you review partner's prompts before execution" },
      { value: "trusted", label: "Trusted mode", hint: "partner's prompts execute immediately" },
    ],
  }) as "approval" | "trusted";

  if (p.isCancel(trustMode)) { p.cancel("Cancelled."); return null; }

  return { mode: "host", name, connectionType, trustMode, relayUrl };
}

async function runJoinWizard(name: string): Promise<WizardResult | null> {
  const sessionCode = await p.text({
    message: "Session code?",
    placeholder: "pv-xxxxxxxx",
    validate: (v) => v.startsWith("pv-") ? undefined : "Session codes start with pv-",
  }) as string;

  if (p.isCancel(sessionCode)) { p.cancel("Cancelled."); return null; }

  const password = await p.password({
    message: "Password?",
  }) as string;

  if (p.isCancel(password)) { p.cancel("Cancelled."); return null; }

  const url = await p.text({
    message: "Connection URL?",
    placeholder: "ws://192.168.1.42:9876",
    validate: (v) => v.startsWith("ws://") || v.startsWith("wss://") ? undefined : "Must start with ws:// or wss://",
  }) as string;

  if (p.isCancel(url)) { p.cancel("Cancelled."); return null; }

  return { mode: "join", name, sessionCode, password, url };
}

async function runRelayWizard(name: string): Promise<WizardResult | null> {
  const relayPort = await p.text({
    message: "Relay server port?",
    placeholder: "9877",
    defaultValue: "9877",
  }) as string;

  if (p.isCancel(relayPort)) { p.cancel("Cancelled."); return null; }

  return { mode: "relay", name, relayPort: parseInt(relayPort, 10) };
}
```

**Step 2: Commit**

```bash
git add src/wizard.ts
git commit -m "feat: add interactive setup wizard with @clack/prompts"
```

---

## Task 10b: Session TUI (Ink + React)

**Files:**
- Create: `src/ui/App.tsx`
- Create: `src/ui/StatusBar.tsx`
- Create: `src/ui/ChatView.tsx`
- Create: `src/ui/InputBar.tsx`

The active session UI built with Ink (React for terminal), same framework as Claude Code.

**Step 1: Implement the Ink components**

Create `src/ui/StatusBar.tsx`:
```tsx
import React from "react";
import { Box, Text } from "ink";

interface Props {
  hostUser: string;
  guestUser?: string;
  sessionCode: string;
  connectionMode: string;
  cost: number;
  contextPercent: number;
}

export function StatusBar({ hostUser, guestUser, sessionCode, connectionMode, cost, contextPercent }: Props) {
  return (
    <Box justifyContent="space-between" borderStyle="single" borderColor="gray" paddingX={1}>
      <Box gap={1}>
        <Text color="cyan" bold>claude-duet</Text>
        <Text dimColor>──</Text>
        <Text color="blue">{hostUser} (host)</Text>
        <Text color="green">●</Text>
        {guestUser ? (
          <>
            <Text color="magenta">{guestUser} (guest)</Text>
            <Text color="green">●</Text>
          </>
        ) : (
          <Text dimColor>waiting...</Text>
        )}
        <Text dimColor>──</Text>
        <Text dimColor>{sessionCode}</Text>
        <Text dimColor>──</Text>
        <Text dimColor>{connectionMode}</Text>
      </Box>
      <Box gap={2}>
        <Text dimColor>${cost.toFixed(4)}</Text>
        <Text dimColor>{contextPercent}% ctx</Text>
      </Box>
    </Box>
  );
}
```

Create `src/ui/ChatView.tsx`:
```tsx
import React from "react";
import { Box, Text } from "ink";

export interface ChatMessage {
  id: string;
  type: "prompt" | "response" | "tool" | "system" | "session_event";
  user?: string;
  isHost?: boolean;
  text: string;
  timestamp: number;
}

interface Props {
  messages: ChatMessage[];
}

export function ChatView({ messages }: Props) {
  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      {messages.map((msg) => {
        switch (msg.type) {
          case "prompt":
            return (
              <Box key={msg.id} marginTop={1}>
                <Text color={msg.isHost ? "blue" : "magenta"} bold>
                  [{msg.user}{msg.isHost ? " (host)" : ""}]:
                </Text>
                <Text> {msg.text}</Text>
              </Box>
            );
          case "response":
            return <Text key={msg.id}>{msg.text}</Text>;
          case "tool":
            return <Text key={msg.id} dimColor>  [tool] {msg.text}</Text>;
          case "system":
            return <Text key={msg.id} dimColor>  {msg.text}</Text>;
          case "session_event":
            return (
              <Box key={msg.id} marginY={1}>
                <Text color="yellow" bold>  ✦ {msg.text}</Text>
              </Box>
            );
          default:
            return null;
        }
      })}
    </Box>
  );
}
```

Create `src/ui/App.tsx` — the root component that wires everything together:
```tsx
import React, { useState, useEffect } from "react";
import { Box, useApp, useInput } from "ink";
import { StatusBar } from "./StatusBar.js";
import { ChatView, type ChatMessage } from "./ChatView.js";

interface AppProps {
  role: "host" | "guest";
  userName: string;
  sessionCode: string;
  connectionMode: string;
  onInput: (text: string) => void;
  onCommand: (cmd: string) => void;
}

export function App({ role, userName, sessionCode, connectionMode, onInput, onCommand }: AppProps) {
  const { exit } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [guestUser, setGuestUser] = useState<string>();
  const [cost, setCost] = useState(0);
  const [contextPercent, setContextPercent] = useState(0);

  // Expose state setters for external wiring
  (globalThis as any).__claudeDuet = {
    addMessage: (msg: ChatMessage) => setMessages(prev => [...prev, msg]),
    setGuestUser,
    setCost,
    setContextPercent,
  };

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      onCommand("/quit");
      exit();
    }
  });

  return (
    <Box flexDirection="column" height="100%">
      <StatusBar
        hostUser={role === "host" ? userName : guestUser || "host"}
        guestUser={role === "guest" ? userName : guestUser}
        sessionCode={sessionCode}
        connectionMode={connectionMode}
        cost={cost}
        contextPercent={contextPercent}
      />
      <ChatView messages={messages} />
      <Box paddingX={1} borderStyle="single" borderColor="gray">
        <Box gap={4}>
          <Text dimColor>/end  /quit  /trust  /kick</Text>
        </Box>
      </Box>
    </Box>
  );
}
```

**Step 2: Commit**

```bash
git add src/ui/
git commit -m "feat: add Ink-based session TUI with status bar, chat view, and commands"
```

---

## Task 11: CLI Commands — `host`, `join`, and `relay`

**Files:**
- Modify: `src/index.ts`
- Create: `src/commands/host.ts`
- Create: `src/commands/join.ts`

**Step 1: Create host command**

Create `src/commands/host.ts`:
```typescript
import { ClaudeDuetServer } from "../server.js";
import { ClaudeBridge } from "../claude.js";
import { PromptRouter } from "../router.js";
import { TerminalUI } from "../ui.js";
import { getLocalIP, formatConnectionInfo, startCloudflareTunnel, type ConnectionInfo } from "../connection.js";
import { SessionManager } from "../session.js";

interface HostOptions {
  name: string;
  noApproval: boolean;
  tunnel?: "cloudflare";
  relay?: string;
  port: number;
}

export async function hostCommand(options: HostOptions): Promise<void> {
  const sessionManager = new SessionManager();
  const session = sessionManager.create(options.name);
  const approvalMode = !options.noApproval;

  const ui = new TerminalUI({ userName: options.name, role: "host" });
  const claude = new ClaudeBridge();
  const server = new ClaudeDuetServer({
    hostUser: options.name,
    password: session.password,
    approvalMode,
  });

  // Start WebSocket server
  const port = await server.start(options.port || 0);

  // Determine connection mode
  let connInfo: ConnectionInfo;
  if (options.tunnel === "cloudflare") {
    try {
      ui.showSystem("Starting Cloudflare tunnel...");
      connInfo = await startCloudflareTunnel(port);
      ui.showSystem(`Tunnel ready: ${connInfo.displayUrl}`);
    } catch (err) {
      ui.showError(String(err));
      const localIP = getLocalIP();
      connInfo = formatConnectionInfo({ mode: "lan", host: localIP, port });
    }
  } else if (options.relay) {
    connInfo = formatConnectionInfo({ mode: "relay", host: options.relay, port: 0 });
    ui.showSystem(`Using relay: ${options.relay}`);
  } else {
    // Default: LAN direct connection
    const localIP = getLocalIP();
    connInfo = formatConnectionInfo({ mode: "lan", host: localIP, port });
  }

  ui.showWelcome(session.code, session.password);
  ui.showSystem(`Connect URL: ${connInfo.displayUrl}`);

  // Wire up Claude events → server broadcast
  claude.on("event", (event) => {
    switch (event.type) {
      case "stream_chunk":
        ui.showStreamChunk(event.text);
        server.broadcast({ ...event, timestamp: Date.now() });
        break;
      case "tool_use":
        ui.showToolUse(event.tool, event.input);
        server.broadcast({ ...event, timestamp: Date.now() });
        break;
      case "tool_result":
        ui.showToolResult(event.tool, event.output);
        server.broadcast({ ...event, timestamp: Date.now() });
        break;
      case "turn_complete":
        ui.showTurnComplete(event.cost, event.durationMs);
        server.broadcast({ ...event, timestamp: Date.now() });
        break;
      case "error":
        ui.showError(event.message);
        server.broadcast({ type: "error", message: event.message, timestamp: Date.now() });
        break;
    }
  });

  // Wire up router
  const router = new PromptRouter(claude, server, {
    hostUser: options.name,
    approvalMode,
  });

  // Guest prompt → router
  server.on("prompt", (msg) => {
    ui.showUserPrompt(msg.user, msg.text, false);
    router.handlePrompt(msg);
  });

  // Guest joined/left
  server.on("guest_joined", (user: string) => {
    sessionManager.addGuest(session.code, user);
    ui.showPartnerJoined(user);
  });

  server.on("guest_left", () => {
    ui.showPartnerLeft(server.getGuestUser() || "partner");
  });

  // Host input → router
  ui.onInput((text) => {
    const msg = {
      type: "prompt" as const,
      id: `host-${Date.now()}`,
      user: options.name,
      text,
      timestamp: Date.now(),
    };
    ui.showUserPrompt(options.name, text, true);
    server.broadcast({ type: "prompt_received", promptId: msg.id, user: msg.user, text: msg.text, timestamp: Date.now() });
    router.handlePrompt(msg);
  });

  // Host approval
  ui.onApproval((promptId, approved) => {
    router.handleApproval({ promptId, approved });
    if (!approved) {
      ui.showSystem("Prompt rejected.");
    }
  });

  // Approval requests shown to host
  server.on("server_message", (msg) => {
    if (msg.type === "approval_request") {
      ui.showApprovalRequest(msg.promptId, msg.user, msg.text);
    }
  });

  // Cleanup on exit
  process.on("SIGINT", async () => {
    ui.showSystem("Shutting down...");
    if (tunnel) stopTunnel(tunnel);
    await server.stop();
    ui.close();
    process.exit(0);
  });
}
```

**Step 2: Create join command**

Create `src/commands/join.ts`:
```typescript
import { ClaudeDuetClient } from "../client.js";
import { TerminalUI } from "../ui.js";

interface JoinOptions {
  name: string;
  password: string;
  url?: string;
}

export async function joinCommand(sessionCode: string, options: JoinOptions): Promise<void> {
  const ui = new TerminalUI({ userName: options.name, role: "guest" });

  const serverUrl = options.url || await resolveSessionUrl(sessionCode);

  ui.showSystem(`Connecting to ${serverUrl}...`);

  const client = new ClaudeDuetClient();

  try {
    const result = await client.connect(serverUrl, options.name, options.password);
    ui.showSystem(`Connected! You're duet coding with ${result.hostUser}.`);
    if (result.approvalMode) {
      ui.showSystem("Approval mode is ON — host will review your prompts.");
    }
    console.log("");
  } catch (err) {
    ui.showError(`Failed to join: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  // Wire messages from server → UI
  client.on("message", (msg) => {
    switch (msg.type) {
      case "prompt_received":
        ui.showUserPrompt(msg.user, msg.text, false);
        break;
      case "stream_chunk":
        ui.showStreamChunk(msg.text);
        break;
      case "tool_use":
        ui.showToolUse(msg.tool, msg.input);
        break;
      case "tool_result":
        ui.showToolResult(msg.tool, msg.output);
        break;
      case "turn_complete":
        ui.showTurnComplete(msg.cost, msg.durationMs);
        break;
      case "error":
        ui.showError(msg.message);
        break;
    }
  });

  // Wire user input → server
  ui.onInput((text) => {
    client.sendPrompt(text);
  });

  client.on("disconnected", () => {
    ui.showError("Disconnected from session.");
    ui.close();
    process.exit(1);
  });

  process.on("SIGINT", async () => {
    ui.showSystem("Leaving session...");
    await client.disconnect();
    ui.close();
    process.exit(0);
  });
}

async function resolveSessionUrl(sessionCode: string): Promise<string> {
  // For MVP: session code is used with a known relay
  // In future: session code could encode the URL
  throw new Error(
    `Cannot resolve session "${sessionCode}" — use --url to specify the server URL directly.\n` +
    `  Example: claude-duet join ${sessionCode} --url ws://localhost:3000`
  );
}
```

**Step 3: Wire up the CLI entry point**

Rewrite `src/index.ts`:
```typescript
#!/usr/bin/env node

import { Command } from "commander";
import { hostCommand } from "./commands/host.js";
import { joinCommand } from "./commands/join.js";
import { startRelayServer } from "./relay-server.js";

const program = new Command();

program
  .name("claude-duet")
  .description("Claude Duet — share a Claude Code session with a partner")
  .version("0.1.0");

program
  .command("host")
  .description("Start a claude-duet session as host")
  .option("-n, --name <name>", "your display name", process.env.USER || "host")
  .option("--no-approval", "disable approval mode (trust your partner)")
  .option("--tunnel <provider>", "use a tunnel for remote access (cloudflare)")
  .option("--relay <url>", "use a relay server for remote access")
  .option("-p, --port <port>", "WebSocket server port", "0")
  .action((options) => {
    hostCommand({
      name: options.name,
      noApproval: !options.approval,
      tunnel: options.tunnel,
      relay: options.relay,
      port: parseInt(options.port, 10),
    });
  });

program
  .command("join <session-code>")
  .description("Join an existing claude-duet session")
  .option("-n, --name <name>", "your display name", process.env.USER || "guest")
  .option("--password <password>", "session password")
  .option("--url <url>", "WebSocket URL (direct, SSH tunnel, VPN, etc.)")
  .option("--relay <url>", "connect via a relay server")
  .action((sessionCode, options) => {
    if (!options.password) {
      console.error("Error: --password is required");
      process.exit(1);
    }
    joinCommand(sessionCode, {
      name: options.name,
      password: options.password,
      url: options.url,
      relay: options.relay,
    });
  });

program
  .command("relay")
  .description("Run a self-hosted relay server for remote claude-duet sessions")
  .option("-p, --port <port>", "relay server port", "9877")
  .action((options) => {
    startRelayServer(parseInt(options.port, 10));
  });

program.parse();
```

**Step 4: Build and test the CLI**

```bash
npx tsc
node dist/index.js --help
node dist/index.js host --help
node dist/index.js join --help
node dist/index.js relay --help
```
Expected: Help text for all commands

**Step 5: Commit**

```bash
mkdir -p src/commands
git add src/index.ts src/commands/host.ts src/commands/join.ts
git commit -m "feat: add CLI commands for host and join"
```

---

## Task 12: Integration Test — Full Flow

**Files:**
- Create: `src/__tests__/integration.test.ts`

**Step 1: Write the integration test**

Create `src/__tests__/integration.test.ts`:
```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { ClaudeDuetServer } from "../server.js";
import { ClaudeDuetClient } from "../client.js";
import { PromptRouter } from "../router.js";
import { ClaudeBridge } from "../claude.js";

// Mock Claude to avoid real API calls
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
}));

describe("integration: host + guest full flow", () => {
  let server: ClaudeDuetServer;
  let client: ClaudeDuetClient;

  afterEach(async () => {
    if (client) await client.disconnect();
    if (server) await server.stop();
  });

  it("guest connects, sends prompt, host approves, Claude responds", async () => {
    // Setup host
    server = new ClaudeDuetServer({
      hostUser: "alice",
      password: "test1234",
      approvalMode: true,
    });
    const port = await server.start();

    const claude = new ClaudeBridge();
    const router = new PromptRouter(claude, server, {
      hostUser: "alice",
      approvalMode: true,
    });

    // Wire server events to router
    server.on("prompt", (msg) => router.handlePrompt(msg));

    // Track approval requests
    const approvalRequests: any[] = [];
    server.on("server_message", (msg) => {
      if (msg.type === "approval_request") {
        approvalRequests.push(msg);
      }
    });

    // Guest connects
    client = new ClaudeDuetClient();
    await client.connect(`ws://localhost:${port}`, "bob", "test1234");

    // Guest sends prompt
    client.sendPrompt("fix the bug");
    await new Promise((r) => setTimeout(r, 100));

    // Verify approval was requested
    expect(approvalRequests).toHaveLength(1);
    expect(approvalRequests[0].user).toBe("bob");
    expect(approvalRequests[0].text).toBe("fix the bug");

    // Host approves
    const sendPromptSpy = vi.spyOn(claude, "sendPrompt").mockResolvedValue();
    await router.handleApproval({ promptId: approvalRequests[0].promptId, approved: true });

    // Verify Claude was called
    expect(sendPromptSpy).toHaveBeenCalledWith("bob", "fix the bug", { isHost: false });
  });

  it("guest receives streamed responses", async () => {
    server = new ClaudeDuetServer({
      hostUser: "alice",
      password: "test1234",
    });
    const port = await server.start();

    client = new ClaudeDuetClient();
    await client.connect(`ws://localhost:${port}`, "bob", "test1234");

    const messages: any[] = [];
    client.on("message", (msg) => messages.push(msg));

    // Simulate Claude streaming
    server.broadcast({ type: "stream_chunk", text: "Here ", timestamp: Date.now() });
    server.broadcast({ type: "stream_chunk", text: "is the fix", timestamp: Date.now() });
    server.broadcast({ type: "turn_complete", cost: 0.01, durationMs: 1500, timestamp: Date.now() });

    await new Promise((r) => setTimeout(r, 100));

    expect(messages).toHaveLength(3);
    expect(messages[0].text).toBe("Here ");
    expect(messages[1].text).toBe("is the fix");
    expect(messages[2].type).toBe("turn_complete");
  });
});
```

**Step 2: Run integration tests**

```bash
npx vitest run src/__tests__/integration.test.ts
```
Expected: PASS (all 2 tests)

**Step 3: Run full test suite**

```bash
npx vitest run
```
Expected: ALL tests pass

**Step 4: Commit**

```bash
git add src/__tests__/integration.test.ts
git commit -m "test: add integration tests for full host-guest flow"
```

---

## Task 13: Polish & Package

**Files:**
- Modify: `package.json` (add bin, engines, files)
- Create: `README.md`

**Step 1: Update package.json**

Add to `package.json`:
```json
{
  "engines": { "node": ">=18" },
  "files": ["dist", "README.md", "LICENSE"],
  "repository": {
    "type": "git",
    "url": "https://github.com/elirang/claude-duet"
  }
}
```

**Step 2: Build and verify the bin works**

```bash
npx tsc
node dist/index.js --help
```
Expected: Prints help with host and join commands

**Step 3: Test locally as global package**

```bash
npm link
claude-duet --help
claude-duet host --help
claude-duet join --help
```
Expected: All help commands work

**Step 4: Commit**

```bash
git add package.json
git commit -m "chore: finalize package.json for npm publishing"
```

---

---

## Task 13: Session Lifecycle Manager

**Files:**
- Create: `src/lifecycle.ts`
- Create: `src/__tests__/lifecycle.test.ts`

Handles clear session start/end, graceful shutdown, session summary, and logs.

**Step 1: Write the test**

Create `src/__tests__/lifecycle.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionLifecycle, type SessionStats } from "../lifecycle.js";

describe("SessionLifecycle", () => {
  let lifecycle: SessionLifecycle;

  beforeEach(() => {
    lifecycle = new SessionLifecycle("pv-test123", "alice");
  });

  it("tracks session start time", () => {
    lifecycle.start();
    expect(lifecycle.isActive()).toBe(true);
    expect(lifecycle.getStartTime()).toBeGreaterThan(0);
  });

  it("tracks prompt counts by user", () => {
    lifecycle.start();
    lifecycle.recordPrompt("alice");
    lifecycle.recordPrompt("alice");
    lifecycle.recordPrompt("bob");
    const stats = lifecycle.getStats();
    expect(stats.promptsByUser["alice"]).toBe(2);
    expect(stats.promptsByUser["bob"]).toBe(1);
  });

  it("tracks turn count and cost", () => {
    lifecycle.start();
    lifecycle.recordTurn(0.01, 1500);
    lifecycle.recordTurn(0.02, 2000);
    const stats = lifecycle.getStats();
    expect(stats.turns).toBe(2);
    expect(stats.totalCost).toBeCloseTo(0.03);
  });

  it("generates end summary", () => {
    lifecycle.start();
    lifecycle.recordPrompt("alice");
    lifecycle.recordPrompt("bob");
    lifecycle.recordTurn(0.05, 3000);
    const summary = lifecycle.end("host_ended");
    expect(summary.reason).toBe("host_ended");
    expect(summary.stats.turns).toBe(1);
    expect(summary.stats.totalCost).toBeCloseTo(0.05);
    expect(summary.durationMs).toBeGreaterThan(0);
    expect(lifecycle.isActive()).toBe(false);
  });

  it("handles multiple end calls gracefully", () => {
    lifecycle.start();
    const summary1 = lifecycle.end("host_ended");
    const summary2 = lifecycle.end("host_ended");
    expect(summary1).toBeDefined();
    expect(summary2).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/lifecycle.test.ts
```
Expected: FAIL

**Step 3: Implement**

Create `src/lifecycle.ts`:
```typescript
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export interface SessionStats {
  turns: number;
  totalCost: number;
  promptsByUser: Record<string, number>;
}

export interface SessionSummary {
  sessionCode: string;
  hostUser: string;
  reason: "host_ended" | "guest_ended" | "host_quit" | "guest_quit" | "disconnected" | "sigint" | "sighup";
  startedAt: number;
  endedAt: number;
  durationMs: number;
  stats: SessionStats;
}

type EndReason = SessionSummary["reason"];

export class SessionLifecycle {
  private sessionCode: string;
  private hostUser: string;
  private startedAt = 0;
  private active = false;
  private turns = 0;
  private totalCost = 0;
  private promptsByUser: Record<string, number> = {};
  private log: string[] = [];

  constructor(sessionCode: string, hostUser: string) {
    this.sessionCode = sessionCode;
    this.hostUser = hostUser;
  }

  start(): void {
    this.startedAt = Date.now();
    this.active = true;
    this.log.push(`[${new Date().toISOString()}] Session started: ${this.sessionCode}`);
  }

  isActive(): boolean {
    return this.active;
  }

  getStartTime(): number {
    return this.startedAt;
  }

  recordPrompt(user: string): void {
    this.promptsByUser[user] = (this.promptsByUser[user] || 0) + 1;
    this.log.push(`[${new Date().toISOString()}] Prompt from ${user}`);
  }

  recordTurn(cost: number, durationMs: number): void {
    this.turns++;
    this.totalCost += cost;
    this.log.push(`[${new Date().toISOString()}] Turn ${this.turns}: $${cost.toFixed(4)}, ${durationMs}ms`);
  }

  getStats(): SessionStats {
    return {
      turns: this.turns,
      totalCost: this.totalCost,
      promptsByUser: { ...this.promptsByUser },
    };
  }

  end(reason: EndReason): SessionSummary | null {
    if (!this.active) return null;
    this.active = false;
    const endedAt = Date.now();
    this.log.push(`[${new Date().toISOString()}] Session ended: ${reason}`);

    const summary: SessionSummary = {
      sessionCode: this.sessionCode,
      hostUser: this.hostUser,
      reason,
      startedAt: this.startedAt,
      endedAt,
      durationMs: endedAt - this.startedAt,
      stats: this.getStats(),
    };

    this.saveLog(summary);
    return summary;
  }

  private saveLog(summary: SessionSummary): void {
    try {
      const dir = join(process.cwd(), ".claude-duet", "sessions");
      mkdirSync(dir, { recursive: true });
      const content = [
        `Session: ${summary.sessionCode}`,
        `Host: ${summary.hostUser}`,
        `Duration: ${Math.round(summary.durationMs / 1000 / 60)} minutes`,
        `Turns: ${summary.stats.turns}`,
        `Cost: $${summary.stats.totalCost.toFixed(4)}`,
        `Ended: ${summary.reason}`,
        "",
        "--- Log ---",
        ...this.log,
      ].join("\n");
      writeFileSync(join(dir, `${summary.sessionCode}.log`), content);
    } catch {
      // Best-effort logging — don't crash if we can't write
    }
  }
}
```

**Step 4: Run tests**

```bash
npx vitest run src/__tests__/lifecycle.test.ts
```
Expected: PASS (all 5 tests)

**Step 5: Commit**

```bash
git add src/lifecycle.ts src/__tests__/lifecycle.test.ts
git commit -m "feat: add session lifecycle manager with stats, summary, and logging"
```

---

## Task 14: Open Source Packaging

**Files:**
- Create: `LICENSE`
- Create: `README.md`
- Create: `CONTRIBUTING.md`
- Create: `.github/workflows/ci.yml`
- Modify: `package.json` (add repository, keywords, etc.)
- Create: `.claude-duet` entry in `.gitignore`

**Step 1: Create LICENSE (MIT)**

```
MIT License

Copyright (c) 2026 Eliran G

Permission is hereby granted, free of charge, to any person obtaining a copy
...
```

**Step 2: Create README.md**

Include:
- ASCII art banner
- One-line description
- Quick start (install, host, join)
- Connection modes table with examples
- Security model summary
- Session commands (/end, /quit, /trust, /kick)
- Contributing link
- License

**Step 3: Create CONTRIBUTING.md**

Include:
- How to set up dev environment
- How to run tests
- PR guidelines
- Code of conduct reference

**Step 4: Create GitHub Actions CI**

Create `.github/workflows/ci.yml`:
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm run build
      - run: npm test
```

**Step 5: Update .gitignore**

Add:
```
.claude-duet/
```

**Step 6: Update package.json**

Add repository, bugs, homepage, keywords, engines, files fields.

**Step 7: Commit**

```bash
git add LICENSE README.md CONTRIBUTING.md .github/ .gitignore package.json
git commit -m "chore: add open source packaging — LICENSE, README, CI, CONTRIBUTING"
```

---

## Task 15: Integration Test — Full Flow

Same as previous Task 12, renumbered.

---

## Task Summary

| Task | What | Tests |
|------|------|-------|
| 1 | Project scaffolding | Build verification |
| 2 | Message protocol types | 4 tests |
| 3 | E2E encryption | 4 tests |
| 4 | Session manager | 7 tests |
| 5 | Claude Code bridge | 3 tests |
| 6 | WebSocket server | 4 tests |
| 7 | WebSocket client | 4 tests |
| 8 | Prompt router + approval | 5 tests |
| 9 | Connection layer (LAN + Cloudflare + SSH docs + relay) | 3 tests |
| 10a | Setup wizard (@clack/prompts) | Visual / manual |
| 10b | Session TUI (Ink + React) | Visual / manual |
| 11 | CLI commands (host + join + relay) | CLI verification |
| 12 | Integration wiring (commands ↔ server ↔ Claude ↔ UI) | Manual |
| 13 | Session lifecycle manager | 5 tests |
| 14 | Open source packaging (LICENSE, README, CI, CONTRIBUTING) | CI passing |
| 15 | Full integration test | 2 tests |

**Total: 15 tasks, ~41 tests, ~15 commits**

**Usage modes:**
```
claude-duet                                   # Interactive wizard
claude-duet host                              # LAN direct (default, skip wizard)
claude-duet host --tunnel cloudflare          # Cloudflare Quick Tunnel
claude-duet host --relay wss://relay.co       # Self-hosted relay
claude-duet relay                             # Run the relay server (~50 LOC)
claude-duet join <code> --url ws://...        # Any URL (SSH tunnel, VPN, etc.)
```

**Session commands:**
```
/end      — end session (summary shown to both users)
/quit     — leave session (host leaving = session ends)
/trust    — toggle approval mode off
/kick     — remove partner (host only)
Ctrl+C    — graceful shutdown with summary
```
