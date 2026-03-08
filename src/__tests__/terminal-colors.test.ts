import { describe, it, expect } from "vitest";
import { pickSessionBackground, applyBackground, restoreBackground } from "../terminal-colors.js";

describe("terminal-colors", () => {
  it("pickSessionBackground returns an ANSI escape code", () => {
    const bg = pickSessionBackground();
    expect(bg.apply).toMatch(/^\x1b\[/);
  });

  it("pickSessionBackground returns different colors across calls", () => {
    const colors = new Set<string>();
    for (let i = 0; i < 20; i++) {
      colors.add(pickSessionBackground().name);
    }
    expect(colors.size).toBeGreaterThan(1);
  });

  it("applyBackground returns an ANSI string", () => {
    const bg = pickSessionBackground();
    const result = applyBackground(bg);
    expect(typeof result).toBe("string");
    expect(result).toContain("\x1b[");
  });

  it("restoreBackground returns reset sequence", () => {
    const result = restoreBackground();
    expect(result).toContain("\x1b[");
  });

  it("picks colors with good text contrast", () => {
    const bg = pickSessionBackground();
    expect(["white", "black"]).toContain(bg.textColor);
  });
});
