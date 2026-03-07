# Server Progress

## Current Backend State

The server currently supports:

- HTTP health check at `GET /health`
- Socket.IO connections
- in-memory lobby storage
- `lobby:create`
- `lobby:join`
- `lobby:leave`
- `lobby:ready`
- `match:start`
- in-memory match session creation
- countdown-driven transition from `starting` to `in-match`
- initial `match:snapshot` emission when the match becomes active
- recurring `match:snapshot` emission for active matches
- in-memory `match:input` storage per player
- explicit `match:end` handling with `match:ended` broadcast
- cleanup of in-memory match sessions when a room breaks

## Verified Commands

Use these commands from the repo root:

```bash
corepack pnpm check
corepack pnpm smoke:lobby
corepack pnpm smoke:match-start
```

## What The Smoke Tests Prove

### `smoke:lobby`

- one client can create a lobby
- another client can join it
- both clients receive `lobby:state`

### `smoke:match-start`

- host can start a match
- non-host must ready up first
- both clients receive `match:starting`
- lobby phase moves from `waiting` to `starting`
- after countdown, lobby phase moves to `in-match`
- both clients receive an initial `match:snapshot`
- active matches continue emitting snapshots with increasing server frames

### `smoke:match-end`

- an active match can be ended explicitly
- both clients receive `match:ended`
- lobby phase moves to `finished`
- the active in-memory match loop is cleaned up

## Not Done Yet

- live `match:input` handling
- authoritative gameplay simulation beyond placeholder movement
- reconnect behavior for active matches
- return-to-lobby flow after match end
