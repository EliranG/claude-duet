import { networkInterfaces } from "node:os";
import { spawn, type ChildProcess } from "node:child_process";

export function getLocalIP(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "127.0.0.1";
}

export interface ConnectionInfo {
  url: string;
  displayUrl: string;
  mode: "lan" | "tunnel" | "relay" | "custom";
  cleanup?: () => void;
}

export function formatConnectionInfo(opts: {
  mode: "lan" | "tunnel" | "relay" | "custom";
  host: string;
  port: number;
}): ConnectionInfo {
  if (opts.mode === "tunnel") {
    const url = `wss://${opts.host}`;
    return { url, displayUrl: url, mode: opts.mode };
  }
  const url = `ws://${opts.host}:${opts.port}`;
  return { url, displayUrl: url, mode: opts.mode };
}

// Cloudflare Quick Tunnel — user must have `cloudflared` installed
export async function startCloudflareTunnel(localPort: number): Promise<ConnectionInfo> {
  return new Promise((resolve, reject) => {
    const proc = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${localPort}`], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    const timeout = setTimeout(() => {
      proc.kill();
      reject(
        new Error("cloudflared timed out. Install it with: brew install cloudflared"),
      );
    }, 30000);

    // cloudflared prints the URL to stderr
    proc.stderr!.on("data", (data: Buffer) => {
      stderr += data.toString();
      const match = stderr.match(/https:\/\/[\w-]+\.trycloudflare\.com/);
      if (match) {
        clearTimeout(timeout);
        const httpsUrl = match[0];
        const wssUrl = httpsUrl.replace("https://", "wss://");
        resolve({
          url: wssUrl,
          displayUrl: wssUrl,
          mode: "tunnel",
          cleanup: () => proc.kill(),
        });
      }
    });

    proc.on("error", () => {
      clearTimeout(timeout);
      reject(
        new Error(
          "cloudflared not found. Install: brew install cloudflared\n" +
            "Or use --url to connect directly (LAN, SSH tunnel, Tailscale, etc.)",
        ),
      );
    });
  });
}
