# Changelog

All notable changes to claude-duet will be documented in this file.

## [0.3.0] - 2026-03-10

### Added
- WebRTC P2P as default connection mode (no relay server needed)
- SDP offer/answer codec for compact terminal-friendly connection codes
- Typing indicators (inline on prompt line, keystroke debounced)
- Claude branded response UI (orange header, tool arrows, styled footer)
- Auto-copy join/answer codes to clipboard
- DuetTransport abstraction for WebSocket and WebRTC

### Fixed
- Message duplication when host and guest share the same username
- Input line double echo on Enter

### Changed
- UI labels use "you" for self, partner name for others

## [0.2.0] - 2026-03-09

### Changed
- **Architecture: Headless wrapper** — claude-duet now wraps Claude Code in headless mode (`claude -p --output-format stream-json`) instead of using the Agent SDK directly. This means you can resume your existing Claude Code sessions.
- ClaudeBridge rewritten to spawn Claude Code as a child process with NDJSON stream parsing
- Terminal input now uses raw mode for inline ghost text suggestions
- Role-based nickname coloring: host = cyan, guest = yellow
- `@claude` matching is now case-insensitive (`@Claude`, `@CLAUDE`, etc. all work)
- Session end messaging: guest sees clear "host ended the session" + tip to continue solo

### Added
- `--continue` flag to resume most recent Claude Code session
- `--resume <id>` flag to resume a specific session by ID
- `--permission-mode` flag with two modes: `auto` (default, pre-approves tools) and `interactive` (host approves each tool use)
- Inline ghost text suggestions — type `@` or `/` and see completions, accept with Tab or Right arrow
- Permission server (`src/permissions.ts`) — local HTTP server for interactive tool approval via Claude Code hooks
- Session history reader (`src/history.ts`) — reads Claude Code JSONL files for guest history catch-up
- History replay — guests see the full conversation history when joining a resumed session
- `permissionMode` config key (`claude-duet config set permissionMode interactive`)
- Wizard steps for session resume and permission mode selection
- `HistoryReplayMessage` protocol type for guest catch-up
- Colored session backgrounds with bright white text for readability

### Fixed
- Claude Code nesting protection bypass (strips `CLAUDECODE` env var from child process)
- Race condition where early Claude Code errors could be silently lost
- Approval request handler now works correctly with raw mode input

### Removed
- Claude Agent SDK dependency (replaced by Claude Code CLI)
- `src/types/claude-agent-sdk.d.ts` type stubs

### Prerequisites
- Claude Code CLI must be installed (`npm install -g @anthropic-ai/claude-code`)

## [0.1.0] - 2026-03-08

### Added
- E2E encrypted sessions using NaCl secretbox (XSalsa20-Poly1305) with scrypt key derivation
- Connection modes: LAN direct, SSH tunnel, Cloudflare Quick Tunnel, self-hosted relay
- Approval mode — host reviews guest prompts before execution (on by default)
- Interactive setup wizard with @clack/prompts
- Ink-based terminal UI with status bar and chat view
- Session lifecycle manager with stats, summary, and logging
- CLI commands: `host`, `join`, `relay`
- Real-time response streaming from Claude to both host and guest
- Relay server for custom infrastructure deployments
