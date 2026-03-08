import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SessionManager } from "../session.js";

describe("SessionManager", () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager();
  });

  it("creates a session with a code and password", () => {
    const session = manager.create("alice");
    expect(session.code).toMatch(/^cd-[a-z0-9]+$/);
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
    expect(manager.validate("cd-nonexistent", "any")).toBe(false);
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
