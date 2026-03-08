import { describe, it, expect, vi } from "vitest";
import { ClaudeBridge, type ClaudeEvent } from "../claude.js";

// We mock the Agent SDK since we can't run Claude in tests
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
}));

describe("ClaudeBridge", () => {
  it("formats prompts with user attribution", () => {
    const bridge = new ClaudeBridge();
    const formatted = bridge.formatPrompt("benji", "fix the login bug");
    expect(formatted).toBe("[benji]: fix the login bug");
  });

  it("formats prompts from host without prefix option", () => {
    const bridge = new ClaudeBridge();
    const formatted = bridge.formatPrompt("eliran", "do something", { isHost: true });
    expect(formatted).toBe("[eliran (host)]: do something");
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
