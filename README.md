# pair-vibe

**Pair vibe coding -- share a Claude Code session with a partner.**

Two developers, one Claude. Host a session, share a code, and vibe together in real-time.

## Quick Start

```bash
# Install globally
npm install -g pair-vibe

# Host a session (LAN default)
pair-vibe host

# On another machine, join with the code shown by host
pair-vibe join <session-code> --url ws://<host-ip>:3000
```

Or just run the interactive wizard:

```bash
pair-vibe
```

## How It Works

The **host** runs Claude Code locally via the Agent SDK and starts a WebSocket server.
The **joiner** connects over the network and sends prompts to the shared session.
All communication is end-to-end encrypted -- the transport layer never sees plaintext.

Both users see Claude's responses stream in real-time through an Ink-based terminal UI.

## Connection Modes

| Mode | Command | Use Case |
|------|---------|----------|
| **LAN Direct** | `pair-vibe host` | Same network, zero config |
| **Cloudflare Tunnel** | `pair-vibe host --tunnel cloudflare` | Remote, no server needed |
| **Self-hosted Relay** | `pair-vibe host --relay wss://relay.example.com` | Custom infrastructure |
| **SSH Tunnel** | `ssh -L 3000:localhost:3000 host` + `pair-vibe join` | Proven security |

### Running a Relay Server

```bash
pair-vibe relay              # Default port 8080
pair-vibe relay --port 9000  # Custom port
```

## Security

- **E2E Encryption**: Every message encrypted with NaCl secretbox (XSalsa20-Poly1305)
- **Key Derivation**: Session passphrase stretched via scrypt before use
- **Approval Mode**: On by default -- host reviews and approves guest prompts before execution
- **No Third-Party Relay**: LAN direct is the default; SSH is recommended for remote

The session code encodes both the connection URL and an encryption key. The host machine
runs all Claude Code operations -- the joiner never gets direct filesystem access.

## Session Commands

| Command | Description |
|---------|-------------|
| `/end` | End the session gracefully |
| `/quit` | Disconnect from the session |
| `/trust` | Toggle auto-approve mode for guest prompts |
| `/kick` | Remove the connected guest (host only) |
| `Ctrl+C` | Graceful shutdown with end-of-session summary |

## Usage

```
pair-vibe                                   # Interactive wizard
pair-vibe host                              # Host on LAN (default)
pair-vibe host --tunnel cloudflare          # Host via Cloudflare Quick Tunnel
pair-vibe host --relay wss://relay.co       # Host via relay server
pair-vibe relay                             # Run relay server
pair-vibe join <code> --url ws://...        # Join a session
```

## Development

```bash
git clone https://github.com/elirang/pair-vibe.git
cd pair-vibe
npm install
npm run build
npm test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE)
