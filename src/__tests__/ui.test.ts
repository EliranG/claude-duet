import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TerminalUI } from "../ui.js";

describe("TerminalUI", () => {
  let ui: TerminalUI;

  beforeEach(() => {
    // Suppress console output during tests
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    ui?.close();
    vi.restoreAllMocks();
  });

  it("stores input handler via onInput", () => {
    ui = new TerminalUI({ userName: "eliran", role: "host" });
    const handler = vi.fn();
    ui.onInput(handler);
    // Handler is stored (internal) — we verify by simulating input
    ui.simulateInput("hello");
    expect(handler).toHaveBeenCalledWith("hello");
  });

  it("stores approval handler via onApproval", () => {
    ui = new TerminalUI({ userName: "eliran", role: "host" });
    const handler = vi.fn();
    ui.onApproval(handler);
    ui.simulateApproval("p1", true);
    expect(handler).toHaveBeenCalledWith("p1", true);
  });

  it("calls startInputLoop to begin reading stdin", () => {
    ui = new TerminalUI({ userName: "eliran", role: "host" });
    // startInputLoop should not throw
    expect(() => ui.startInputLoop()).not.toThrow();
  });

  it("showUserPrompt displays formatted message", () => {
    ui = new TerminalUI({ userName: "benji", role: "guest" });
    ui.showUserPrompt("benji", "hello world", false);
    expect(console.log).toHaveBeenCalled();
    const calls = (console.log as any).mock.calls;
    const output = calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("benji");
    expect(output).toContain("hello world");
  });

  it("showWelcome displays session info", () => {
    ui = new TerminalUI({ userName: "eliran", role: "host" });
    ui.showWelcome("cd-abc123", "secret");
    expect(console.log).toHaveBeenCalled();
  });

  it("showWelcome displays a copy-paste join command", () => {
    ui = new TerminalUI({ userName: "eliran", role: "host" });
    ui.showWelcome("cd-abc123", "secret", "ws://192.168.1.5:4567");
    const calls = (console.log as any).mock.calls;
    const output = calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("npx claude-duet join cd-abc123 --password secret --url ws://192.168.1.5:4567");
  });

  it("applies terminal background on showWelcome", () => {
    ui = new TerminalUI({ userName: "eliran", role: "host" });
    ui.showWelcome("cd-abc123", "secret", "ws://localhost:3000");
    const allWrites = (process.stdout.write as any).mock.calls.map((c: any[]) => String(c[0])).join("");
    expect(allWrites).toContain("\x1b[48;2;");
  });

  it("restores terminal background on close", () => {
    ui = new TerminalUI({ userName: "eliran", role: "host" });
    ui.showWelcome("cd-abc123", "secret", "ws://localhost:3000");
    ui.close();
    const allWrites = (process.stdout.write as any).mock.calls.map((c: any[]) => String(c[0])).join("");
    expect(allWrites).toContain("\x1b[0m");
  });

  it("applySessionBackground writes an ANSI background escape", () => {
    ui = new TerminalUI({ userName: "benji", role: "guest" });
    ui.applySessionBackground();
    const allWrites = (process.stdout.write as any).mock.calls.map((c: any[]) => String(c[0])).join("");
    expect(allWrites).toContain("\x1b[48;2;");
  });

  it("close restores background after applySessionBackground", () => {
    ui = new TerminalUI({ userName: "benji", role: "guest" });
    ui.applySessionBackground();
    ui.close();
    const allWrites = (process.stdout.write as any).mock.calls.map((c: any[]) => String(c[0])).join("");
    // Should contain both apply and restore sequences
    expect(allWrites).toContain("\x1b[48;2;");
    expect(allWrites).toContain("\x1b[0m");
  });

  it("applySessionBackground is idempotent (only applies once)", () => {
    ui = new TerminalUI({ userName: "benji", role: "guest" });
    ui.applySessionBackground();
    ui.applySessionBackground(); // second call should be a no-op
    const writes = (process.stdout.write as any).mock.calls.filter(
      (c: any[]) => String(c[0]).includes("\x1b[48;2;")
    );
    expect(writes.length).toBe(1);
  });

  it("showWelcome shows instruction to share join command", () => {
    ui = new TerminalUI({ userName: "eliran", role: "host" });
    ui.showWelcome("cd-abc123", "secret", "ws://192.168.1.5:4567");
    const calls = (console.log as any).mock.calls;
    const output = calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("Send your partner this command to join");
  });

  it("showUserPrompt with mode 'claude' shows Claude indicator", () => {
    ui = new TerminalUI({ userName: "benji", role: "guest" });
    ui.showUserPrompt("benji", "fix the bug", false, "claude");
    const calls = (console.log as any).mock.calls;
    const output = calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("benji");
    expect(output).toContain("Claude");
    expect(output).toContain("fix the bug");
  });

  it("showClaudeThinking outputs thinking text", () => {
    ui = new TerminalUI({ userName: "eliran", role: "host" });
    ui.showClaudeThinking();
    const calls = (console.log as any).mock.calls;
    const output = calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("Claude is thinking");
  });

  it("showApprovalStatus('pending') shows waiting text", () => {
    ui = new TerminalUI({ userName: "benji", role: "guest" });
    ui.showApprovalStatus("pending");
    const calls = (console.log as any).mock.calls;
    const output = calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("Waiting for host to approve");
  });

  it("showApprovalStatus('approved') shows approved text", () => {
    ui = new TerminalUI({ userName: "benji", role: "guest" });
    ui.showApprovalStatus("approved");
    const calls = (console.log as any).mock.calls;
    const output = calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("Approved");
  });

  it("showApprovalStatus('rejected') shows rejected text", () => {
    ui = new TerminalUI({ userName: "benji", role: "guest" });
    ui.showApprovalStatus("rejected");
    const calls = (console.log as any).mock.calls;
    const output = calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("rejected");
  });

  it("showSessionSummary shows duration and message count", () => {
    ui = new TerminalUI({ userName: "eliran", role: "host" });
    ui.showSessionSummary({ duration: "5m 30s", messageCount: 12 });
    const calls = (console.log as any).mock.calls;
    const output = calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("Session ended");
    expect(output).toContain("5m 30s");
    expect(output).toContain("12");
  });

  it("showHint shows hint text", () => {
    ui = new TerminalUI({ userName: "eliran", role: "host" });
    ui.showHint("Type @claude to ask Claude");
    const calls = (console.log as any).mock.calls;
    const output = calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("Type @claude to ask Claude");
  });
});
