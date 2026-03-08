# Server Progress

## Current backend state

The server currently supports:

- HTTP health check at `GET /health`
- Socket.IO connections
- in-memory lobby storage
- `lobby:create`
- `lobby:join`
- `lobby:leave`
- `lobby:ready`
- `lobby:return`
- `match:select-character`
- `match:select-stage`
- `match:start`
- in-memory match session creation
- countdown-driven transition from `starting` to `in-match`
- initial `match:snapshot` emission when the match becomes active
- recurring `match:snapshot` emission for active matches
- in-memory `match:input` storage per player
- basic authoritative movement physics:
  - horizontal movement
  - jump
  - gravity
  - floor collision
  - grounded/facing/action state
- first combat slice:
  - one attack input
  - melee hit detection
  - wider horizontal and tighter vertical melee hitboxes
  - close-range overlap allowance so stacked fighters can still connect
  - damage application
  - sublinear knockback scaling based on accumulated damage
  - flatter punch launch angle so jabs send players sideways more than upward
  - flatter kick launch angle than the default punch
  - hitstun state
- authoritative stock and respawn lifecycle:
  - blast-zone KO detection
  - stock decrement on KO
  - out-of-play KO fall
  - respawn timer
  - respawn invulnerability
  - respawn-platform snapshot data
- automatic win detection when one player has stocks left
- explicit `match:end` handling with `match:ended` broadcast
- active-match departure handling:
  - if a player leaves or disconnects during `starting` or `in-match`
  - the server ends the match immediately
  - the remaining room receives `match:ended`
- cleanup of in-memory match sessions when a room breaks
- shared stage and rules data now drive:
  - floor height
  - blast zone bounds
  - initial spawn points
  - respawn point calculation
  - respawn timing and platform width
  - a taller top blast zone to reduce premature upper KOs
- lobby-side selection flow:
  - each player can set `selectedCharacterId`
  - host can set `selectedStageId`
  - both changes broadcast through `lobby:state`

## Verified commands

Use these commands from the repo root:

```bash
corepack pnpm check
corepack pnpm smoke:lobby
corepack pnpm smoke:match-start
corepack pnpm smoke:combat
corepack pnpm smoke:stocks
corepack pnpm smoke:auto-win
corepack pnpm smoke:match-disconnect
corepack pnpm smoke:match-end
corepack pnpm smoke:return-lobby
```

## What the smoke tests prove

### `smoke:lobby`

- one client can create a lobby
- another client can join it
- both clients receive `lobby:state`
- host can set the stage
- a player can set their selected character

### `smoke:match-start`

- host can start a match
- non-host must ready up first
- both clients receive `match:starting`
- lobby phase moves from `waiting` to `starting`
- after countdown, lobby phase moves to `in-match`
- both clients receive an initial `match:snapshot`
- active matches continue emitting snapshots with increasing server frames
- server snapshots reflect real movement state changes including jump, gravity, and floor landing
- initial spawn positions and starting stocks come from shared stage/rules data

### `smoke:combat`

- a player can move into range and attack
- the target takes damage
- the target is actually launched after the hit
- attacker and target action states reflect attack and hitstun

### `smoke:stocks`

- a player can cross the blast zone and lose a stock
- the server marks the player as out of play
- the server starts a respawn timer
- the server respawns the player with invulnerability and respawn-platform data
- respawn position and platform width come from shared stage/rules data

### `smoke:auto-win`

- repeated KOs can eliminate a player entirely
- the server detects the last player with stocks left
- the server emits `match:ended` automatically
- lobby phase moves to `finished` without client `match:end`

### `smoke:match-disconnect`

- a player can disconnect during an active match
- the server ends the match immediately
- the remaining player receives `match:ended`
- lobby phase moves to `finished`

### `smoke:match-end`

- an active match can be ended explicitly
- both clients receive `match:ended`
- lobby phase moves to `finished`
- the active in-memory match loop is cleaned up

### `smoke:return-lobby`

- after results, the host can reset the room
- lobby phase moves from `finished` back to `waiting`
- ready states reset to `false`
- selected characters and selected stage are cleared

## Not done yet

- reconnect behavior for active matches
- full character/stage-specific simulation
