#!/usr/bin/env node

import { Command } from "commander";
import { hostCommand } from "./commands/host.js";
import { joinCommand } from "./commands/join.js";
import { startRelayServer } from "./relay-server.js";
import { configShowCommand, configSetCommand, configGetCommand, configPathCommand } from "./commands/config.js";
import { loadConfig } from "./config.js";

const program = new Command();

program
  .name("claude-duet")
  .description("Claude duet coding — share a Claude Code session with a partner")
  .version("0.2.0");

program
  .command("host")
  .description("Start a claude-duet session as host")
  .option("-n, --name <name>", "your display name", process.env.USER || "host")
  .option("--no-approval", "disable approval mode (trust your partner)")
  .option("--tunnel [provider]", "use a tunnel for remote access (localtunnel, cloudflare)")
  .option("--relay <url>", "use a relay server for remote access")
  .option("-p, --port <port>", "WebSocket server port (tunnel/LAN modes)", "0")
  .option("-c, --continue", "resume most recent Claude Code session")
  .option("--resume <id>", "resume a specific Claude Code session by ID")
  .option("--permission-mode <mode>", "permission mode: auto (default) or interactive")
  .action((options) => {
    const config = loadConfig();
    const tunnelFlag = options.tunnel === true ? "localtunnel" : options.tunnel;
    const tunnel = tunnelFlag || config.tunnel;
    hostCommand({
      name: options.name !== process.env.USER ? options.name : (config.name || options.name),
      noApproval: !options.approval || config.approvalMode === false,
      tunnel,
      relay: options.relay || config.relay,
      port: parseInt(options.port, 10) || config.port || 0,
      continueSession: options.continue || false,
      resumeSession: options.resume,
      permissionMode: options.permissionMode || config.permissionMode || "auto",
    });
  });

program
  .command("join <session-code-or-offer>")
  .description("Join an existing claude-duet session (session code or P2P offer code)")
  .option("-n, --name <name>", "your display name", process.env.USER || "guest")
  .option("--password <password>", "session password")
  .option("--url <url>", "WebSocket URL (direct, SSH tunnel, VPN, etc.)")
  .action((sessionCodeOrOffer, options) => {
    if (!options.password) {
      console.error("Error: --password is required");
      process.exit(1);
    }
    const config = loadConfig();
    joinCommand(sessionCodeOrOffer, {
      name: options.name !== (process.env.USER || "guest") ? options.name : (config.name || options.name),
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

const configCmd = program
  .command("config")
  .description("View and manage claude-duet configuration")
  .action(() => configShowCommand());

configCmd
  .command("set <key> <value>")
  .description("Set a config value")
  .option("--project", "save to project config (.claude-duet.json)")
  .action((key, value, options) => configSetCommand(key, value, options));

configCmd
  .command("get <key>")
  .description("Get a config value")
  .action((key) => configGetCommand(key));

configCmd
  .command("path")
  .description("Show config file paths")
  .action(() => configPathCommand());

program.parse();
