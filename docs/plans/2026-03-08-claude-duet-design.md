# Claude-Duet Design Document

## Problem

Two developers want to pair program with AI (Claude Code) together in real-time. Today this doesn't exist as a first-class product. The closest workaround is sharing a terminal via tmate, which has no user identity, no security, and crude UX.

## Solution

**claude-duet** — an open-source npm CLI tool that lets two users share a Claude Code session. One command to host, one to join. Claude Code-inspired interactive UX.

## User Experience Flow

### Host Flow (Alice)

```
$ claude-duet

  ┌  claude-duet v0.1.0
  │
  ◆  What would you like to do?
  │  ● Host a session (you run Claude Code)
  │  ○ Join a session (connect to a partner)
  │  ○ Run a relay server
  │
  ◆  Your display name?
  │  alice
  │
  ◆  How will your partner connect?
  │  ● Same network (LAN / VPN) — default, no setup needed
  │  ○ SSH tunnel — partner has SSH access to this machine
  │  ○ Cloudflare tunnel — requires cloudflared installed
  │  ○ Self-hosted relay — connect via your team's relay server
  │
  ◆  Trust mode?
  │  ● Approval mode — you review partner's prompts before execution
  │  ○ Trusted mode — partner's prompts execute immediately
  │
  ◇  Session ready!
  │
  │  ╭─────────────────────────────────────────╮
  │  │  Session:   pv-7f3a9c2e                 │
  │  │  Password:  a1b2c3d4                    │
  │  │  Connect:   ws://192.168.1.42:9876      │
  │  │                                         │
  │  │  Share these with your partner.          │
  │  │  Press [space] to show QR code.          │
  │  ╰─────────────────────────────────────────╯
  │
  │  ⏳ Waiting for partner to join...
```

### Join Flow (Bob)

```
$ claude-duet

  ┌  claude-duet v0.1.0
  │
  ◆  What would you like to do?
  │  ○ Host a session
  │  ● Join a session (connect to a partner)
  │  ○ Run a relay server
  │
  ◆  Your display name?
  │  bob
  │
  ◆  Session code?
  │  pv-7f3a9c2e
  │
  ◆  Password?
  │  ********
  │
  ◆  Connection URL?
  │  ws://192.168.1.42:9876
  │
  ◇  Connected! You're duet coding with alice.
  │  Approval mode is ON — alice will review your prompts.
  │
  └  Session started.
```

### Non-Interactive Mode (power users / scripts)

```bash
# Host — skip wizard
claude-duet host --name alice --no-approval --tunnel cloudflare

# Join — skip wizard
claude-duet join pv-7f3a9c2e --name bob --password a1b2c3d4 --url ws://192.168.1.42:9876
```

### Active Session UI

```
  claude-duet ── alice (host) ● bob (guest) ── pv-7f3a9c2e ── LAN
  ─────────────────────────────────────────────────────────────────

  [alice (host)]: Fix the login bug in auth.ts

  Here's the fix. The issue was that the JWT expiry check was using
  `<` instead of `<=`, causing tokens to be rejected on the exact
  second they expire.

    [tool] Edit: src/auth.ts ✓

  ── turn complete (3.2s, $0.0312) ──

  ⚠ Approval needed:
  bob: "Now add refresh token rotation"
  Approve? (y/n): █

  ─────────────────────────────────────────────────────────────────
  /quit  /trust  /kick  /end                     $0.0312 │ 12% ctx
```

### Session Lifecycle — Clear Start & End

**Session Start:**
```
  ◇  Connected! You're duet coding with alice.
  │  Approval mode is ON — alice will review your prompts.
  │
  └  ✦ Session started at 14:32:05
```

**Session End — Explicit:**
```
  [alice]: /end

  ┌  Session ending...
  │
  │  Duration:    47 minutes
  │  Turns:       23
  │  Total cost:  $0.4821
  │  Prompts:     alice: 14, bob: 9
  │
  │  Session log saved to .claude-duet/sessions/pv-7f3a9c2e.log
  │
  └  ✦ Session ended. Thanks for duet coding!
```

**Session End — Partner disconnected:**
```
  ○ bob disconnected.

  ◆  What would you like to do?
  │  ● Wait for bob to reconnect
  │  ○ End the session
  │  ○ Continue solo (regular Claude Code)
```

**Session End — Terminal closed (SIGINT/SIGHUP):**
```
  # Ctrl+C or terminal close triggers graceful shutdown:
  # 1. Notify partner: "alice's session is ending"
  # 2. Save session log
  # 3. Print summary
  # 4. Clean up WebSocket connections + tunnel
  # 5. Exit
```

## Architecture

