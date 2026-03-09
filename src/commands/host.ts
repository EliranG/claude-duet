import { ClaudeDuetServer } from "../server.js";
import { ClaudeBridge, type PermissionMode } from "../claude.js";
import { PromptRouter } from "../router.js";
import { TerminalUI } from "../ui.js";
import { getLocalIP, formatConnectionInfo, startCloudflareTunnel, startLocaltunnel, type ConnectionInfo } from "../connection.js";
import { SessionManager } from "../session.js";
import { handleSlashCommand, type CommandContext } from "./session-commands.js";
import { loadConfig } from "../config.js";
import { parseSessionHistory, getProjectSessionDir } from "../history.js";
import { join } from "node:path";

interface HostOptions {
  name: string;
  noApproval: boolean;
  tunnel?: "localtunnel" | "cloudflare";
  relay?: string;
  port: number;
  continueSession?: boolean;
  resumeSession?: string;
  permissionMode?: PermissionMode;
}

export async function hostCommand(options: HostOptions): Promise<void> {
  const sessionManager = new SessionManager();
  const session = sessionManager.create(options.name);
  const approvalMode = !options.noApproval;

  const ui = new TerminalUI({ userName: options.name, role: "host" });

  // Create server first so event handler can reference it
  const server = new ClaudeDuetServer({
    hostUser: options.name,
    password: session.password,
    sessionCode: session.code,
    approvalMode,
  });

  const claude = new ClaudeBridge({
    continue: options.continueSession,
    resume: options.resumeSession,
    permissionMode: options.permissionMode ?? "auto",
  });

  // Register event handler BEFORE start() to catch early errors
  claude.on("event", (event) => {
    switch (event.type) {
      case "stream_chunk":
        ui.showStreamChunk(event.text);
        server.broadcast({ ...event, timestamp: Date.now() });
        break;
      case "tool_use":
        ui.showToolUse(event.tool, event.input);
        server.broadcast({ ...event, timestamp: Date.now() });
        break;
      case "tool_result":
        ui.showToolResult(event.tool, event.output);
        server.broadcast({ ...event, timestamp: Date.now() });
        break;
      case "turn_complete":
        ui.showTurnComplete(event.cost, event.durationMs);
        server.broadcast({ ...event, timestamp: Date.now() });
        break;
      case "notice":
        ui.showSystem(event.message);
        server.broadcast({ type: "notice", message: event.message, timestamp: Date.now() });
        break;
      case "error":
        ui.showError(event.message);
        server.broadcast({ type: "error", message: event.message, timestamp: Date.now() });
        break;
    }
  });

  await claude.start();
  const port = await server.start(options.port || 0);

  let connInfo: ConnectionInfo;
  if (options.tunnel === "cloudflare") {
    try {
      ui.showSystem("Starting Cloudflare tunnel...");
      connInfo = await startCloudflareTunnel(port);
      ui.showSystem(`Tunnel ready: ${connInfo.displayUrl}`);
    } catch (err) {
      ui.showError(String(err));
      const localIP = getLocalIP();
      connInfo = formatConnectionInfo({ mode: "lan", host: localIP, port });
    }
  } else if (options.tunnel === "localtunnel") {
    ui.showSystem("Starting localtunnel...");
    const tunnelInfo = await startLocaltunnel(port);
    if (tunnelInfo) {
      connInfo = tunnelInfo;
      ui.showSystem(`Tunnel ready: ${connInfo.displayUrl}`);
    } else {
      ui.showError("localtunnel failed — falling back to LAN.");
      const localIP = getLocalIP();
      connInfo = formatConnectionInfo({ mode: "lan", host: localIP, port });
    }
  } else if (options.relay) {
    connInfo = formatConnectionInfo({ mode: "relay", host: options.relay, port: 0 });
    ui.showSystem(`Using relay: ${options.relay}`);
  } else {
    const localIP = getLocalIP();
    connInfo = formatConnectionInfo({ mode: "lan", host: localIP, port });
  }

  ui.showWelcome(session.code, session.password, connInfo.displayUrl);
  ui.startInputLoop();
  ui.showHint("Type a message to chat, or @claude <prompt> to ask Claude. /help for commands.");

  const router = new PromptRouter(claude, server, {
    hostUser: options.name,
    approvalMode,
  });

  server.on("prompt", (msg) => {
    ui.showUserPrompt(msg.user, msg.text, "guest", "claude");
    router.handlePrompt(msg);
  });

  server.on("chat", (msg) => {
    ui.showUserPrompt(msg.user, msg.text, "guest", "chat");
  });

  let messageCount = 0;
  const sessionStartTime = Date.now();

  // Build command context for slash commands
  const cmdCtx: CommandContext = {
    ui,
    role: "host",
    sessionCode: session.code,
    partnerName: undefined,
    startTime: sessionStartTime,
    onLeave: async () => {
      // Notify guest before shutting down
      server.broadcast({
        type: "notice",
        message: "Host ended the session. Goodbye!",
        timestamp: Date.now(),
      });
      const elapsed = Date.now() - sessionStartTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      ui.showSessionSummary({
        duration: `${minutes}m ${seconds}s`,
        messageCount,
      });
      connInfo.cleanup?.();
      await claude.stop();
      await server.stop();
      ui.close();
      process.exit(0);
    },
    onTrustChange: (trusted) => {
      router.setApprovalMode(!trusted);
    },
    onKick: () => {
      server.kickGuest();
    },
  };

  server.on("guest_joined", async (user: string) => {
    sessionManager.addGuest(session.code, user);
    ui.showPartnerJoined(user);
    cmdCtx.partnerName = user;

    // Send session history to guest if resuming an existing session
    const claudeSessionId = claude.getSessionId();
    if (claudeSessionId && (options.continueSession || options.resumeSession)) {
      try {
        const sessionDir = getProjectSessionDir();
        const sessionFilePath = join(sessionDir, `${claudeSessionId}.jsonl`);
        const history = await parseSessionHistory(sessionFilePath);
        if (history.length > 0) {
          server.broadcast({
            type: "history_replay",
            messages: history,
            sessionId: claudeSessionId,
            resumedFrom: history.length,
            timestamp: Date.now(),
          });
          ui.showSystem(`Sent ${history.length} history messages to ${user}.`);
        }
      } catch {
        // History replay is best-effort — don't fail the session
        ui.showSystem("Could not load session history for replay.");
      }
    }
  });

  server.on("guest_left", () => {
    ui.showPartnerLeft(server.getGuestUser() || "partner");
    cmdCtx.partnerName = undefined;
  });

  ui.onInput((text) => {
    messageCount++;

    // Slash commands
    if (handleSlashCommand(text, cmdCtx)) return;

    if (text.toLowerCase().startsWith("@claude ")) {
      // Claude prompt
      const prompt = text.slice(8);
      const msg = {
        type: "prompt" as const,
        id: `host-${Date.now()}`,
        user: options.name,
        text: prompt,
        timestamp: Date.now(),
      };
      ui.showUserPrompt(options.name, prompt, "host", "claude");
      ui.showClaudeThinking();
      router.handlePrompt(msg);
    } else {
      // Chat message — broadcast to guest, don't send to Claude
      ui.showUserPrompt(options.name, text, "host", "chat");
      server.broadcast({
        type: "chat_received" as any,
        user: options.name,
        text,
        timestamp: Date.now(),
      });
    }
  });

  ui.onApproval((promptId, approved) => {
    router.handleApproval({ promptId, approved });
    if (!approved) {
      ui.showSystem("Prompt rejected.");
    }
  });

  server.on("server_message", (msg) => {
    if (msg.type === "approval_request") {
      ui.showApprovalRequest(msg.promptId, msg.user, msg.text);
    }
  });

  process.on("SIGINT", async () => {
    // Notify guest before shutting down
    server.broadcast({
      type: "notice",
      message: "Host ended the session. Goodbye!",
      timestamp: Date.now(),
    });
    const elapsed = Date.now() - sessionStartTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    ui.showSessionSummary({
      duration: `${minutes}m ${seconds}s`,
      messageCount,
    });
    connInfo.cleanup?.();
    await claude.stop();
    await server.stop();
    ui.close();
    process.exit(0);
  });
}
