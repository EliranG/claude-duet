# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in claude-duet, please report it responsibly.

**Do not open a public issue.**

Instead, email **EliranG@users.noreply.github.com** with:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You will receive a response within 48 hours. We will work with you to understand and address the issue before any public disclosure.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.2.x   | Yes       |
| 0.1.x   | Yes       |

## Security Model

### Host Machine
Claude Code runs on the host's machine with the host's permissions and API key. The host is responsible for what Claude can access.

### Permission Modes
- **Auto mode** (default): All standard tools (Edit, Write, Read, Glob, Grep, Bash, Agent, NotebookEdit) are pre-approved. Claude executes freely.
- **Interactive mode**: The host approves each tool use via a local HTTP permission server. This gives the same safety as normal Claude Code's interactive permission prompts.

### E2E Encryption
All WebSocket messages are encrypted with NaCl secretbox (XSalsa20-Poly1305) using scrypt key derivation from the session password. This applies to all connection modes (LAN, SSH, Cloudflare, relay).

### Guest History Replay
When a guest joins a resumed session, the host reads the session JSONL file from disk and sends parsed history messages over the encrypted WebSocket. The raw JSONL file is never transmitted — only parsed display-friendly messages.
