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

  it("showWelcome displays session info", () => {
    ui = new TerminalUI({ userName: "alice", role: "host" });
    ui.showWelcome("pv-abc123", "secret");
    expect(console.log).toHaveBeenCalled();
  });
});
