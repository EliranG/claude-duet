<div align="center">

# ✦ claude-duet

**Two devs. One Claude. Pure vibes.**

[![npm version](https://img.shields.io/npm/v/claude-duet)](https://www.npmjs.com/package/claude-duet)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Share your Claude Code session with a friend — real-time collaboration for AI pair programming.

<img src="docs/assets/demo.gif" alt="claude-duet demo" width="700">

</div>

---

## ⚡ Quick Start

```bash
# You need Claude Code installed first
npm install -g @anthropic-ai/claude-code

# Start a duet session
npx claude-duet host --name Alice

# Your partner joins (copy the command from your terminal)
npx claude-duet join cd-a1b2c3d4 --password abc123 --url ws://192.168.1.5:4567
```

Send the join command to your partner via Slack, Discord, whatever works.

## ✦ What Is This

A shared terminal session where two people can **chat with each other** and **use Claude together**.

Just type normally to talk to your partner. Type `@claude` to talk to Claude. Both of you see everything.

```
⟩ hey, do you see the bug in auth.ts?          ← chat (just between you two)
⟩ @claude look at src/auth.ts and fix the bug  ← sent to Claude (both see the response)
```

That's the whole idea. You decide when to bring Claude in.

## ☯︎ How It Works

```
┌──────────────────┐     WebSocket      ┌──────────────────┐
│   You (host)     │◄══════════════════►│   Partner        │
│   Claude Code    │    E2E encrypted   │   Terminal       │
│   (headless)     │                    │   Client         │
│   + WS Server    │                    │                  │
└──────────────────┘                    └──────────────────┘
```

- **Host** runs Claude Code on their machine in headless mode
- **Partner** connects and sees everything live
- **Chat** goes between you two — Claude doesn't see it
- **`@claude <prompt>`** sends to Claude — both of you see the response streaming
- **Approval mode** (on by default) — host reviews partner's Claude prompts before they run

Type `@` and ghost text will suggest the completion. Press **Tab** to accept.
Same for commands: `/h` → `/help`, `/s` → `/status`, etc.

## ⌘ Commands

### CLI

```bash
npx claude-duet                          # Interactive wizard
npx claude-duet host                     # Start a session
npx claude-duet host --continue          # Resume your most recent Claude Code session
npx claude-duet host --resume <id>       # Resume a specific session
npx claude-duet host --no-approval       # Trust mode — skip prompt review
npx claude-duet host --tunnel cloudflare # Remote access via Cloudflare tunnel
npx claude-duet join <code> --password <pw> --url <url>
```

### In-Session

| What you type | What happens |
|---------------|--------------|
| `hello!` | Chat with your partner — Claude doesn't see this |
| `@claude fix the bug` | Sent to Claude — both of you see the response |
| `/help` | Show commands |
| `/status` | Who's connected, session duration |
| `/clear` | Clear the terminal |
| `/leave` | Leave the session |
| `/trust` | (host) Let partner's prompts skip approval |
| `/approval` | (host) Re-enable approval |
| `/kick` | (host) Disconnect the partner |

## ⚙︎ Configuration

```bash
claude-duet config set name "Eliran"              # your name
claude-duet config set approvalMode false          # skip prompt review
claude-duet config set permissionMode interactive  # approve each tool use
claude-duet config                                 # see current config
```

Project-level config (`.claude-duet.json`) overrides user config. CLI flags override everything.

## ☷ Connection Modes

| Mode | Command | When |
|------|---------|------|
| **LAN** | `npx claude-duet host` | Same Wi-Fi / VPN |
| **SSH Tunnel** | `ssh -L 3000:localhost:3000 host` | Remote, secure |
| **Cloudflare** | `npx claude-duet host --tunnel cloudflare` | Remote, no server needed |

## ⊘ Security

- **E2E Encrypted** — NaCl secretbox + scrypt key derivation
- **Approval Mode** — host reviews partner's Claude prompts (on by default)
- **No Third-Party Relay** — LAN direct by default, your data stays on your network
- **Host Controls Everything** — Claude runs on your machine, your API key

## ⌥ Development

```bash
git clone https://github.com/elirang/claude-duet.git
cd claude-duet
npm install
npm run build
npm test                # 124 tests across 17 files
```

Requires Node.js 18+ and [Claude Code](https://claude.ai/code) CLI.

## License

[MIT](LICENSE)

---

<div align="center">

✦ Built by vibing with [Claude Code](https://claude.ai/code) ✦

</div>
