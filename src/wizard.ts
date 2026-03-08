import * as p from "@clack/prompts";
import pc from "picocolors";

export interface WizardResult {
  mode: "host" | "join" | "relay";
  name: string;
  // Host options
  connectionType?: "lan" | "ssh" | "cloudflare" | "relay";
  trustMode?: "approval" | "trusted";
  port?: number;
  relayUrl?: string;
  // Join options
  sessionCode?: string;
  password?: string;
  url?: string;
  // Relay options
  relayPort?: number;
}

export async function runWizard(): Promise<WizardResult | null> {
  p.intro(`${pc.bgCyan(pc.black(" claude-duet "))} ${pc.dim("v0.1.0")}`);

  const mode = await p.select({
    message: "What would you like to do?",
    options: [
      { value: "host", label: "Host a session", hint: "you run Claude Code" },
      { value: "join", label: "Join a session", hint: "connect to a partner" },
      { value: "relay", label: "Run a relay server", hint: "for remote teams" },
    ],
  }) as "host" | "join" | "relay";

  if (p.isCancel(mode)) { p.cancel("Cancelled."); return null; }

  const name = await p.text({
    message: "Your display name?",
    placeholder: process.env.USER || "developer",
    defaultValue: process.env.USER || "developer",
  }) as string;

  if (p.isCancel(name)) { p.cancel("Cancelled."); return null; }

  if (mode === "host") return runHostWizard(name);
  if (mode === "join") return runJoinWizard(name);
  return runRelayWizard(name);
}

async function runHostWizard(name: string): Promise<WizardResult | null> {
  const connectionType = await p.select({
    message: "How will your partner connect?",
    options: [
      { value: "lan", label: "Same network (LAN / VPN)", hint: "default, no setup needed" },
      { value: "ssh", label: "SSH tunnel", hint: "partner has SSH access to this machine" },
      { value: "cloudflare", label: "Cloudflare tunnel", hint: "requires cloudflared installed" },
      { value: "relay", label: "Self-hosted relay", hint: "connect via your team's relay server" },
    ],
  }) as "lan" | "ssh" | "cloudflare" | "relay";

  if (p.isCancel(connectionType)) { p.cancel("Cancelled."); return null; }

  let relayUrl: string | undefined;
  if (connectionType === "relay") {
    relayUrl = await p.text({
      message: "Relay server URL?",
      placeholder: "wss://relay.mycompany.com",
    }) as string;
    if (p.isCancel(relayUrl)) { p.cancel("Cancelled."); return null; }
  }

  const trustMode = await p.select({
    message: "Trust mode?",
    options: [
      { value: "approval", label: "Approval mode", hint: "you review partner's prompts before execution" },
      { value: "trusted", label: "Trusted mode", hint: "partner's prompts execute immediately" },
    ],
  }) as "approval" | "trusted";

  if (p.isCancel(trustMode)) { p.cancel("Cancelled."); return null; }

  return { mode: "host", name, connectionType, trustMode, relayUrl };
}

async function runJoinWizard(name: string): Promise<WizardResult | null> {
  const sessionCode = await p.text({
    message: "Session code?",
    placeholder: "cd-xxxxxxxx",
    validate: (v) => v?.startsWith("cd-") ? undefined : "Session codes start with cd-",
  }) as string;

  if (p.isCancel(sessionCode)) { p.cancel("Cancelled."); return null; }

  const password = await p.password({
    message: "Password?",
  }) as string;

  if (p.isCancel(password)) { p.cancel("Cancelled."); return null; }

  const url = await p.text({
    message: "Connection URL?",
    placeholder: "ws://192.168.1.42:9876",
    validate: (v) => v?.startsWith("ws://") || v?.startsWith("wss://") ? undefined : "Must start with ws:// or wss://",
  }) as string;

  if (p.isCancel(url)) { p.cancel("Cancelled."); return null; }

  return { mode: "join", name, sessionCode, password, url };
}

async function runRelayWizard(name: string): Promise<WizardResult | null> {
  const relayPort = await p.text({
    message: "Relay server port?",
    placeholder: "9877",
    defaultValue: "9877",
  }) as string;

  if (p.isCancel(relayPort)) { p.cancel("Cancelled."); return null; }

  return { mode: "relay", name, relayPort: parseInt(relayPort, 10) };
}
