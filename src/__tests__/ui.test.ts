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
    ui = new TerminalUI({ userName: "alice", role: "host" });
    const handler = vi.fn();
    ui.onInput(handler);
    // Handler is stored (internal) — we verify by simulating input
    ui.simulateInput("hello");
    expect(handler).toHaveBeenCalledWith("hello");
  });

  it("stores approval handler via onApproval", () => {
    ui = new TerminalUI({ userName: "alice", role: "host" });
    const handler = vi.fn();
    ui.onApproval(handler);
    ui.simulateApproval("p1", true);
    expect(handler).toHaveBeenCalledWith("p1", true);
  });

  it("calls startInputLoop to begin reading stdin", () => {
    ui = new TerminalUI({ userName: "alice", role: "host" });
    // startInputLoop should not throw
    expect(() => ui.startInputLoop()).not.toThrow();
  });

  it("showUserPrompt displays formatted message", () => {
    ui = new TerminalUI({ userName: "bob", role: "guest" });
    ui.showUserPrompt("bob", "hello world", false);
    expect(console.log).toHaveBeenCalled();
    const calls = (console.log as any).mock.calls;
    const output = calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("bob");
    expect(output).toContain("hello world");
  });

  it("showWelcome displays session info", () => {
    ui = new TerminalUI({ userName: "alice", role: "host" });
    ui.showWelcome("pv-abc123", "secret");
    expect(console.log).toHaveBeenCalled();
  });

  it("showWelcome displays a copy-paste join command", () => {
    ui = new TerminalUI({ userName: "alice", role: "host" });
    ui.showWelcome("pv-abc123", "secret", "ws://192.168.1.5:4567");
    const calls = (console.log as any).mock.calls;
    const output = calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("npx pair-vibe join pv-abc123 --password secret --url ws://192.168.1.5:4567");
  });

  it("applies terminal background on showWelcome", () => {
    ui = new TerminalUI({ userName: "alice", role: "host" });
    ui.showWelcome("pv-abc123", "secret", "ws://localhost:3000");
    const allWrites = (process.stdout.write as any).mock.calls.map((c: any[]) => String(c[0])).join("");
    expect(allWrites).toContain("\x1b[48;2;");
  });

  it("restores terminal background on close", () => {
    ui = new TerminalUI({ userName: "alice", role: "host" });
    ui.showWelcome("pv-abc123", "secret", "ws://localhost:3000");
    ui.close();
    const allWrites = (process.stdout.write as any).mock.calls.map((c: any[]) => String(c[0])).join("");
    expect(allWrites).toContain("\x1b[0m");
  });

  it("showWelcome includes a Slack-friendly share message", () => {
    ui = new TerminalUI({ userName: "alice", role: "host" });
    ui.showWelcome("pv-abc123", "secret", "ws://192.168.1.5:4567");
    const calls = (console.log as any).mock.calls;
    const output = calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("pair-vibe");
    expect(output).toContain("Slack");
  });
});
