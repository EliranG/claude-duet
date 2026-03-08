# Pair-Vibe Design Document

## Problem

Two developers want to pair program with AI (Claude Code) together in real-time. Today this doesn't exist as a first-class product. The closest workaround is sharing a terminal via tmate, which has no user identity, no security, and crude UX.

## Solution

**pair-vibe** — an npm CLI tool that lets two users share a Claude Code session. One command to host, one to join.

```bash
# User A
pair-vibe host
# → Session: pv-7f3a9c2e  Password: ****

# User B
pair-vibe join pv-7f3a9c2e
# → Enter password: ****
# → Connected. You're pair vibing with Alice.
```

Both users see the conversation in real-time. Both can send prompts. Claude sees who said what.

## Architecture

```
User A's machine (host)
┌─────────────────────────────────────┐
│  pair-vibe host                     │
│  ├── Claude Agent SDK instance      │  ← drives Claude Code
│  ├── Prompt Router                  │  ← attributes prompts by user
│  ├── WebSocket Server (:random)     │  ← real-time comms
│  ├── Approval Engine                │  ← host approves partner prompts
│  └── E2E Encryption (NaCl)         │  ← all messages encrypted
└─────────────────────────────────────┘
            │
            │  ws:// or wss:// (E2E encrypted payload)
            │
            │  Connection modes (user chooses):
            │  ┌─ LAN direct (default): ws://192.168.x.x:PORT
            │  ├─ Cloudflare tunnel (opt-in): wss://random.trycloudflare.com
            │  ├─ Self-hosted relay (opt-in): wss://relay.mycompany.com
            │  └─ Custom URL: SSH tunnel, Tailscale, VPN, etc.
            │
            ▼
┌─────────────────────────────────────┐
│  User B's machine (joiner)          │
│  └── pair-vibe join                 │
│      ├── WebSocket Client           │
│      ├── E2E Encryption (NaCl)     │
│      └── TUI (conversation + input) │
└─────────────────────────────────────┘
```

**Zero third-party relay dependencies in the package.** The connection layer uses:
- LAN by default (no relay needed)
- User's own `cloudflared` binary (opt-in, they install it themselves)
- Self-hosted relay included in the package (~50 LOC WebSocket proxy)
- Any custom URL the user provides (SSH tunnel, Tailscale, etc.)

## Key Design Decisions

### 1. Host runs Claude Code, not the joiner
- Claude Code executes on the host's machine with the host's permissions
- The joiner sends prompts; the host's machine executes them
- This means the host must trust the joiner (mitigated by approval mode)

### 2. Agent SDK, not CLI subprocess
- Use `@anthropic-ai/claude-agent-sdk` for programmatic control
- Streaming via async generators
- Session resumption support
- Tool approval callbacks (used for approval mode)

### 3. E2E encryption
- Password-based key derivation (scrypt)
- NaCl box encryption on all WebSocket messages
- The relay (bore.pub) sees only ciphertext

### 4. Approval mode (default on)
- When joiner sends a prompt, host sees it and can approve/reject
- Host can toggle to "trusted mode" to auto-approve
- Host's own prompts always execute immediately

### 5. Tunnel for NAT traversal
- bore.pub (open-source, self-hostable) as default relay
- Falls back to localtunnel if bore unavailable
- Session code encodes the tunnel endpoint

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
{ type: "presence", users: [{ name: "alice", role: "host" }, { name: "bob", role: "guest" }] }
{ type: "error", message: "..." }
```

## Security Model

| Layer | Mechanism |
|-------|-----------|
| Authentication | Session code (crypto-random) + password |
| Encryption | NaCl secretbox (XSalsa20-Poly1305) |
| Key derivation | scrypt(password + session_code) |
| Authorization | Approval mode (host reviews prompts) |
| Scope | Claude runs in project directory only |
| Expiry | Unclaimed sessions expire in 5 minutes |
| Audit | All prompts logged with user attribution |

## Tech Stack

| Component | Library |
|-----------|---------|
| Language | TypeScript |
| Claude integration | `@anthropic-ai/claude-agent-sdk` |
| WebSocket | `ws` |
| CLI framework | `commander` |
| Encryption | `tweetnacl` + `tweetnacl-util` |
| Session codes | `nanoid` |
| Terminal UI | `chalk` + raw readline (MVP) |
| Tunnel (opt-in) | User's own `cloudflared` (not bundled) |
| Relay (opt-in) | Self-hosted relay included (~50 LOC) |

**Zero third-party relay/tunnel npm dependencies.** No bore, no localtunnel, no ngrok.

## Scope

### MVP (v0.1)
- `pair-vibe host` / `pair-vibe join <code>` / `pair-vibe relay`
- Two users, one session
- Streaming conversation display
- User attribution in prompts
- Password-based E2E encryption
- Approval mode (default on)
- Connection: LAN direct (default)
- Connection: Cloudflare Quick Tunnel (opt-in, user installs cloudflared)
- Connection: Self-hosted relay server (included in package)
- Connection: Custom URL (SSH tunnel, Tailscale, VPN, etc.)

### Future (v0.2+)
- Rich TUI with split panes (Ink)
- File change previews
- Voice chat integration
- More than 2 users
- Claude Code skill integration (`/pair`)
- Supabase Realtime Broadcast as managed relay option
- Hyperswarm P2P (no server at all)
- Session recording/playback
