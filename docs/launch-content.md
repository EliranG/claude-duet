# claude-duet Launch Content Drafts

All drafts below are ready to copy-paste. Review, tweak tone if needed, and post.

---

## 1. Twitter/X Thread (@Donatello_TT)

### Tweet 1 (Main tweet)
I built an open-source CLI that lets two developers share a Claude Code session in real-time.

Host runs Claude, partner sends prompts — both see everything streamed live, E2E encrypted.

It's called claude-duet.

npx claude-duet host

https://github.com/EliranG/claude-duet

### Tweet 2 (Reply)
Why I built this:

I lead R&D at Wix, building AI-first products with multi-agent systems.

I kept wanting to pair program with colleagues using Claude Code — but there was no way to share a session.

So I built one. Open source, peer-to-peer, E2E encrypted.

### Tweet 3 (Reply)
When would you use this?

→ Deep in a Claude Code session, want your colleague to jump in for 5 min to brainstorm? Send them a join command.

→ Need to show your boss what AI coding actually looks like? Don't screen share. Let them try it.

→ Pair programming across time zones. One Claude, both driving.

→ Code review with Claude explaining the changes live.

### Tweet 4 (Reply)
How it works:

- WebRTC peer-to-peer (default) — no server needed
- E2E encrypted (NaCl secretbox)
- Approval mode: host reviews partner's prompts before they run
- Also supports LAN, Cloudflare tunnel, or self-hosted relay

### Tweet 5 (Reply)
npm install -g claude-duet

Or just: npx claude-duet host

MIT licensed. PRs welcome.

https://github.com/EliranG/claude-duet

---

## 2. LinkedIn Post

I just open-sourced a tool I've been building: claude-duet

It lets two developers share a Claude Code session in real-time — one hosts, the other joins, and both see Claude's responses streaming live.

Why did I build this?

In my day job leading R&D at Wix, I work with AI agents and multi-agent systems daily. I kept running into the same problem: when pair programming with Claude Code, there's no way to share the session. One person drives, the other watches over their shoulder (or over Zoom).

claude-duet solves this:

Deep in a Claude Code session and want a second opinion? Send your colleague a join command — they jump in, you brainstorm for 5 minutes, they leave, and you keep going.

Want to show your manager what AI-assisted coding looks like? Instead of an hour on Zoom, send them one command and let them see it live.

Pair programming across offices? One Claude, both driving. WebRTC peer-to-peer, E2E encrypted, no server needed.

It's fully open source (MIT), written in TypeScript, and you can try it right now:

npx claude-duet host

GitHub: https://github.com/EliranG/claude-duet

If you've been using Claude Code for pair programming or code reviews, I'd love to hear how you'd use this. PRs and ideas welcome.

#OpenSource #ClaudeCode #AI #DeveloperTools #PairProgramming

---

## 3. Reddit Posts

### r/ClaudeAI

**Title:** I built an open-source CLI to share Claude Code sessions in real-time (claude-duet)

**Body:**
Hey everyone,

I've been using Claude Code a lot at work and kept wishing I could share a session with a colleague — like pair programming, but with AI in the loop.

So I built **claude-duet**: an open-source CLI tool that lets two developers share a Claude Code session in real-time.

**How it works:**
- Host runs Claude Code locally, partner connects directly via WebRTC peer-to-peer (default)
- Partner sends prompts to the shared session
- Both see Claude's responses streamed live
- All messages are E2E encrypted (NaCl secretbox + scrypt)
- Approval mode (on by default) — host reviews partner prompts before execution

**Connection modes:**
- WebRTC P2P (default, no server needed)
- LAN direct
- SSH tunnel
- Cloudflare Quick Tunnel
- Self-hosted relay server

**Try it:**
```
npx claude-duet host
```

GitHub: https://github.com/EliranG/claude-duet

MIT licensed. Would love feedback and ideas for what to build next. The roadmap includes multi-guest sessions, support for other AI coding tools (Codex CLI, Gemini CLI), and session recording/playback.

---

### r/programming

**Title:** Show r/programming: claude-duet — share an AI coding session between two developers with E2E encryption