```
User A's machine (host)
┌─────────────────────────────────────┐
│  claude-duet host                     │
│  ├── Claude Agent SDK instance      │  ← drives Claude Code
│  ├── Prompt Router                  │  ← attributes prompts by user
│  ├── WebSocket Server (:random)     │  ← real-time comms
│  ├── Approval Engine                │  ← host approves partner prompts
│  └── E2E Encryption (NaCl)         │  ← all messages encrypted
└─────────────────────────────────────┘
            │
            │  ws:// or wss:// (E2E encrypted payload)
            │
            │  Connection modes (user chooses during setup):
            │  ┌─ LAN direct (default): ws://192.168.x.x:PORT
            │  ├─ SSH tunnel (recommended for remote)
            │  ├─ Cloudflare tunnel (opt-in): wss://random.trycloudflare.com
            │  └─ Self-hosted relay (opt-in): wss://relay.mycompany.com
            │
            ▼
┌─────────────────────────────────────┐
│  User B's machine (joiner)          │
│  └── claude-duet join                 │
│      ├── WebSocket Client           │
│      ├── E2E Encryption (NaCl)     │
│      └── TUI (Ink + React)         │
└─────────────────────────────────────┘
```

**Zero third-party relay dependencies in the package.** The connection layer uses:
- LAN by default (no relay needed)
- SSH tunnel (recommended for remote — proven security, zero new code)
- User's own `cloudflared` binary (opt-in, they install it themselves)
- Self-hosted relay included in the package (~50 LOC WebSocket proxy)

## Key Design Decisions

### 1. Interactive wizard by default, flags for power users
- Running `claude-duet` with no args launches an interactive setup wizard (@clack/prompts)
- Every wizard step has a CLI flag equivalent for non-interactive use
- Follows the `create-next-app` / `create astro` UX pattern

### 2. Host runs Claude Code, not the joiner
- Claude Code executes on the host's machine with the host's permissions
- The joiner sends prompts; the host's machine executes them
- This means the host must trust the joiner (mitigated by approval mode)

### 3. Agent SDK, not CLI subprocess
- Use `@anthropic-ai/claude-agent-sdk` for programmatic control
- Streaming via async generators
- Session resumption support

### 4. E2E encryption (LAN mode)
- Password-based key derivation (scrypt)
- NaCl secretbox encryption on all WebSocket messages
- When using SSH tunnel, SSH handles encryption (NaCl is defense-in-depth)

### 5. Approval mode (default on)
- When joiner sends a prompt, host sees it and can approve/reject
- Host can toggle to "trusted mode" via `/trust` command
- Host's own prompts always execute immediately

### 6. SSH as recommended remote transport
- Developers already trust and use SSH daily
- Built-in encryption, authentication, NAT traversal
- Zero new code needed — just documentation
- Cloudflare tunnel and self-hosted relay as alternatives

### 7. Clear session lifecycle
- Explicit start and end events displayed to both users
- Session summary on end (duration, turns, cost, prompt counts)
- Graceful shutdown on Ctrl+C, terminal close, `/end`, `/quit`
- Partner disconnect triggers reconnect/end choice
- Session logs saved locally for audit

### 8. Signature visual identity — violet `✦`
Claude Code owns the orange `✦`. Claude-Duet uses the same symbol in **violet/purple** (blue + red = two people).

**Layered indicator system** (each terminal gets the best it supports):

