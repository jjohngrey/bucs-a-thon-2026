# server

Node + TypeScript backend for lobby state, socket events, and authoritative match flow.

## Current lobby support

- `lobby:create`
- `lobby:join`
- `lobby:leave`
- `lobby:ready`
- `lobby:return`
- `lobby:state` broadcast after each lobby mutation

## Current match support

- `match:start`
- in-memory match session creation
- `match:starting` broadcast with countdown
- automatic transition from `starting` to `in-match`
- initial `match:snapshot` emission when countdown finishes
- recurring `match:snapshot` emission at `20` ticks/second
- `match:input` storage per player
- simple movement, jump, gravity, and floor collision
- basic melee attack, damage, knockback, and hitstun
- `match:end`
- `match:ended`
- match cleanup on leave/disconnect

## Runtime pieces

- `src/http/app.ts`: HTTP server and `/health`
- `src/sockets/registerHandlers.ts`: socket event handlers
- `src/lobby/*`: lobby services and in-memory lobby state
- `src/match/*`: match lifecycle, runtime state, and snapshot loop

## Current bootstrap includes

- HTTP server with `GET /health`
- Socket.IO server wiring
- connection and disconnect logging
- initial `session:joined` emission
- handler registration split from bootstrap
- local bind defaults to `127.0.0.1:3001`

## Smoke tests

Run from repo root:

```bash
corepack pnpm smoke:lobby
corepack pnpm smoke:match-start
corepack pnpm smoke:combat
corepack pnpm smoke:match-end
corepack pnpm smoke:return-lobby
```
