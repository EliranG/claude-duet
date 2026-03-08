import { PairVibeClient } from "../client.js";
import { TerminalUI } from "../ui.js";

interface JoinOptions {
  name: string;
  password: string;
  url?: string;
}

export async function joinCommand(sessionCode: string, options: JoinOptions): Promise<void> {
  const ui = new TerminalUI({ userName: options.name, role: "guest" });

  const serverUrl = options.url || await resolveSessionUrl(sessionCode);

  ui.showSystem(`Connecting to ${serverUrl}...`);

  const client = new PairVibeClient();

  try {
    const result = await client.connect(serverUrl, options.name, options.password);
    ui.showSystem(`Connected! You're pair vibing with ${result.hostUser}.`);
    if (result.approvalMode) {
      ui.showSystem("Approval mode is ON \u2014 host will review your prompts.");
    }
    console.log("");
    ui.startInputLoop();
  } catch (err) {
    ui.showError(`Failed to join: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  client.on("message", (msg) => {
    switch (msg.type) {
      case "prompt_received":
        // Skip own messages (already shown locally when typed)
        if (msg.user === options.name) break;
        ui.showUserPrompt(msg.user, msg.text, false);
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
      case "error":
        ui.showError(msg.message);
        break;
    }
  });

  ui.onInput((text) => {
    ui.showUserPrompt(options.name, text, false);
    client.sendPrompt(text);
  });

  client.on("disconnected", () => {
    ui.showError("Disconnected from session.");
    ui.close();
    process.exit(1);
  });

  process.on("SIGINT", async () => {
    ui.showSystem("Leaving session...");
    await client.disconnect();
    ui.close();
    process.exit(0);
  });
}

async function resolveSessionUrl(sessionCode: string): Promise<string> {
  throw new Error(
    `Session discovery not available \u2014 use --url to connect directly.\n` +
    `  Ask the host for the join command, or run:\n` +
    `  pair-vibe join ${sessionCode} --password <password> --url ws://<host-ip>:<port>`
  );
}
