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

# Start a duet session (run from your terminal, NOT inside Claude Code)
npx claude-duet host --name Alice

# Your partner joins (copy the command from your terminal)
npx claude-duet join <offer-code> --password abc123
```

Send the join command to your partner via Slack, Discord, whatever works.

**P2P mode** (default): After your partner runs the join command, they'll get an answer code to share back with you. Paste it into your terminal — that's it, you're connected directly peer-to-peer via WebRTC. No server needed.

### Step by Step

1. **Exit Claude Code** if you're in an active session (Ctrl+C or `/exit`)
2. **Start a duet session** from your regular terminal:
   - `npx claude-duet host` — fresh session
   - `npx claude-duet host --continue` — resume your most recent Claude Code conversation
3. **Share the join command** that appears in your terminal with your partner
4. **Your partner runs** the join command from their own terminal
5. **Chat freely** — plain text goes between you two, `@claude <prompt>` sends to Claude

> **Context is preserved.** Because claude-duet wraps Claude Code in headless mode, your Claude Code conversation history carries over. Use `--continue` to pick up where you left off, and after the duet session ends, run `claude --continue` to keep going solo. Claude remembers everything — before, during, and after the duet.

## ✦ What Is This

A shared terminal session where two people can **chat with each other** and **invoke Claude together using `@claude <prompt>`**.

Just type normally to talk to your partner. Prefix with **`@claude`** to send a prompt to Claude. Both of you see everything in real time.

```
⟩ hey, do you see the bug in auth.ts?          ← chat (just between you two)
⟩ @claude look at src/auth.ts and fix the bug  ← sent to Claude (both see the response)
```

That's the whole idea. You decide when to bring Claude in.

## ☯︎ How It Works

```
┌──────────────────┐  WebRTC P2P (default)  ┌──────────────────┐
│   You (host)     │◄══════════════════════►│   Partner        │
│   Claude Code    │    E2E encrypted       │   Terminal       │
│   (headless)     │    NAT hole-punching   │   Client         │
└──────────────────┘                        └──────────────────┘
```

- **Host** runs Claude Code on their machine in headless mode
- **Partner** connects directly via WebRTC data channel (no server in between)
- **Chat** goes between you two — Claude doesn't see it
- **`@claude <prompt>`** sends to Claude — both of you see the response streaming
- **Approval mode** (on by default) — host reviews partner's Claude prompts before they run

Type `@` and ghost text will suggest the completion. Press **Tab** to accept.
Same for commands: `/h` → `/help`, `/s` → `/status`, etc.

## ⌘ Commands

### CLI

```bash
npx claude-duet                          # Interactive wizard
npx claude-duet host                     # Start a session (P2P default)
npx claude-duet host --continue          # Resume your most recent Claude Code session
npx claude-duet host --resume <id>       # Resume a specific session
npx claude-duet host --no-approval       # Trust mode — skip prompt review
npx claude-duet host --tunnel cloudflare # Remote access via Cloudflare tunnel
npx claude-duet join <offer-code> --password <pw>           # P2P join
npx claude-duet join <session-code> --password <pw> --url <url>  # WebSocket join
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
| **P2P (default)** | `npx claude-duet host` | Any network — direct WebRTC connection |
| **LAN** | `npx claude-duet host --tunnel localtunnel` | Same Wi-Fi / VPN (fallback) |
| **SSH Tunnel** | `ssh -L 3000:localhost:3000 host` | Remote, secure |
| **Cloudflare** | `npx claude-duet host --tunnel cloudflare` | Remote, no server needed |

## ⊘ Security

- **E2E Encrypted** — NaCl secretbox + scrypt key derivation
- **Approval Mode** — host reviews partner's Claude prompts (on by default)
- **P2P Direct** — WebRTC data channel by default, no server or relay in the data path
- **Host Controls Everything** — Claude runs on your machine, your API key

## ⌥ Development

```bash
git clone https://github.com/elirang/claude-duet.git
cd claude-duet
npm install
npm run build
npm test                # 148 tests across 20 files
```

Requires Node.js 18+ and [Claude Code](https://claude.ai/code) CLI.

## ❓ FAQ

See the [FAQ](docs/faq.md) for common questions about security, remote access, permissions, and more.

## License

[MIT](LICENSE)

---

<div align="center">

✦ Built by vibing with [Claude Code](https://claude.ai/code) ✦

</div>
