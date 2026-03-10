# FAQ

## What is claude-duet?

claude-duet is an open-source CLI tool that lets two developers share a single Claude Code session in real-time. One person hosts the session (Claude Code runs on their machine), and a partner connects over WebSocket. Both users can chat with each other and send prompts to Claude together. Think of it as pair programming with an AI third wheel — you decide when to bring Claude in by typing `@claude`.

## Do both users need a Claude API key or Claude Code subscription?

No. Only the host needs Claude Code installed and authenticated. The partner just runs `npx claude-duet join ...` — no Claude Code installation, no API key, no subscription required on their side. Claude runs entirely on the host's machine using the host's credentials.

## Does my partner see my files and code?

Your partner sees exactly what Claude sees and produces during the session: Claude's responses, tool invocations (file edits, reads, bash commands), and tool results. They do not get direct filesystem access to your machine. However, if Claude reads a file's contents as part of answering a prompt, that content will be visible to your partner in the session output. The partner cannot browse your filesystem independently — all file access goes through Claude's tool use.

## Is it secure? How does encryption work?

All messages are end-to-end encrypted using NaCl secretbox (XSalsa20-Poly1305). The encryption key is derived from the session password using scrypt (with the session code as salt). Even if someone intercepts the traffic, they cannot read the messages without the password.

Additional security layers:
- **Session codes** are crypto-random (nanoid) and **passwords** are generated from `crypto.randomBytes`
- **Unclaimed sessions expire** after 5 minutes
- **Approval mode** (on by default) requires the host to review and approve the partner's Claude prompts before they execute
- **P2P direct by default** — WebRTC data channels with DTLS encryption, plus NaCl application-layer encryption (defense in depth)
- No third-party relay in the default P2P mode — your data flows directly between the two machines

When using SSH tunnels for remote access, you get SSH's encryption on top of the NaCl encryption (triple layered).

## Can I use this remotely, not on the same network?

Yes. The default P2P mode uses WebRTC with STUN-based NAT traversal, which works across different networks for most home/office NAT types (~80-85% success rate). Just run `npx claude-duet host` and share the join command — no tunnel or server setup needed.

If P2P doesn't work (e.g. behind a strict corporate firewall), there are fallback options:

1. **SSH tunnel**: If your partner has SSH access to your machine, they forward the port:
   ```
   ssh -L 3000:localhost:3000 your-host
   ```
   Then join using `ws://localhost:3000`. This is the most secure option.

2. **Cloudflare Quick Tunnel**: Run `npx claude-duet host --tunnel cloudflare`. This requires `cloudflared` installed on the host machine (`brew install cloudflared`). It creates a temporary public URL — no server or account needed.

3. **Self-hosted relay**: claude-duet includes a minimal WebSocket relay server that you can run on any server your team controls.

## What happens to my Claude Code conversation after the session ends?

The Claude Code session persists normally on the host's machine. After a duet session ends, the host can resume the same Claude Code conversation solo using `claude --continue`. All of Claude's context, file edits, and conversation history remain intact.

## Does it work with Claude Code features like --continue and --resume?

Yes. claude-duet wraps Claude Code in headless mode, so it supports the full Claude Code feature set:
- `npx claude-duet host --continue` — resume your most recent Claude Code session as a shared session
- `npx claude-duet host --resume <session-id>` — resume a specific session

When a partner joins a resumed session, they automatically receive a history replay of the prior conversation so they have context.

## Can my partner run destructive commands on my machine?

By default, no — not without your explicit approval. **Approval mode** is enabled by default, which means every prompt your partner sends to Claude must be reviewed and approved by you (the host) before Claude executes it. You see the exact prompt text and press `y` to approve or `n` to reject.

Even when approval mode is disabled (`/trust` or `--no-approval`), Claude Code itself has its own permission system. You can also run with `--permission-mode interactive` to manually approve each individual tool invocation.

The host can also `/kick` the partner at any time to immediately disconnect them.

## What is approval mode?

Approval mode is a safety feature that is on by default. When enabled, any prompt the partner sends to Claude is held in a queue until the host reviews it. The host sees the prompt text and can approve (y) or reject (n).

You can toggle approval mode during a session:
- `/trust` — disable approval (partner's prompts execute immediately)
- `/approval` — re-enable approval

You can also start without it: `npx claude-duet host --no-approval`.

## What are the system requirements?

**Host:**
- Node.js 18 or later
- [Claude Code CLI](https://claude.ai/code) installed and authenticated
- A terminal that supports standard ANSI escape codes

**Partner (joiner):**
- Node.js 18 or later
- That's it — no Claude Code installation needed. Just `npx claude-duet join ...`

**Optional (for fallback connection modes):**
- `cloudflared` for Cloudflare tunnel mode (`brew install cloudflared`)
- SSH access to the host machine for SSH tunnel mode

## I'm getting "connection refused" or the join command hangs. What should I check?

1. **P2P mode**: Make sure both sides exchanged the offer and answer codes correctly. Copy the full codes — even one missing character will fail.
2. **NAT type**: Some restrictive NATs (symmetric NAT) block WebRTC hole punching. Try `--tunnel cloudflare` as a fallback.
3. **Firewall**: Check that UDP traffic is not blocked. WebRTC uses UDP for the data channel.
4. **Correct password**: Double-check the `--password` value. Copy the exact join command the host terminal prints.
5. **Session expired**: Unclaimed sessions expire after 5 minutes. If you waited too long, restart the host.
6. **Only one guest**: claude-duet supports exactly one host and one guest. If someone is already connected, new connections are rejected.

For WebSocket modes (with `--tunnel` or `--url`):
- Make sure both machines are on the same Wi-Fi or VPN for LAN mode
- Check that the port is not blocked on macOS (you may get a system prompt)

## Can more than two people join a session?

Not currently. claude-duet is designed for two-person pair programming: one host and one guest. Multi-user support may be considered in future versions.
