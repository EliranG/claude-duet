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

    const router = new PromptRouter(claude, server, { hostUser: "eliran", approvalMode: true });

    const msg: PromptMessage = {
      type: "prompt",
      id: "1",
      user: "eliran",
      text: "fix the bug",
      timestamp: Date.now(),
    };

    await router.handlePrompt(msg);
    expect(claude.sendPrompt).toHaveBeenCalledWith("eliran", "fix the bug", { isHost: true });
  });

  it("queues guest prompts for approval when approval mode is on", async () => {
    const claude = new ClaudeBridge();
    const server = { broadcast: vi.fn(), on: vi.fn() } as any;

    const router = new PromptRouter(claude, server, { hostUser: "eliran", approvalMode: true });

    const msg: PromptMessage = {
      type: "prompt",
      id: "1",
      user: "benji",
      text: "delete everything",
      timestamp: Date.now(),
    };

    await router.handlePrompt(msg);

    // Should NOT call Claude directly
    expect(claude.sendPrompt).not.toHaveBeenCalled();
    // Should broadcast approval request
    expect(server.broadcast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "approval_request", user: "benji" })
    );
  });

  it("routes guest prompts directly when approval mode is off", async () => {
    const claude = new ClaudeBridge();
    const server = { broadcast: vi.fn(), on: vi.fn() } as any;

    const router = new PromptRouter(claude, server, { hostUser: "eliran", approvalMode: false });

    const msg: PromptMessage = {
      type: "prompt",
      id: "1",
      user: "benji",
      text: "fix the bug",
      timestamp: Date.now(),
    };

    await router.handlePrompt(msg);
    expect(claude.sendPrompt).toHaveBeenCalledWith("benji", "fix the bug", { isHost: false });
  });

  it("executes prompt after approval", async () => {
    const claude = new ClaudeBridge();
    const server = { broadcast: vi.fn(), on: vi.fn() } as any;

    const router = new PromptRouter(claude, server, { hostUser: "eliran", approvalMode: true });

    // Queue a prompt
    const msg: PromptMessage = {
      type: "prompt",
      id: "prompt-1",
      user: "benji",
      text: "fix the bug",
      timestamp: Date.now(),
    };
    await router.handlePrompt(msg);

    // Approve it
    await router.handleApproval({ promptId: "prompt-1", approved: true });
    expect(claude.sendPrompt).toHaveBeenCalledWith("benji", "fix the bug", { isHost: false });
  });

  it("discards prompt after rejection", async () => {
    const claude = new ClaudeBridge();
    const server = { broadcast: vi.fn(), on: vi.fn() } as any;

    const router = new PromptRouter(claude, server, { hostUser: "eliran", approvalMode: true });

    const msg: PromptMessage = {
      type: "prompt",
      id: "prompt-1",
      user: "benji",
      text: "delete everything",
      timestamp: Date.now(),
    };
    await router.handlePrompt(msg);
    await router.handleApproval({ promptId: "prompt-1", approved: false });

    expect(claude.sendPrompt).not.toHaveBeenCalled();
  });
});
