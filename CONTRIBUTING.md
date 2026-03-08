# Contributing to pair-vibe

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/elirang/pair-vibe.git
cd pair-vibe

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Watch mode for development
npm run dev          # TypeScript watch
npm run test:watch   # Vitest watch
```

## Running Tests

```bash
# Run all tests once
npm test

# Watch mode (re-runs on file changes)
npm run test:watch
```

The test suite uses Vitest. Tests live in `src/__tests__/` alongside the source code.

## Project Structure

```
src/
  index.ts          # CLI entry point (commander)
  wizard.ts         # Interactive setup wizard (@clack/prompts)
  server.ts         # WebSocket server (host side)
  client.ts         # WebSocket client (joiner side)
  crypto.ts         # E2E encryption (tweetnacl)
  protocol.ts       # Message protocol types and helpers
  session.ts        # Session state management
  connection.ts     # Connection mode handling
  router.ts         # Message routing between host/guest/Claude
  claude.ts         # Claude Agent SDK integration
  lifecycle.ts      # Session lifecycle (start, end, summary)
  relay-server.ts   # Relay server for remote connections
  commands/
    host.ts         # Host command implementation
    join.ts         # Join command implementation
  ui/
    App.tsx         # Root Ink component
    ChatView.tsx    # Chat message display
    StatusBar.tsx   # Session status bar
  __tests__/        # Test files
```

## Pull Request Guidelines

1. **Fork and branch**: Create a feature branch from `main`.
2. **Write tests**: New features should include tests. Bug fixes should include a regression test.
3. **Keep it focused**: One PR per feature or fix.
4. **Run the suite**: Make sure `npm test` passes before submitting.
5. **Describe your changes**: Write a clear PR description explaining what and why.

## Code Style

- TypeScript with strict mode enabled
- ES modules (`"type": "module"` in package.json)
- Functional style preferred; classes only when necessary
- Use `picocolors` for terminal colors (not chalk)
- Keep dependencies minimal

## Reporting Issues

Open an issue at [github.com/elirang/pair-vibe/issues](https://github.com/elirang/pair-vibe/issues) with:

- Steps to reproduce
- Expected vs actual behavior
- Node.js version and OS

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
