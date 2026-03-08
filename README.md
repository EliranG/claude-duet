<div align="center">

# ✦ claude-duet

**Two devs. One Claude. Pure vibes.**

[![npm version](https://img.shields.io/npm/v/claude-duet)](https://www.npmjs.com/package/claude-duet)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Vibe code with a friend — share your Claude Code session in real-time.
Chat with each other, summon Claude together, ship faster.

</div>

---

> ✦ Currently vibing with [Claude Code](https://claude.ai/code) (Anthropic's CLI).
> More AI coding tools coming soon.

## ⚡ 30-Second Setup

```bash
# You host it
npx claude-duet host

# Your partner joins (copy the command from your terminal)
npx claude-duet join cd-a1b2c3d4 --password mypassword --url ws://192.168.1.5:4567
```

That's it. Send the join command via Slack, Discord, carrier pigeon — whatever works. ✌︎

## ✦ The Vibes

```
┌──────────────┐     WebSocket      ┌──────────────┐
│   You        │◄══════════════════►│   Partner    │
│   Claude Code│    E2E encrypted   │   Terminal   │
│   + Server   │                    │   Client     │
└──────────────┘                    └──────────────┘
```

1. **You** host — Claude runs on your machine
2. **Partner** connects — types prompts, sees everything live
3. **Chat freely** — regular messages stay between you two
4. **Summon Claude** — prefix with `@claude` and it goes to the AI
5. **Stay in control** — approve or reject partner's Claude prompts with a single keypress

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

## ⌘ Commands

### CLI

```bash
npx claude-duet                          # Interactive wizard
npx claude-duet host                     # Host on LAN (default)
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
npm test                # 92 tests across 15 files
npm run test:session    # Live demo with two Terminal windows
```

## License

[MIT](LICENSE) — go wild.

---

<div align="center">

✦ Built by vibing with [Claude Code](https://claude.ai/code) ✦

</div>
