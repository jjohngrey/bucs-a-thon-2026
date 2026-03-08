# bucs-a-thon-2026

Small multiplayer game repo with:

- `apps/game-client`
- `apps/server`
- `packages/shared`

## Current State

Right now the repo contains:

- a working Node + Socket.IO backend in `apps/server`
- a shared contract package in `packages/shared`
- an early Vite + Phaser client scaffold in `apps/game-client`
- current docs in `docs/`

## Where To Read First

- `docs/architecture.md`
- `docs/client-server-flow.md`
- `docs/netcode.md`
- `docs/server-progress.md`
- `docs/ui-backend-integration.md`

## Build and run

Build shared and server:

```bash
corepack pnpm check
```

Run the server:

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

- health endpoint
- lobby create, join, leave, ready, and return
- lobby character and stage selection
- match start, countdown, activation, and end
- recurring authoritative snapshots
- server-side input handling
- simple movement, jump, gravity, floor collision
- basic attack, damage, exponential knockback, and hitstun
- blast-zone KO, stock decrement, and respawn lifecycle on the server
- automatic server-side win detection
- shared stage and rules content for floor, blast zone, spawns, and respawn settings
- active-match disconnect handling
- smoke tests for lobby, match start, combat, match end, and return to lobby

Smoke test commands:

- `corepack pnpm smoke:lobby`
- `corepack pnpm smoke:match-start`
- `corepack pnpm smoke:combat`
- `corepack pnpm smoke:stocks`
- `corepack pnpm smoke:auto-win`
- `corepack pnpm smoke:match-disconnect`
- `corepack pnpm smoke:match-end`
- `corepack pnpm smoke:return-lobby`
