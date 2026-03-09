import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import type { HistoryMessage } from "./protocol.js";

/**
 * Encode a project path the same way Claude Code does for its project directory.
 * Claude Code uses the cwd path with slashes replaced by hyphens, e.g.:
 * /Users/alice/projects/myapp → -Users-alice-projects-myapp
 */
export function encodeProjectPath(projectPath: string): string {
  return projectPath.replace(/\//g, "-");
}

/**
 * Get the Claude Code projects directory for the current project.
 */
export function getProjectSessionDir(projectPath?: string): string {
  const cwd = projectPath || process.cwd();
  const encoded = encodeProjectPath(cwd);
  return join(homedir(), ".claude", "projects", encoded);
}

/**
 * Find and parse a session JSONL file into displayable HistoryMessages.
 */
export async function parseSessionHistory(
  sessionFilePath: string,
): Promise<HistoryMessage[]> {
  const content = await readFile(sessionFilePath, "utf-8");
  const lines = content.split("\n").filter(Boolean);
  const messages: HistoryMessage[] = [];

  for (const line of lines) {
    try {
      const record = JSON.parse(line);
      const parsed = parseRecord(record);
      if (parsed) messages.push(...parsed);
    } catch {
      // skip malformed lines
    }
  }

  return messages;
}

function parseRecord(record: any): HistoryMessage[] | null {
  if (!record || !record.type) return null;

  switch (record.type) {
    case "user":
      return parseUserRecord(record);
    case "assistant":
      return parseAssistantRecord(record);
    default:
      // Skip system, progress, file-history-snapshot, last-prompt
      return null;
  }
}

function parseUserRecord(record: any): HistoryMessage[] {
  const messages: HistoryMessage[] = [];
  const content = record.message?.content;
  if (!Array.isArray(content)) {
    // Simple text content
    if (typeof record.message?.content === "string") {
      messages.push({
        role: "user",
        text: record.message.content,
        timestamp: record.timestamp || Date.now(),
      });
    }
    return messages;
  }

  for (const block of content) {
    if (block.type === "text") {
      // Extract user name from attribution pattern [name]: text
      const match = block.text?.match(/^\[([^\]]+)\]:\s*(.+)$/s);
      messages.push({
        role: "user",
        user: match ? match[1] : undefined,
        text: match ? match[2] : (block.text || ""),
        timestamp: record.timestamp || Date.now(),
      });
    } else if (block.type === "tool_result") {
      messages.push({
        role: "tool",
        text:
          typeof block.content === "string"
            ? block.content.slice(0, 200)
            : "[tool result]",
        toolName: block.tool_use_id ? "tool" : undefined,
        timestamp: record.timestamp || Date.now(),
      });
    }
  }

  return messages;
}

function parseAssistantRecord(record: any): HistoryMessage[] {
  const messages: HistoryMessage[] = [];
  const content = record.message?.content;
  if (!Array.isArray(content)) return messages;

  for (const block of content) {
    if (block.type === "text" && block.text) {
      messages.push({
        role: "assistant",
        text: block.text,
        timestamp: record.timestamp || Date.now(),
      });
    } else if (block.type === "tool_use") {
      messages.push({
        role: "tool",
        text: `[${block.name}] ${JSON.stringify(block.input || {}).slice(0, 100)}`,
        toolName: block.name,
        timestamp: record.timestamp || Date.now(),
      });
    }
    // Skip "thinking" blocks
  }

  return messages;
}

/**
 * Find the session JSONL file for a given session ID.
 * Searches the project's session directory.
 */
export async function findSessionFile(
  sessionId: string,
  projectPath?: string,
): Promise<string | null> {
  const dir = getProjectSessionDir(projectPath);
  const filePath = join(dir, `${sessionId}.jsonl`);
  return existsSync(filePath) ? filePath : null;
}

/**
 * List available sessions for the current project, sorted by most recent first.
 */
export async function listSessions(
  projectPath?: string,
): Promise<
  Array<{
    sessionId: string;
    filePath: string;
    lastModified: Date;
  }>
> {
  const dir = getProjectSessionDir(projectPath);
  if (!existsSync(dir)) return [];

  try {
    const files = await readdir(dir);
    const sessions = files
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => ({
        sessionId: f.replace(".jsonl", ""),
        filePath: join(dir, f),
        lastModified: new Date(), // We'll use file stat in real impl
      }));
    return sessions;
  } catch {
    return [];
  }
}
