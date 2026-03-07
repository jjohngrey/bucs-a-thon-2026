# Gameplay Backend Integration

This is the simple handoff doc for the gameplay person.

## What the server already owns

The backend already simulates:

- horizontal movement
- jump
- gravity
- floor collision
- facing and action state
- one attack input
- melee hit detection
- damage
- knockback
- hitstun
- blast-zone KO detection
- stock decrement
- respawn timer
- respawn invulnerability
- automatic win detection when one player remains
- stage floor, blast zone, spawn points, and respawn settings from shared content
- immediate match termination if a player disconnects mid-match

That means the client gameplay code should not become a second source of truth for match results.

## What the gameplay person should do on the client

Use the same state shape the server sends in `match:snapshot`.

The immediate job on the client side is:

1. render and animate from server snapshot state
2. capture local input cleanly
3. make local presentation feel good
4. keep local prototype rules aligned with backend rules

The client can still do:

- local animation
- local effects
- local anticipation / juice
- temporary visual prediction for the local player

But the server should stay authoritative for:

- damage
- stocks
- KO
- respawn
- final position truth

## Snapshot player shape

Each `match:snapshot.players[]` entry currently includes:

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

Current action values used by the backend:

- `idle`
- `run`
- `jump`
- `fall`
- `attack`
- `hitstun`
- `respawn`
- `ko`

## What to align with the backend

If the gameplay person has local draft logic already, line it up with these backend rules:

- floor Y comes from the shared stage definition
- jump velocity is `-14`
- gravity per tick is `1.2`
- attack damage is `12`
- attack range is `72`
- attack height is `48`
- knockback X is `10`
- knockback Y is `-8`
- stocks start at `3`

The current default stage and rules live in `@bucs/shared`:

- `DEFAULT_STAGE`
- `DEFAULT_MATCH_RULES`

They do not need to hardcode those forever, but they should match them for now so local visuals do not drift from server state.

## What the gameplay person should stop owning

Once the client is wired to backend snapshots, local gameplay code should not decide:

- whether a hit landed
- how much damage was applied
- when a stock was lost
- when a player is KO'd
- when a respawn happens

Those should all come from the server.

## Immediate gameplay task list

1. Build rendering around `match:snapshot.players[]`.
2. Map backend `action` values to animation states.
3. Show damage and stocks from snapshot values only.
4. Show KO / respawn states from snapshot values only.
5. Keep input capture clean for `left`, `right`, `jump`, `attack`, `special`.
6. If local prototype logic still exists, treat it as temporary feel work, not match truth.

## Current backend gap

One important thing is still missing on the server:

- richer character-specific combat timing and stage-specific rules

So for now, the client can still use `match:ended` when the server emits it, but the server does not yet automatically end the match when one player remains.