| Layer | What | Support |
|-------|------|---------|
| 1 (universal) | Violet `✦` in status bar + prompt | All terminals |
| 1 (universal) | Terminal title: `claude-duet ✦ alice + bob` | All terminals |
| 1 (universal) | Cursor shape → underline while in session | All modern terminals |
| 2 (enhanced) | Cursor color → violet (#9B59B6) | Kitty, WezTerm, Ghostty |
| 2 (enhanced) | iTerm2 badge: translucent `DUET CODING` watermark | iTerm2 only |
| 2 (enhanced) | iTerm2 tab color → violet | iTerm2 only |
| 2 (enhanced) | Desktop notification on partner join/disconnect | All (node-notifier) |
| 3 (personality) | Subtle chime on partner join | macOS (afplay) |
| 3 (personality) | `✦` pulses when partner is typing | All (via Ink animation) |

All indicators are **restored on exit** — cursor, title, tab color revert to original state.

## Session Lifecycle

```
┌─────────┐     ┌──────────┐     ┌──────────┐     ┌─────────┐
│  Setup   │────▶│  Waiting │────▶│  Active  │────▶│  Ended  │
│  wizard  │     │  for     │     │  session │     │  summary│
│          │     │  partner │     │          │     │  + log  │
└─────────┘     └──────────┘     └──────────┘     └─────────┘
                                       │
                                       ├── /end command
                                       ├── /quit command
                                       ├── Ctrl+C / SIGINT
                                       ├── Terminal close / SIGHUP
                                       ├── /kick (remove partner)
                                       └── Partner disconnect → choice
```

**Session end triggers:**
| Trigger | Who | What happens |
|---------|-----|-------------|
| `/end` | Either user | Graceful end, summary shown to both |
| `/quit` | Either user | That user leaves; host ending = session ends |
| `Ctrl+C` | Either user | Same as `/quit` |
| Terminal close | Either user | SIGHUP caught, graceful shutdown |
| `/kick` | Host only | Remove partner, session continues solo |
| Network drop | Either | Auto-reconnect attempt for 30s, then prompt |

## Message Protocol

All messages are JSON, encrypted before transmission:

```typescript
// Client → Server
{ type: "prompt", user: "bob", text: "fix the login bug" }
{ type: "typing", user: "bob", isTyping: true }
{ type: "approval_response", promptId: "abc", approved: true }

// Server → Client(s)
{ type: "prompt_received", promptId: "abc", user: "bob", text: "..." }
{ type: "approval_request", promptId: "abc", user: "bob", text: "..." }
{ type: "stream_chunk", text: "Here's the fix..." }
{ type: "tool_use", tool: "Edit", input: { file: "auth.ts", ... } }
{ type: "tool_result", tool: "Edit", output: "..." }
{ type: "turn_complete", cost: 0.05 }
{ type: "presence", users: [{ name: "alice", role: "host" }, ...] }
{ type: "session_start", timestamp: 1709913125 }
{ type: "session_end", reason: "host_ended", summary: { ... } }
{ type: "error", message: "..." }
```

## Security Model

| Layer | Mechanism |
|-------|-----------|
| Authentication | Session code (crypto-random) + password |
| Encryption | NaCl secretbox (XSalsa20-Poly1305) — all tiers |
| Key derivation | scrypt(password + session_code) |
| Transport (remote) | SSH tunnel (recommended) or Cloudflare tunnel (TLS) |
| Authorization | Approval mode (host reviews prompts) |
| Scope | Claude runs in project directory only |
| Expiry | Unclaimed sessions expire in 5 minutes |
| Audit | Session log saved locally with all prompts + user attribution |

## Tech Stack

| Component | Library | Why |
|-----------|---------|-----|
| Language | TypeScript | Matches Claude Code ecosystem |
| Terminal UI | `ink` + `@inkjs/ui` | Same stack as Claude Code (React for terminal) |
| Setup wizard | `@clack/prompts` | Beautiful defaults, used by Astro/SvelteKit |
| Claude integration | `@anthropic-ai/claude-agent-sdk` | Official SDK, streaming support |
| WebSocket | `ws` | Standard, lightweight |
| Encryption | `tweetnacl` + `tweetnacl-util` | Proven, audited NaCl implementation |
| Session codes | `nanoid` | Crypto-random IDs |
| QR codes | `qrcode-terminal` | Display connection QR in terminal |
| Colors | `picocolors` | Lightweight (7KB vs chalk 101KB) |
| CLI framework | `commander` | Standard, well-documented |
| Tunnel (opt-in) | User's own `cloudflared` (not bundled) | Zero third-party relay deps |
| Relay (opt-in) | Self-hosted relay included (~50 LOC) | Auditable, no external service |

## Open Source

- **License:** MIT
- **Repository:** github.com/elirang/claude-duet
- **Package:** `npm install -g claude-duet` (or `npx claude-duet`)
- **Files:** README.md, CONTRIBUTING.md, LICENSE, CHANGELOG.md, .github/workflows/ci.yml

## Scope

### MVP (v0.1)
- Interactive setup wizard (host/join/relay)
- Non-interactive mode via CLI flags
- Two users, one session
- Ink-based TUI with status bar, streaming, presence
- User attribution in prompts
- E2E encryption (NaCl secretbox)
- Approval mode (default on)
- Clear session start/end with summary
- Graceful shutdown on Ctrl+C, SIGHUP, /end, /quit
- Session logs saved locally
- Connection: LAN direct (default)
- Connection: SSH tunnel (recommended for remote, documented)
- Connection: Cloudflare Quick Tunnel (opt-in)
- Connection: Self-hosted relay (included in package)
- QR code for connection info (spacebar toggle)
- Open source: MIT license, CI, README, CONTRIBUTING

### Future (v0.2+)
- File change previews
- Voice chat integration
- More than 2 users
- Claude Code skill integration (`/pair`)
- Supabase Realtime Broadcast as managed relay option
- Hyperswarm P2P (no server at all)
- Session recording/playback
- Auto-reconnect with backoff
