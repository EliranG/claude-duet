import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export interface SessionStats {
  turns: number;
  totalCost: number;
  promptsByUser: Record<string, number>;
}

export interface SessionSummary {
  sessionCode: string;
  hostUser: string;
  reason:
    | "host_ended"
    | "guest_ended"
    | "host_quit"
    | "guest_quit"
    | "disconnected"
    | "sigint"
    | "sighup";
  startedAt: number;
  endedAt: number;
  durationMs: number;
  stats: SessionStats;
}

type EndReason = SessionSummary["reason"];

export class SessionLifecycle {
  private sessionCode: string;
  private hostUser: string;
  private startedAt = 0;
  private active = false;
  private turns = 0;
  private totalCost = 0;
  private promptsByUser: Record<string, number> = {};
  private log: string[] = [];

  constructor(sessionCode: string, hostUser: string) {
    this.sessionCode = sessionCode;
    this.hostUser = hostUser;
  }

  start(): void {
    this.startedAt = Date.now();
    this.active = true;
    this.log.push(
      `[${new Date().toISOString()}] Session started: ${this.sessionCode}`,
    );
  }

  isActive(): boolean {
    return this.active;
  }

  getStartTime(): number {
    return this.startedAt;
  }

  recordPrompt(user: string): void {
    this.promptsByUser[user] = (this.promptsByUser[user] || 0) + 1;
    this.log.push(`[${new Date().toISOString()}] Prompt from ${user}`);
  }

  recordTurn(cost: number, durationMs: number): void {
    this.turns++;
    this.totalCost += cost;
    this.log.push(
      `[${new Date().toISOString()}] Turn ${this.turns}: $${cost.toFixed(4)}, ${durationMs}ms`,
    );
  }

  getStats(): SessionStats {
    return {
      turns: this.turns,
      totalCost: this.totalCost,
      promptsByUser: { ...this.promptsByUser },
    };
  }

  end(reason: EndReason): SessionSummary | null {
    if (!this.active) return null;
    this.active = false;
    const endedAt = Date.now();
    this.log.push(`[${new Date().toISOString()}] Session ended: ${reason}`);

    const summary: SessionSummary = {
      sessionCode: this.sessionCode,
      hostUser: this.hostUser,
      reason,
      startedAt: this.startedAt,
      endedAt,
      durationMs: endedAt - this.startedAt,
      stats: this.getStats(),
    };

    this.saveLog(summary);
    return summary;
  }

  private saveLog(summary: SessionSummary): void {
    try {
      const dir = join(process.cwd(), ".claude-duet", "sessions");
      mkdirSync(dir, { recursive: true });
      const content = [
        `Session: ${summary.sessionCode}`,
        `Host: ${summary.hostUser}`,
        `Duration: ${Math.round(summary.durationMs / 1000 / 60)} minutes`,
        `Turns: ${summary.stats.turns}`,
        `Cost: $${summary.stats.totalCost.toFixed(4)}`,
        `Ended: ${summary.reason}`,
        "",
        "--- Log ---",
        ...this.log,
      ].join("\n");
      writeFileSync(join(dir, `${summary.sessionCode}.log`), content);
    } catch {
      // Best-effort logging — don't crash if we can't write
    }
  }
}
