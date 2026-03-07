# bucs-a-thon-2026

Planning docs live in `docs/` for the initial `TypeScript + Phaser + Node + WebSockets` architecture.

Implementation packages will live under:

- `apps/game-client`
- `apps/server`
- `packages/shared`

## Current State

Right now the repo contains:

- planning docs in `docs/`
- a real shared TypeScript package in `packages/shared`
- placeholder app roots for the future Phaser client and Node server

## Where To Read First

- `docs/execution-plan.md`
- `docs/folder-structure.md`
- `docs/netcode.md`
- `docs/server-progress.md`

## Shared Package

`packages/shared` is the contract package for both client and server. It contains:

- socket event names
- payload types
- lobby/match/player types
- core gameplay and network constants

Important entrypoint:

- `packages/shared/src/index.ts`

## Build

Build the shared package directly with TypeScript:

```bash
tsc -p packages/shared/tsconfig.json
```

Or use the workspace command through Corepack:

```bash
corepack pnpm build:shared
```

Or directly:

```bash
corepack pnpm --filter @bucs/shared build
```

Build the current checked-in backend pieces:

```bash
corepack pnpm check
```

Run the server locally:

```bash
corepack pnpm dev:server
```

Then verify:

```bash
curl http://127.0.0.1:3001/health
```

Expected response:

```json
{"ok":true}
```

## Current Progress

Implemented:

- `packages/shared` contract package
- root workspace config
- `apps/server` bootstrap package
- HTTP health endpoint
- Socket.IO server wiring
- lobby create/join/leave/ready flow
- in-memory match session creation
- countdown transition from `starting` to `in-match`
- smoke tests for lobby and match start

Checked:

- `corepack pnpm check`
- `corepack pnpm smoke:lobby`
- `corepack pnpm smoke:match-start`

## Team Starting Points

- Server owner: `packages/shared/src/protocol` then `apps/server`
- Gameplay owner: `packages/shared/src/types` then `apps/game-client/src/game`
- UI owner: `docs/execution-plan.md` then `apps/game-client`
- Content owner: `docs/mvp.md` then `packages/shared/src/content` and client assets
