# Netcode

The current backend uses a server-authoritative Socket.IO model.

That means:

- clients send lobby actions and player inputs
- server owns lobby and match state
- server broadcasts authoritative state back to clients

This is a simple snapshot model, not rollback netcode.

## Current tick model

- server tick rate: `30`
- snapshots: emitted every server tick while match phase is `active`
- input shape: boolean buttons for left, right, jump, attack, special

## Current socket events

### Client to server

- `lobby:create`
- `lobby:join`
- `lobby:leave`
- `lobby:ready`
- `lobby:return`
- `match:select-character`
- `match:select-stage`
- `match:start`
- `match:input`
- `match:end`

### Server to client

- `session:joined`
- `lobby:state`
- `lobby:error`
- `match:starting`
- `match:snapshot`
- `match:ended`
- `player:disconnected`

## Match lifecycle

1. Host sends `match:start`
2. Server validates room, host, player count, and ready state
3. Server creates an in-memory `MatchSession` with phase `countdown`
4. Server emits `match:starting`
5. Countdown finishes
6. Server moves lobby phase to `in-match`
7. Server moves match phase to `active`
8. Server emits an initial `match:snapshot`
9. Server continues emitting snapshots on a fixed interval
10. Clients send `match:input` between snapshots, but only while the latest `lobby:state` is still `phase: "in-match"`
11. If a player leaves during `countdown` or `active`, the server ends the match and emits `match:ended`

## Current match simulation

Each active tick applies:

- horizontal movement
- jump
- gravity
- floor collision
- facing updates
- action-state updates
- attack edge detection
- melee hit detection
- damage
- exponential knockback launch
- hitstun countdown
- blast-zone KO detection
- stock decrement
- out-of-play KO fall
- respawn timer
- respawn invulnerability countdown
- automatic winner detection when one player has stocks left
- stage floor, blast zone, spawn points, and respawn math from shared content

## Snapshot shape

Each `match:snapshot` contains:

- `roomCode`
- `snapshot.serverFrame`
- `snapshot.phase`
- `snapshot.players`

Each player in the snapshot contains:

- `id`
- `displayName`
- `characterId`
- `x`
- `y`
- `vx`
- `vy`
- `grounded`
- `damage`
- `stocks`
- `isOutOfPlay`
- `respawnTimerMs`
- `respawnInvulnerabilityMs`
- `respawnPlatformCenterX`
- `respawnPlatformY`
- `respawnPlatformWidth`
- `facing`
- `action`

## Important gameplay constants

Current shared defaults:

- default stage: `rooftop`
- stocks: `3`
- floor Y: from `DEFAULT_STAGE.floorY`
- jump velocity: `-14`
- gravity per tick: `1.2`
- attack damage: `12`
- attack range: `72`
- attack height: `48`
- knockback X: `10`
- knockback Y: `-8`
- hitstun ticks: `8`
- blast zone: from `DEFAULT_STAGE.blastZone`
- respawn timing/platform: from `DEFAULT_MATCH_RULES`

## Smoke coverage

The server smoke tests currently verify:

- lobby create/join
- match start and countdown
- initial and recurring snapshots
- movement and jump arc
- combat hit, damage, knockback, and hitstun
- blast-zone KO, stock loss, and respawn
- automatic win detection
- active-match disconnect termination
- match end
- return to lobby

## What the client should do

The client should treat snapshots as truth.

For the current prototype:

- render directly from `match:snapshot`
- do not trust client-local positions as final truth
- do not decide match end locally
- use `match:ended` to move into results UI
- stop local input emission and clear local match runtime state on `match:ended` or socket disconnect
