import { PairVibeServer } from "../server.js";
import { ClaudeBridge } from "../claude.js";
import { PromptRouter } from "../router.js";
import { TerminalUI } from "../ui.js";
import { getLocalIP, formatConnectionInfo, startCloudflareTunnel, type ConnectionInfo } from "../connection.js";
import { SessionManager } from "../session.js";

interface HostOptions {
  name: string;
  noApproval: boolean;
  tunnel?: "cloudflare";
  relay?: string;
  port: number;
}

export async function hostCommand(options: HostOptions): Promise<void> {
  const sessionManager = new SessionManager();
  const session = sessionManager.create(options.name);
  const approvalMode = !options.noApproval;

  const ui = new TerminalUI({ userName: options.name, role: "host" });
  const claude = new ClaudeBridge();
  const server = new PairVibeServer({
    hostUser: options.name,
    password: session.password,
    approvalMode,
  });

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
  } else if (options.relay) {
    connInfo = formatConnectionInfo({ mode: "relay", host: options.relay, port: 0 });
    ui.showSystem(`Using relay: ${options.relay}`);
  } else {
    const localIP = getLocalIP();
    connInfo = formatConnectionInfo({ mode: "lan", host: localIP, port });
  }

  ui.showWelcome(session.code, session.password, connInfo.displayUrl);
  ui.startInputLoop();

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
      case "error":
        ui.showError(event.message);
        server.broadcast({ type: "error", message: event.message, timestamp: Date.now() });
        break;
    }
  });

  const router = new PromptRouter(claude, server, {
    hostUser: options.name,
    approvalMode,
  });

  server.on("prompt", (msg) => {
    ui.showUserPrompt(msg.user, msg.text, false);
    router.handlePrompt(msg);
  });

  server.on("guest_joined", (user: string) => {
    sessionManager.addGuest(session.code, user);
    ui.showPartnerJoined(user);
  });

  server.on("guest_left", () => {
    ui.showPartnerLeft(server.getGuestUser() || "partner");
  });

  ui.onInput((text) => {
    const msg = {
      type: "prompt" as const,
      id: `host-${Date.now()}`,
      user: options.name,
      text,
      timestamp: Date.now(),
    };
    ui.showUserPrompt(options.name, text, true);
    router.handlePrompt(msg);
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
    ui.showSystem("Shutting down...");
    connInfo.cleanup?.();
    await server.stop();
    ui.close();
    process.exit(0);
  });
}
