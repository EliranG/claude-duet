# Changelog

All notable changes to claude-duet will be documented in this file.

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