**Body:**
I built an open-source CLI tool called **claude-duet** that lets two developers share a Claude Code (Anthropic's AI coding CLI) session with WebRTC peer-to-peer and end-to-end encryption.

**Technical highlights:**
- WebRTC P2P by default (via node-datachannel), with NaCl secretbox encryption (XSalsa20-Poly1305) + scrypt key derivation
- Fallback transport options: LAN direct, SSH tunnel, Cloudflare Quick Tunnel, self-hosted relay
- Built with TypeScript, Ink (React for terminal), Commander
- Uses Anthropic's Claude Agent SDK under the hood
- Host-guest model with optional prompt approval workflow

**Architecture:**
```
Host (Claude Code) <--WebRTC P2P encrypted--> Guest (Terminal UI)
```

It's essentially a thin multiplexing layer over Claude Code that lets a remote developer send prompts and see responses in real-time, with the host maintaining full control.

GitHub: https://github.com/EliranG/claude-duet
npm: `npm install -g claude-duet`

MIT licensed. Feedback welcome, especially on the security model and connection architecture.

---

### r/commandline

**Title:** claude-duet: share a Claude Code AI session between two terminals with E2E encryption

**Body:**
Built a CLI tool for sharing Claude Code sessions in real-time between two terminals.

```
# Terminal 1 (host)
npx claude-duet host

# Terminal 2 (partner)
npx claude-duet join <code> --password <pw> --url ws://<ip>:3000
```

Features: E2E encrypted (NaCl), multiple connection modes (LAN/SSH/Cloudflare/relay), approval mode, Ink-based TUI, session stats.

https://github.com/EliranG/claude-duet

---

## 4. Hacker News

**Title:** Show HN: Claude Duet – Share a Claude Code session between two developers

**URL:** https://github.com/EliranG/claude-duet

**Comment (post immediately after):**

Hi HN, I'm Eliran. I lead R&D at Wix where we build AI-first products with multi-agent systems.

I kept wanting to pair program with colleagues using Claude Code (Anthropic's AI coding CLI) but there was no way to share a session. So I built claude-duet.

It's a CLI that lets two developers share a Claude Code session in real-time. The host runs Claude locally, the partner connects via WebRTC peer-to-peer (default) and sends prompts. Everything is E2E encrypted with NaCl secretbox. You also get typing indicators so you can see when someone's composing a prompt.

Technical decisions I'm happy to discuss:
- WebRTC P2P as default transport (via node-datachannel) — no server needed, NAT traversal built in
- E2E encryption with scrypt key derivation from a shared password
- Host-guest model with optional approval mode (vs. both running Claude independently)
- Transport-agnostic design — also supports LAN, SSH, Cloudflare tunnel, or custom relay

The tool is MIT licensed, written in TypeScript, uses Ink for the terminal UI (same framework Claude Code uses).

`npx claude-duet host` to try it.

Feedback on the architecture and security model especially welcome.

---

## 5. Dev.to Article

**Title:** How I Built claude-duet: Real-Time Pair Programming with AI

**Tags:** opensource, ai, typescript, tutorial

**Body:**

# How I Built claude-duet: Real-Time Pair Programming with AI

I lead R&D at Wix, building AI-powered products with multi-agent systems. I use Claude Code daily — and I kept hitting the same wall: **I couldn't share my AI coding session with a colleague.**

Claude Code runs locally. One developer, one session. If you want to pair program, the other person has to watch your screen over Zoom. That's not pair programming — that's watching someone else code.

So I built **claude-duet**.

## What It Does

claude-duet is an open-source CLI that lets two developers share a Claude Code session in real-time:

- **Host** runs Claude Code locally via the Agent SDK
- **Partner** connects peer-to-peer from their terminal and sends prompts
- **Both** see Claude's responses streamed live
- **All communication** is end-to-end encrypted

```bash
# Host
npx claude-duet host

# Partner (on any machine)
npx claude-duet join cd-a1b2c3d4 --password mypassword --url ws://192.168.1.5:4567
```

## The Architecture

```
┌──────────────┐    WebRTC P2P      ┌──────────────┐
│   Host       │◄──────────────────►│   Partner    │
│   Claude Code│    E2E encrypted   │   Terminal   │
│              │                    │   Client     │
└──────────────┘                    └──────────────┘
```

The host machine is the only one that talks to Claude. The partner connects peer-to-peer (WebRTC by default) and sends prompts through an encrypted channel. This means:

1. Only one API key needed (the host's)
2. The host maintains full control
3. Approval mode lets the host review partner prompts before execution

## Security: E2E Encryption

All messages are encrypted with **NaCl secretbox** (XSalsa20-Poly1305):

- Both sides derive a shared key from a password using **scrypt**
- Every message is encrypted before transmission
- The WebSocket server never sees plaintext content

## Connection Modes

One design decision I'm proud of: the tool is **transport-agnostic**. It works over:

| Mode | Use Case |
|------|----------|
| **WebRTC P2P** (default) | No server needed, works across NATs |
| **LAN Direct** | Same network, zero config |
| **SSH Tunnel** | Remote, proven security |
| **Cloudflare Tunnel** | Remote, no server needed |
| **Self-hosted Relay** | Custom infrastructure |

## Tech Stack

- **TypeScript** — end to end
- **Ink** — React for the terminal (same framework Claude Code uses)
- **@clack/prompts** — interactive setup wizard
- **node-datachannel** — WebRTC P2P (default transport)
- **ws** — WebSocket fallback
- **tweetnacl** — NaCl encryption
- **Commander** — CLI framework

## Try It

```bash
npm install -g claude-duet
claude-duet host
```

Or without installing:

```bash
npx claude-duet host
```

## What's Next

- Multi-guest sessions (more than two developers)
- Support for other AI coding tools (Codex CLI, Gemini CLI)
- Session recording and playback
- Claude Code skill integration

The project is MIT licensed and contributions are welcome.

**GitHub:** https://github.com/EliranG/claude-duet
**npm:** https://www.npmjs.com/package/claude-duet

---

## 6. Anthropic Discord

**Channel:** #community-projects (or equivalent)

Hey everyone! I just open-sourced **claude-duet** — a CLI tool that lets two developers share a Claude Code session in real-time.

Host runs Claude Code, partner connects peer-to-peer (WebRTC by default). Both see everything streamed live, E2E encrypted. No server needed.

Also supports LAN, SSH, Cloudflare tunnels, or a self-hosted relay if P2P doesn't fit your setup.

`npx claude-duet host` to try it.

GitHub: https://github.com/EliranG/claude-duet

Would love feedback from the Claude Code community!

---

## 7. WhatsApp (send to dev friends/colleagues)

hey, i built something cool — claude-duet

it lets 2 devs share a Claude Code session in real time. you host, your partner joins with one command, and both of you can chat + send prompts to Claude together. everything's E2E encrypted, peer-to-peer, no server.

some use cases:
- deep in a session and want someone to jump in for 5 min to brainstorm? send them a join command
- want to show your boss what AI coding looks like without a 1 hour zoom? send them one command
- pair program across offices, one Claude both driving

try it:
npx claude-duet host

https://github.com/EliranG/claude-duet

---

## Posting Schedule

**Best time to post: Tuesday-Thursday, 8-10am EST (3-5pm Israel time)**

| Order | Platform | Why this order |
|-------|----------|----------------|
| 1 | Hacker News | Gets indexed first, drives GitHub stars |
| 2 | Reddit (r/ClaudeAI) | Core audience, high engagement |
| 3 | Twitter thread | Shareable, taggable |
| 4 | LinkedIn | Professional network, slower pace |
| 5 | Reddit (r/programming, r/commandline) | Broader reach |
| 6 | Dev.to article | Long-form, SEO value |
| 7 | Anthropic Discord | Community engagement |

Post all within the same 2-hour window for maximum cross-pollination.

---

## Social Preview Image

Upload `docs/assets/social-banner.svg` as the GitHub social preview:
Settings → Social preview → Edit → Upload

This image appears when the repo link is shared on any platform.
