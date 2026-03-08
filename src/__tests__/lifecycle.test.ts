import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionLifecycle, type SessionStats } from "../lifecycle.js";

describe("SessionLifecycle", () => {
  let lifecycle: SessionLifecycle;

  beforeEach(() => {
    lifecycle = new SessionLifecycle("cd-test123", "alice");
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
    expect(summary).not.toBeNull();
    expect(summary!.reason).toBe("host_ended");
    expect(summary!.stats.turns).toBe(1);
    expect(summary!.stats.totalCost).toBeCloseTo(0.05);
    expect(summary!.durationMs).toBeGreaterThanOrEqual(0);
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
