#!/usr/bin/env node

import { Command } from "commander";
import { hostCommand } from "./commands/host.js";
import { joinCommand } from "./commands/join.js";
import { startRelayServer } from "./relay-server.js";

const program = new Command();

program
  .name("claude-duet")
  .description("Claude duet coding \u2014 share a Claude Code session with a partner")
  .version("0.1.0");

program
  .command("host")
  .description("Start a claude-duet session as host")
  .option("-n, --name <name>", "your display name", process.env.USER || "host")
  .option("--no-approval", "disable approval mode (trust your partner)")
  .option("--tunnel <provider>", "use a tunnel for remote access (cloudflare)")
  .option("--relay <url>", "use a relay server for remote access")
  .option("-p, --port <port>", "WebSocket server port", "0")
  .action((options) => {
    hostCommand({
      name: options.name,
      noApproval: !options.approval,
      tunnel: options.tunnel,
      relay: options.relay,
      port: parseInt(options.port, 10),
    });
  });

program
  .command("join <session-code>")
  .description("Join an existing claude-duet session")
  .option("-n, --name <name>", "your display name", process.env.USER || "guest")
  .option("--password <password>", "session password")
  .option("--url <url>", "WebSocket URL (direct, SSH tunnel, VPN, etc.)")
  .option("--relay <url>", "connect via a relay server")
  .action((sessionCode, options) => {
    if (!options.password) {
      console.error("Error: --password is required");
      process.exit(1);
    }
    joinCommand(sessionCode, {
      name: options.name,
      password: options.password,
      url: options.url,
    });
  });

program
  .command("relay")
  .description("Run a self-hosted relay server for remote claude-duet sessions")
  .option("-p, --port <port>", "relay server port", "9877")
  .action((options) => {
    startRelayServer(parseInt(options.port, 10));
  });

program.parse();
