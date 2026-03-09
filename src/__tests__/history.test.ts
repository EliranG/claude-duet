import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  parseSessionHistory,
  encodeProjectPath,
  getProjectSessionDir,
  findSessionFile,
} from "../history.js";

describe("history", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `claude-duet-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function writeJsonl(filename: string, records: any[]): string {
    const filePath = join(tempDir, filename);
    const content = records.map((r) => JSON.stringify(r)).join("\n");
    writeFileSync(filePath, content, "utf-8");
    return filePath;
  }

  it("encodeProjectPath replaces slashes with hyphens", () => {
    expect(encodeProjectPath("/Users/alice/project")).toBe(
      "-Users-alice-project",
    );
    expect(encodeProjectPath("/a/b/c")).toBe("-a-b-c");
    expect(encodeProjectPath("no-slashes")).toBe("no-slashes");
  });

  it("getProjectSessionDir returns correct path", () => {
    const dir = getProjectSessionDir("/Users/alice/project");
    expect(dir).toContain(".claude/projects/-Users-alice-project");
  });

  it("parseSessionHistory extracts user text messages", async () => {
    const filePath = writeJsonl("session.jsonl", [
      {
        type: "user",
        timestamp: 1000,
        message: {
          content: [{ type: "text", text: "Hello world" }],
        },
      },
    ]);

    const messages = await parseSessionHistory(filePath);
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
    expect(messages[0].text).toBe("Hello world");
    expect(messages[0].timestamp).toBe(1000);
  });

  it("parseSessionHistory extracts assistant text messages", async () => {
    const filePath = writeJsonl("session.jsonl", [
      {
        type: "assistant",
        timestamp: 2000,
        message: {
          content: [{ type: "text", text: "I can help with that." }],
        },
      },
    ]);

    const messages = await parseSessionHistory(filePath);
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("assistant");
    expect(messages[0].text).toBe("I can help with that.");
    expect(messages[0].timestamp).toBe(2000);
  });

  it("parseSessionHistory extracts tool_use from assistant", async () => {
    const filePath = writeJsonl("session.jsonl", [
      {
        type: "assistant",
        timestamp: 3000,
        message: {
          content: [
            {
              type: "tool_use",
              name: "Read",
              input: { file_path: "/tmp/test.ts" },
            },
          ],
        },
      },
    ]);

    const messages = await parseSessionHistory(filePath);
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("tool");
    expect(messages[0].toolName).toBe("Read");
    expect(messages[0].text).toContain("[Read]");
    expect(messages[0].text).toContain("/tmp/test.ts");
  });

  it("parseSessionHistory skips thinking blocks", async () => {
    const filePath = writeJsonl("session.jsonl", [
      {
        type: "assistant",
        timestamp: 4000,
        message: {
          content: [
            { type: "thinking", text: "Let me think about this..." },
            { type: "text", text: "Here is my answer." },
          ],
        },
      },
    ]);

    const messages = await parseSessionHistory(filePath);
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("assistant");
    expect(messages[0].text).toBe("Here is my answer.");
  });

  it("parseSessionHistory skips system/progress records", async () => {
    const filePath = writeJsonl("session.jsonl", [
      {
        type: "system",
        timestamp: 5000,
        message: { content: "system init" },
      },
      {
        type: "progress",
        timestamp: 5001,
        message: { progress: 50 },
      },
      {
        type: "file-history-snapshot",
        timestamp: 5002,
        files: {},
      },
      {
        type: "last-prompt",
        timestamp: 5003,
      },
      {
        type: "user",
        timestamp: 5004,
        message: {
          content: [{ type: "text", text: "actual message" }],
        },
      },
    ]);

    const messages = await parseSessionHistory(filePath);
    expect(messages).toHaveLength(1);
    expect(messages[0].text).toBe("actual message");
  });

  it("parseSessionHistory handles malformed lines", async () => {
    const filePath = join(tempDir, "malformed.jsonl");
    const content = [
      "not valid json at all",
      JSON.stringify({
        type: "user",
        timestamp: 6000,
        message: { content: [{ type: "text", text: "valid line" }] },
      }),
      "{broken json",
    ].join("\n");
    writeFileSync(filePath, content, "utf-8");

    const messages = await parseSessionHistory(filePath);
    expect(messages).toHaveLength(1);
    expect(messages[0].text).toBe("valid line");
  });

  it("parseSessionHistory extracts user attribution from [name]: pattern", async () => {
    const filePath = writeJsonl("session.jsonl", [
      {
        type: "user",
        timestamp: 7000,
        message: {
          content: [
            { type: "text", text: "[alice (host)]: fix the bug" },
          ],
        },
      },
    ]);

    const messages = await parseSessionHistory(filePath);
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
    expect(messages[0].user).toBe("alice (host)");
    expect(messages[0].text).toBe("fix the bug");
  });

  it("findSessionFile returns path when file exists", async () => {
    // Create a fake session directory structure
    const projectPath = join(tempDir, "myproject");
    const encoded = encodeProjectPath(projectPath);
    const sessionDir = join(
      process.env.HOME!,
      ".claude",
      "projects",
      encoded,
    );
    mkdirSync(sessionDir, { recursive: true });
    const sessionFile = join(sessionDir, "test-session-123.jsonl");
    writeFileSync(sessionFile, '{"type":"user"}\n', "utf-8");

    try {
      const result = await findSessionFile("test-session-123", projectPath);
      expect(result).toBe(sessionFile);
    } finally {
      rmSync(sessionDir, { recursive: true, force: true });
    }
  });

  it("findSessionFile returns null when file doesn't exist", async () => {
    const result = await findSessionFile(
      "nonexistent-session-id",
      "/tmp/nonexistent-project-path-abc123",
    );
    expect(result).toBeNull();
  });
});
