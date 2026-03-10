import { describe, it, expect } from "vitest";
import {
  isPromptMessage,
  isStreamChunk,
  isApprovalRequest,
  isPresenceMessage,
  isHistoryReplay,
  isTypingMessage,
  type PromptMessage,
  type StreamChunk,
} from "../protocol.js";

describe("protocol type guards", () => {
  it("identifies a prompt message", () => {
    const msg: PromptMessage = {
      type: "prompt",
      id: "abc",
      user: "benji",
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
      user: "benji",
      text: "delete all files",
      timestamp: Date.now(),
    };
    expect(isApprovalRequest(msg)).toBe(true);
  });

  it("identifies a presence message", () => {
    const msg = {
      type: "presence",
      users: [{ name: "eliran", role: "host" }],
      timestamp: Date.now(),
    };
    expect(isPresenceMessage(msg)).toBe(true);
  });

  it("identifies a history replay message", () => {
    const msg = {
      type: "history_replay",
      messages: [{ role: "user", text: "fix bug", timestamp: Date.now() }],
      sessionId: "abc-123",
      resumedFrom: 5,
      timestamp: Date.now(),
    };
    expect(isHistoryReplay(msg)).toBe(true);
    expect(isPromptMessage(msg)).toBe(false);
  });

  it("isTypingMessage identifies typing messages", () => {
    const msg = {
      type: "typing",
      user: "benji",
      isTyping: true,
      timestamp: 1,
    };
    expect(isTypingMessage(msg)).toBe(true);
  });

  it("isTypingMessage rejects non-typing messages", () => {
    const msg = {
      type: "chat",
      id: "abc",
      user: "benji",
      text: "hello",
      timestamp: Date.now(),
    };
    expect(isTypingMessage(msg)).toBe(false);
  });
});
