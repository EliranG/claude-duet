import pc from "picocolors";
import {
  loadConfig,
  loadUserConfig,
  loadProjectConfig,
  saveUserConfig,
  saveProjectConfig,
  getConfigPaths,
  isValidConfigKey,
  parseConfigValue,
  type ClaudeDuetConfig,
} from "../config.js";

export function configShowCommand(): void {
  const paths = getConfigPaths();
  const userConfig = loadUserConfig();
  const projectConfig = loadProjectConfig();
  const merged = loadConfig();

  console.log(pc.bold("\nclaude-duet configuration\n"));

  console.log(pc.dim("Config files:"));
  console.log(`  User:    ${paths.user}`);
  console.log(`  Project: ${paths.project || pc.dim("(none)")}`);
  console.log("");

  const keys = Object.keys(merged) as (keyof ClaudeDuetConfig)[];
  if (keys.length === 0) {
    console.log(pc.dim("  No configuration set."));
    console.log(pc.dim(`  Run: claude-duet config set name "Your Name"`));
  } else {
    for (const key of keys) {
      const value = merged[key];
      const source = key in projectConfig ? "project" : "user";
      console.log(`  ${pc.bold(key)}: ${value} ${pc.dim(`(${source})`)}`);
    }
  }
  console.log("");
}

export function configSetCommand(key: string, value: string, options: { project?: boolean }): void {
  if (!isValidConfigKey(key)) {
    console.error(pc.red(`Unknown config key: ${key}`));
    console.error(`Valid keys: name, approvalMode, port, tunnel, relay`);
    process.exit(1);
  }

  const parsed = parseConfigValue(key, value);
  const config = { [key]: parsed } as Partial<ClaudeDuetConfig>;

  if (options.project) {
    saveProjectConfig(config);
    console.log(`Set ${pc.bold(key)} = ${parsed} ${pc.dim("(project)")}`);
  } else {
    saveUserConfig(config);
    console.log(`Set ${pc.bold(key)} = ${parsed} ${pc.dim("(user)")}`);
  }
}

export function configGetCommand(key: string): void {
  if (!isValidConfigKey(key)) {
    console.error(pc.red(`Unknown config key: ${key}`));
    process.exit(1);
  }
  const config = loadConfig();
  const value = config[key as keyof ClaudeDuetConfig];
  if (value === undefined) {
    console.log(pc.dim("(not set)"));
  } else {
    console.log(String(value));
  }
}

export function configPathCommand(): void {
  const paths = getConfigPaths();
  console.log(`User:    ${paths.user}`);
  console.log(`Project: ${paths.project || "(none)"}`);
}
