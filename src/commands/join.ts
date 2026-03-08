import { ClaudeDuetClient } from "../client.js";
import { TerminalUI } from "../ui.js";
import { handleSlashCommand, type CommandContext } from "./session-commands.js";

interface JoinOptions {
  name: string;
  password: string;
  url?: string;
}

export async function joinCommand(sessionCode: string, options: JoinOptions): Promise<void> {
  const ui = new TerminalUI({ userName: options.name, role: "guest" });

  const serverUrl = options.url || await resolveSessionUrl(sessionCode);

  ui.showSystem(`Connecting to ${serverUrl}...`);

  const client = new ClaudeDuetClient();
  let result: Awaited<ReturnType<typeof client.connect>>;

  try {
    result = await client.connect(serverUrl, options.name, options.password);
    ui.applySessionBackground();
    ui.showSystem(`Connected! You're in a duet session with ${result.hostUser}.`);
    if (result.approvalMode) {
      ui.showSystem("Approval mode is ON \u2014 host will review your prompts.");
    }
    console.log("");
    ui.startInputLoop();
    ui.showHint("Type a message to chat, or @claude <prompt> to ask Claude. /help for commands.");
  } catch (err) {
    ui.showError(`Failed to join: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  let messageCount = 0;
  const sessionStartTime = Date.now();

  const cmdCtx: CommandContext = {
    ui,
    role: "guest",
    partnerName: result.hostUser,
    startTime: sessionStartTime,
    onLeave: async () => {
      const elapsed = Date.now() - sessionStartTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      ui.showSessionSummary({
        duration: `${minutes}m ${seconds}s`,
        messageCount,
      });
      await client.disconnect();
      ui.close();
      process.exit(0);
    },
  };

  client.on("message", (msg) => {
    switch (msg.type) {
      case "chat_received":
        // Skip own chat messages (already shown locally)
        if ((msg as any).user === options.name) break;
        ui.showUserPrompt((msg as any).user, (msg as any).text, false, "chat");
        break;
      case "prompt_received":
        // Skip own messages (already shown locally when typed)
        if (msg.user === options.name) break;
        ui.showUserPrompt(msg.user, msg.text, false, "claude");
        break;
      case "approval_status":
        ui.showApprovalStatus((msg as any).status);
        break;
      case "stream_chunk":
        ui.showStreamChunk(msg.text);
        break;
      case "tool_use":
        ui.showToolUse(msg.tool, msg.input);
        break;
      case "tool_result":
        ui.showToolResult(msg.tool, msg.output);
        break;
      case "turn_complete":
        ui.showTurnComplete(msg.cost, msg.durationMs);
        break;
      case "notice":
        ui.showSystem(msg.message);
        break;
      case "error":
        ui.showError(msg.message);
        break;
    }
  });

  ui.onInput((text) => {
    messageCount++;

    // Slash commands
    if (handleSlashCommand(text, cmdCtx)) return;

    if (text.startsWith("@claude ")) {
      // Claude prompt — send to host via sendPrompt
      const prompt = text.slice(8);
      ui.showUserPrompt(options.name, prompt, false, "claude");
      client.sendPrompt(prompt);
    } else {
      // Chat message
      ui.showUserPrompt(options.name, text, false, "chat");
      client.sendChat(text);
    }
  });

  client.on("disconnected", () => {
    const elapsed = Date.now() - sessionStartTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    ui.showSessionSummary({
      duration: `${minutes}m ${seconds}s`,
      messageCount,
    });
    ui.showError("Disconnected from session.");
    ui.close();
    process.exit(1);
  });

  process.on("SIGINT", async () => {
    const elapsed = Date.now() - sessionStartTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    ui.showSessionSummary({
      duration: `${minutes}m ${seconds}s`,
      messageCount,
    });
    await client.disconnect();
    ui.close();
    process.exit(0);
  });
}

async function resolveSessionUrl(sessionCode: string): Promise<string> {
  throw new Error(
    `Session discovery not available \u2014 use --url to connect directly.\n` +
    `  Ask the host for the join command, or run:\n` +
    `  claude-duet join ${sessionCode} --password <password> --url ws://<host-ip>:<port>`
  );
}
