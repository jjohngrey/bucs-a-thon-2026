# Stack

## Chosen Stack

- `TypeScript`: one language across client, server, and shared types
- `Phaser 3`: code-first 2D game framework for rendering, scenes, input, audio
- `Node.js`: backend runtime
- `Socket.IO` or `ws`: realtime communication between client and server
- `pnpm` workspaces: monorepo package management
- `Vite`: client bundling and local dev for Phaser app
- `tsup` or `tsx`: server build/run workflow

## Why This Fits

### TypeScript

TypeScript keeps the team aligned across frontend and backend. Shared event payloads and content schemas are a major advantage for multiplayer work.

### Phaser

Phaser gives you:

- rendering
- scene management
- sprite animation
- input handling
- audio
- camera support

without forcing a heavy editor-driven workflow. You still code the game directly.

### Node + WebSockets

This keeps the online stack simple:

- a lobby server
- room lifecycle
- match coordination
- realtime state updates

It is enough for a prototype without dragging in large multiplayer infrastructure early.

## Specific Recommendations

### WebSocket Library

Use `Socket.IO` if:

- you want easier room handling
- you want reconnection support sooner
- the team values speed over minimal protocol overhead

Use `ws` if:

- you want a thinner abstraction
- you are comfortable building room/event plumbing yourself

For this project, `Socket.IO` is the better default.

### Physics

Do not rely on arcade physics for combat truth. Use Phaser for rendering and input, but keep combat math in your own game logic layer. That makes hit detection and knockback easier to control.

### Persistence

Do not add a database on day one unless you need:

- accounts
- saved profiles
- match history
- cosmetics

For MVP, lobby state and matches can live entirely in memory.

## Suggested Tooling

- `Biome` or `ESLint + Prettier` for formatting/linting
- `Vitest` for unit tests on shared logic
- `Zod` for validating inbound socket payloads
- `Docker` only if deployment setup becomes noisy

## Initial Dependencies

### Client

- `phaser`
- `socket.io-client`
- `zod`

### Server

- `socket.io`
- `express` if simple HTTP endpoints are useful
- `zod`

### Shared

- `zod`

## Deployment

Simple deployment target:

- client on `Vercel` or `Netlify`
- server on `Railway`, `Render`, or `Fly.io`

That is enough for a class project or hackathon-scale release.
