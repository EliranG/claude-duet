<div align="center">

# claude-duet

**Two developers, one Claude. Claude duet coding in real-time.**

[![npm version](https://img.shields.io/npm/v/claude-duet)](https://www.npmjs.com/package/claude-duet)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Share your AI coding session with a partner. Host runs the AI,
partner sends prompts — both see everything in real-time.

</div>

---

> **Currently supports [Claude Code](https://claude.ai/code) (Anthropic's CLI).**
> Support for other AI coding tools (Codex CLI, Gemini CLI, etc.) is planned for future releases.

## Quick Start

```bash
# Host a session (installs automatically via npx)
npx claude-duet host

# Share the join command shown in your terminal with your partner
# They run it — that's it!
```

The host terminal will display a ready-to-share command like:

```
npx claude-duet join cd-a1b2c3d4 --password mypassword --url ws://192.168.1.5:4567
```

Send it via Slack, Discord, or any chat. Your partner runs it and you're paired up.

## How It Works

```
┌──────────────┐     WebSocket      ┌──────────────┐
│   Host       │◄──────────────────►│   Partner    │
│   Claude Code│     encrypted      │   Terminal   │
│   + Server   │                    │   Client     │
└──────────────┘                    └──────────────┘
```

1. **Host** runs Claude Code locally via the Agent SDK and starts a WebSocket server
2. **Partner** connects and sends prompts to the shared session
3. **Both** see Claude's responses stream in real-time
4. All communication is **end-to-end encrypted** (NaCl secretbox)
5. **Approval mode** (default): host reviews partner prompts before execution

## Connection Modes

| Mode | Command | Use Case |
|------|---------|----------|
| **LAN Direct** | `npx claude-duet host` | Same network, zero config |
| **SSH Tunnel** | `ssh -L 3000:localhost:3000 host` | Remote, proven security |
| **Cloudflare Tunnel** | `npx claude-duet host --tunnel cloudflare` | Remote, no server needed |
| **Self-hosted Relay** | `npx claude-duet host --relay wss://relay.example.com` | Custom infrastructure |

## Security

- **E2E Encryption** — NaCl secretbox (XSalsa20-Poly1305) with scrypt key derivation
- **Approval Mode** — Host reviews partner prompts before execution (on by default)
- **No Third-Party Relay** — LAN direct is default; SSH recommended for remote
- **Host Controls** — All Claude Code operations run on the host machine only

## Commands

```
npx claude-duet                          # Interactive wizard
npx claude-duet host                     # Host on LAN (default)
npx claude-duet host --no-approval       # Host without approval mode
npx claude-duet host --tunnel cloudflare # Host via Cloudflare tunnel
npx claude-duet relay                    # Run a relay server
npx claude-duet join <code> --password <pw> --url <url>  # Join a session
```

## Session Commands

| Command | Description |
|---------|-------------|
| `Ctrl+C` | Graceful shutdown with session summary |

## Roadmap

- [ ] Support for additional AI coding tools (Codex CLI, Gemini CLI, etc.)
- [ ] Rich terminal UI with Ink (React for the terminal)
- [ ] Session recording and playback
- [ ] Multi-guest sessions

## Development

```bash
git clone https://github.com/elirang/claude-duet.git
cd claude-duet
npm install
npm run build
npm test
```

## License

[MIT](LICENSE)

---

<div align="center">
<sub>Built with Claude Code</sub>
</div>
