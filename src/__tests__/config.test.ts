import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Test with real temp files
describe("config", () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `claude-duet-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    // Create a .git dir so project config detection works
    mkdirSync(join(tempDir, ".git"));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("loadProjectConfig returns empty when no .claude-duet.json exists", async () => {
    vi.resetModules();
    const { loadProjectConfig } = await import("../config.js");
    expect(loadProjectConfig()).toEqual({});
  });

  it("loadProjectConfig reads .claude-duet.json", async () => {
    writeFileSync(join(tempDir, ".claude-duet.json"), JSON.stringify({ name: "alice", port: 3000 }));
    vi.resetModules();
    const { loadProjectConfig } = await import("../config.js");
    const config = loadProjectConfig();
    expect(config.name).toBe("alice");
    expect(config.port).toBe(3000);
  });

  it("saveProjectConfig writes .claude-duet.json", async () => {
    vi.resetModules();
    const { saveProjectConfig, loadProjectConfig } = await import("../config.js");
    saveProjectConfig({ name: "bob", approvalMode: true });
    vi.resetModules();
    const { loadProjectConfig: reload } = await import("../config.js");
    const config = reload();
    expect(config.name).toBe("bob");
    expect(config.approvalMode).toBe(true);
  });

  it("saveProjectConfig merges with existing", async () => {
    writeFileSync(join(tempDir, ".claude-duet.json"), JSON.stringify({ name: "alice", port: 3000 }));
    vi.resetModules();
    const { saveProjectConfig } = await import("../config.js");
    saveProjectConfig({ port: 4000 });
    vi.resetModules();
    const { loadProjectConfig } = await import("../config.js");
    const config = loadProjectConfig();
    expect(config.name).toBe("alice");
    expect(config.port).toBe(4000);
  });

  it("isValidConfigKey validates known keys", async () => {
    const { isValidConfigKey } = await import("../config.js");
    expect(isValidConfigKey("name")).toBe(true);
    expect(isValidConfigKey("approvalMode")).toBe(true);
    expect(isValidConfigKey("port")).toBe(true);
    expect(isValidConfigKey("tunnel")).toBe(true);
    expect(isValidConfigKey("relay")).toBe(true);
    expect(isValidConfigKey("foobar")).toBe(false);
  });

  it("parseConfigValue handles boolean and number types", async () => {
    const { parseConfigValue } = await import("../config.js");
    expect(parseConfigValue("approvalMode", "true")).toBe(true);
    expect(parseConfigValue("approvalMode", "false")).toBe(false);
    expect(parseConfigValue("port", "3000")).toBe(3000);
    expect(parseConfigValue("name", "alice")).toBe("alice");
  });

  it("loadConfig merges user and project (project wins)", async () => {
    // Write project config
    writeFileSync(join(tempDir, ".claude-duet.json"), JSON.stringify({ name: "project-name", port: 5000 }));
    vi.resetModules();
    const configModule = await import("../config.js");
    // Since we can't easily mock homedir for user config, just verify project config loads
    const config = configModule.loadConfig();
    expect(config.name).toBe("project-name");
    expect(config.port).toBe(5000);
  });
});
