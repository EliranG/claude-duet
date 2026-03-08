import { describe, it, expect, vi } from "vitest";
import { handleSlashCommand, type CommandContext } from "../commands/session-commands.js";

function createMockContext(overrides?: Partial<CommandContext>): CommandContext {
  return {
    ui: {
      showSystem: vi.fn(),
      showError: vi.fn(),
    } as any,
    role: "host",
    sessionCode: "cd-test123",
    partnerName: "bob",
    startTime: Date.now() - 120000, // 2 minutes ago
    onLeave: vi.fn(),
    onTrustChange: vi.fn(),
    onKick: vi.fn(),
    ...overrides,
  };
}

describe("session commands", () => {
  it("returns false for non-slash input", () => {
    const ctx = createMockContext();
    expect(handleSlashCommand("hello", ctx)).toBe(false);
    expect(handleSlashCommand("@claude help", ctx)).toBe(false);
  });

  it("/help shows available commands", () => {
    const ctx = createMockContext();
    expect(handleSlashCommand("/help", ctx)).toBe(true);
    const calls = (ctx.ui.showSystem as any).mock.calls.map((c: any[]) => c[0]).join("\n");
    expect(calls).toContain("/help");
    expect(calls).toContain("/status");
    expect(calls).toContain("/leave");
    expect(calls).toContain("@claude");
  });

  it("/help shows host-only commands for host", () => {
    const ctx = createMockContext({ role: "host" });
    handleSlashCommand("/help", ctx);
    const calls = (ctx.ui.showSystem as any).mock.calls.map((c: any[]) => c[0]).join("\n");
    expect(calls).toContain("/trust");
    expect(calls).toContain("/kick");
  });

  it("/help hides host-only commands for guest", () => {
    const ctx = createMockContext({ role: "guest" });
    handleSlashCommand("/help", ctx);
    const calls = (ctx.ui.showSystem as any).mock.calls.map((c: any[]) => c[0]).join("\n");
    expect(calls).not.toContain("/trust");
    expect(calls).not.toContain("/kick");
  });

  it("/leave calls onLeave", () => {
    const ctx = createMockContext();
    expect(handleSlashCommand("/leave", ctx)).toBe(true);
    expect(ctx.onLeave).toHaveBeenCalled();
  });

  it("/quit and /exit also call onLeave", () => {
    const ctx1 = createMockContext();
    handleSlashCommand("/quit", ctx1);
    expect(ctx1.onLeave).toHaveBeenCalled();

    const ctx2 = createMockContext();
    handleSlashCommand("/exit", ctx2);
    expect(ctx2.onLeave).toHaveBeenCalled();
  });

  it("/status shows session info", () => {
    const ctx = createMockContext();
    handleSlashCommand("/status", ctx);
    const calls = (ctx.ui.showSystem as any).mock.calls.map((c: any[]) => c[0]).join("\n");
    expect(calls).toContain("cd-test123");
    expect(calls).toContain("host");
    expect(calls).toContain("bob");
    expect(calls).toContain("2m");
  });

  it("/trust only works for host", () => {
    const guestCtx = createMockContext({ role: "guest" });
    handleSlashCommand("/trust", guestCtx);
    expect(guestCtx.onTrustChange).not.toHaveBeenCalled();

    const hostCtx = createMockContext({ role: "host" });
    handleSlashCommand("/trust", hostCtx);
    expect(hostCtx.onTrustChange).toHaveBeenCalledWith(true);
  });

  it("/approval only works for host", () => {
    const guestCtx = createMockContext({ role: "guest" });
    handleSlashCommand("/approval", guestCtx);
    expect(guestCtx.onTrustChange).not.toHaveBeenCalled();

    const hostCtx = createMockContext({ role: "host" });
    handleSlashCommand("/approval", hostCtx);
    expect(hostCtx.onTrustChange).toHaveBeenCalledWith(false);
  });

  it("/kick only works for host", () => {
    const guestCtx = createMockContext({ role: "guest" });
    handleSlashCommand("/kick", guestCtx);
    expect(guestCtx.onKick).not.toHaveBeenCalled();

    const hostCtx = createMockContext({ role: "host" });
    handleSlashCommand("/kick", hostCtx);
    expect(hostCtx.onKick).toHaveBeenCalled();
  });

  it("/kick reports no guest when none connected", () => {
    const ctx = createMockContext({ partnerName: undefined });
    handleSlashCommand("/kick", ctx);
    expect(ctx.onKick).not.toHaveBeenCalled();
    const calls = (ctx.ui.showSystem as any).mock.calls.map((c: any[]) => c[0]).join("\n");
    expect(calls).toContain("No guest");
  });

  it("/clear writes clear screen escape", () => {
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const ctx = createMockContext();
    handleSlashCommand("/clear", ctx);
    const output = writeSpy.mock.calls.map((c: any[]) => String(c[0])).join("");
    expect(output).toContain("\x1b[2J");
    writeSpy.mockRestore();
  });

  it("unknown command shows error message", () => {
    const ctx = createMockContext();
    handleSlashCommand("/foobar", ctx);
    const calls = (ctx.ui.showSystem as any).mock.calls.map((c: any[]) => c[0]).join("\n");
    expect(calls).toContain("Unknown command");
    expect(calls).toContain("/foobar");
  });
});
