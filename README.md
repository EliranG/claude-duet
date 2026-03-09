<div align="center">

# ✦ claude-duet

**Two devs. One Claude. Pure vibes.**

[![npm version](https://img.shields.io/npm/v/claude-duet)](https://www.npmjs.com/package/claude-duet)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Share your Claude Code session with a friend — real-time collaboration for AI pair programming.

<img src="docs/assets/demo.gif" alt="claude-duet demo" width="700">

</div>

---

> ✦ Wraps [Claude Code](https://claude.ai/code) (Anthropic's CLI) in headless mode.
> Your existing session, shared live.

## ⚡ 30-Second Setup

```bash
# Prerequisites: Claude Code must be installed
npm install -g @anthropic-ai/claude-code

# You're in a Claude Code session, stuck on a bug. Exit and share:
claude-duet host --continue

# Your partner joins (copy the command from your terminal)
claude-duet join cd-a1b2c3d4 --password mypassword --url ws://192.168.1.5:4567
```

That's it. Send the join command via Slack, Discord, carrier pigeon — whatever works. ✌︎

## ✦ The Core Idea

You're deep in a Claude Code session, stuck on something. You want a friend to jump in and help — see what you've been working on, brainstorm together, both talk to Claude.

```
# Alice is stuck in a Claude Code session
alice$ ctrl+c                       # exit Claude Code
alice$ claude-duet host --continue  # share the session

# Bob joins from his terminal
bob$ claude-duet join cd-a1b2c3d4 --password abc123

  ✦ Catching up on 47 messages...
  [alice]: Fix the auth bug in middleware.ts
  [claude]: I see the issue in the JWT validation...
  ...
  ✦ You're live! Approval mode is ON.

# After the duet — Alice goes back to solo:
alice$ claude --continue            # Claude remembers EVERYTHING
```

## ☯︎ How It Works

```
┌──────────────────┐     WebSocket      ┌──────────────────┐
│   You (host)     │◄══════════════════►│   Partner        │
│   Claude Code    │    E2E encrypted   │   Terminal       │
│   (headless)     │                    │   Client         │
│   + WS Server    │                    │                  │
└──────────────────┘                    └──────────────────┘
```

1. **You** host — Claude Code runs on your machine in headless mode
2. **Partner** connects — sees your session history, types prompts, sees everything live
3. **Chat freely** — regular messages stay between you two
4. **Summon Claude** — prefix with `@claude` and it goes to the AI
5. **Stay in control** — approve or reject partner's Claude prompts with a single keypress
6. **Continue solo** — exit duet, `claude --continue`, Claude remembers the duet

## ☯︎ Chat vs Claude

This is the core idea — you can **talk to each other** without bugging Claude, and **invoke Claude together** when you need the big brain.

```
[Benji]:
  hey, what file handles login?

[Eliran (host)]:
  src/auth.ts — let me get Claude on it

[Eliran (host)] → ✦ Claude:
  look at src/auth.ts and explain the login flow

  ✦ Claude is thinking...
  The login flow works by...
```

| What you type | What happens |
|---------------|--------------|
| `hello!` | Chat with your partner ☞ Claude stays chill |
| `@claude fix the bug` | Sent to Claude ☞ both of you see the response |
| `/help` | Show available commands |
| `/status` | Session info — who's connected, duration |
| `/leave` | Graceful exit with session summary |

Type `@` and see inline ghost suggestions — press **Tab** or **Right arrow** to accept. Works for all commands (`/help`, `/status`, `/leave`, `/trust`, etc.).

## ⌘ Commands

### CLI

```bash
npx claude-duet                          # Interactive wizard
npx claude-duet host                     # Host — fresh session
npx claude-duet host --continue          # Host — resume most recent Claude Code session
npx claude-duet host --resume <id>       # Host — resume specific session
npx claude-duet host --permission-mode interactive  # You approve each tool use
npx claude-duet host --no-approval       # Trust mode — no prompt review
npx claude-duet host --tunnel cloudflare # Host via Cloudflare tunnel
npx claude-duet relay                    # Run a relay server
npx claude-duet join <code> --password <pw> --url <url>
```

### In-Session

| Command | Who | What it does |
|---------|-----|-------------|
| `/help` | everyone | Show all commands |
| `/status` | everyone | Session info, duration, who's connected |
| `/clear` | everyone | Clear the terminal |
| `/leave` | everyone | Leave with session summary |
| `/trust` | host | Disable approval — partner prompts go straight to Claude |
| `/approval` | host | Re-enable approval mode |
| `/kick` | host | Disconnect the guest |

## ⚙︎ Configuration

Save your preferences so you don't have to type them every time.

```bash
# Set your name globally
claude-duet config set name "Eliran"

# Set project-specific settings
claude-duet config set approvalMode false --project

# Set permission mode
claude-duet config set permissionMode interactive

# See what's configured
claude-duet config

# Check where configs live
claude-duet config path
```

| Level | File | Scope |
|-------|------|-------|
| User | `~/.config/claude-duet/config.json` | All sessions |
| Project | `.claude-duet.json` | This repo only |

Project overrides user. CLI flags override everything.

| Key | Values | Default |
|-----|--------|---------|
| `name` | any string | system username |
| `approvalMode` | `true` / `false` | `true` |
| `permissionMode` | `auto` / `interactive` | `auto` |
| `port` | number | random |

## ☷ Connection Modes

| Mode | Command | When |
|------|---------|------|
| **LAN Direct** | `npx claude-duet host` | Same Wi-Fi / VPN — zero config |
| **SSH Tunnel** | `ssh -L 3000:localhost:3000 host` | Remote — rock solid security |
| **Cloudflare Tunnel** | `npx claude-duet host --tunnel cloudflare` | Remote — no server needed |
| **Self-hosted Relay** | `npx claude-duet host --relay wss://relay.example.com` | Your infra, your rules |

## ⊘ Security

Not an afterthought.

- **E2E Encrypted** — NaCl secretbox (XSalsa20-Poly1305) + scrypt key derivation
- **Approval Mode** — you review every partner prompt before it touches Claude (default: on)
- **Permission Modes** — `auto` lets Claude use tools freely; `interactive` requires your approval for each tool use
- **No Third-Party Relay** — LAN direct by default. Your data stays on your network
- **Host Controls Everything** — Claude runs on your machine, your API key, your filesystem

## ◈ Roadmap

- [ ] Support for more AI tools (Codex CLI, Gemini CLI, Copilot)
- [ ] Rich terminal UI with Ink (React for the terminal)
- [ ] Session recording and playback
- [ ] Multi-guest sessions (trio coding?)
- [ ] Voice chat integration

## ⌥ Development

```bash
git clone https://github.com/elirang/claude-duet.git
cd claude-duet
npm install
npm run build
npm test                # 124 tests across 17 files
npm run test:session    # Live demo with two Terminal windows
```

## Prerequisites

- Node.js 18+
- [Claude Code](https://claude.ai/code) CLI installed (`npm install -g @anthropic-ai/claude-code`)

## License

[MIT](LICENSE) — go wild.

---

<div align="center">

✦ Built by vibing with [Claude Code](https://claude.ai/code) ✦

</div>
