# Execution Plan

## Objective

Get from an empty repo to a playable online 2-player platform-fighter MVP, then expand to 4 players only after the loop is stable.

## Team Roles

Use these four lanes.

### Member 1: Gameplay

Owns:

- player movement
- jump/fall tuning
- attacks
- hitboxes/hurtboxes
- damage and knockback
- stocks, respawn, win condition

Primary folders:

- `apps/game-client/src/game`
- `apps/game-client/src/core`
- `apps/server/src/simulation`

### Member 2: Networking/Backend

Owns:

- Socket.IO server
- lobby lifecycle
- room codes
- ready state
- match session lifecycle
- input ingestion and snapshot emission

Primary folders:

- `apps/server/src/sockets`
- `apps/server/src/lobby`
- `apps/server/src/match`
- `packages/shared/src/protocol`

### Member 3: Client/UI

Owns:

- Phaser boot setup
- scenes
- menus
- lobby UI
- character select
- match HUD
- results screen

Primary folders:

- `apps/game-client/src/scenes`
- `apps/game-client/src/ui`
- `apps/game-client/src/boot`
- `apps/game-client/src/network`

### Member 4: Content/Design

Owns:

- character definitions
- stage data
- placeholder art
- portraits
- sounds
- tuning data

Primary folders:

- `apps/game-client/src/content`
- `apps/game-client/src/assets`
- `packages/shared/src/content`

## Phase Plan

### Phase 0: Setup

Goal:

- monorepo exists
- TypeScript builds
- client and server can both start

Tasks:

1. Create workspace config.
2. Create `game-client`, `server`, and `shared` packages.
3. Add base TypeScript configs.
4. Add Phaser boot screen.
5. Add Node server with a health endpoint and socket connection log.

Definition of done:

- one command starts client
- one command starts server
- browser can connect to server successfully

### Phase 1: Offline Combat

Goal:

- one local scene with two test fighters

Tasks:

1. Add movement system.
2. Add gravity/jump/fall.
3. Add one stage collision surface.
4. Add one attack with hitbox overlap.
5. Add damage and knockback.
6. Add stocks and respawn.

Definition of done:

- two players can finish a local match on one machine

### Phase 2: Lobby and Match Flow

Goal:

- players can gather before the match

Tasks:

1. Add create room and join by code.
2. Add lobby state broadcast.
3. Add ready/unready.
4. Add character select payload.
5. Add host start match event.
6. Transition both clients into the match scene.

Definition of done:

- two browser clients can join the same lobby and begin a synchronized match

### Phase 3: Online Match

Goal:

- remote players can play a full match

Tasks:

1. Client sends input frames.
2. Server runs authoritative tick loop.
3. Server sends snapshots.
4. Client buffers and applies snapshots.
5. Client reconciles local state to server truth.
6. Add disconnect behavior and match abort/end handling.

Definition of done:

- two remote players can complete a match without game-breaking desync

### Phase 4: Stabilization

Goal:

- reduce jank and make the game demo-ready

Tasks:

1. Add interpolation for remote players.
2. Tighten attack feel and knockback tuning.
3. Add at least one more character.
4. Improve HUD and results flow.
5. Fix edge-case crashes and state mismatches.

Definition of done:

- external testers can play without developer intervention

## Parallel Work Plan

These are the first tasks each member can start immediately without blocking everyone else.

### Member 1 can start now

- define `PlayerState` and `MatchState`
- implement movement, gravity, jump, and landing rules
- implement basic attack hitbox detection
- implement damage and knockback functions

### Member 2 can start now

- bootstrap Node server
- stand up Socket.IO connection handling
- implement room code generation
- implement create/join/leave lobby handlers
- define shared socket event names and payloads

### Member 3 can start now

- bootstrap Phaser app with scene switching
- create Menu, Lobby, Match, and Results scenes
- build a temporary HUD with damage and stocks
- wire a socket client wrapper for scene-level usage

### Member 4 can start now

- draft first 2 characters as JSON
- define stat ranges for speed, jump, weight, and attack power
- create one simple stage layout file
- create placeholder portraits and fighter color schemes

## Integration Rules

- Merge shared protocol changes first before client/server handler work.
- Do not invent socket event names in feature branches.
- Do not put game truth inside UI scenes.
- Do not let the client become authoritative for damage, kills, or winner state.
- Use placeholder art until the combat loop is stable.

## Daily Team Cadence

Each day:

1. 10-minute standup
2. one designated integration owner
3. one shared test session in the afternoon

Standup format:

- what I finished
- what I am doing next
- what is blocked

Integration owner responsibilities:

- pull everyone’s latest branch
- resolve type/protocol conflicts early
- run client and server together
- post known breakages in one team channel/message

## Branch Strategy

- `main`: always runnable
- feature branches: one focused task each

Suggested branch names:

- `feat/phaser-bootstrap`
- `feat/lobby-room-codes`
- `feat/match-snapshots`
- `feat/player-movement`
- `feat/character-select`

## First 12 Tickets

1. Set up `pnpm` workspace and root TypeScript config.
2. Bootstrap Phaser client app.
3. Bootstrap Node server app.
4. Add shared package exports and event names.
5. Create `BootScene` and `MenuScene`.
6. Implement socket connection from client to server.
7. Implement room code generation and in-memory lobby store.
8. Build `LobbyScene` with player list and ready toggle.
9. Implement player movement and gravity.
10. Implement basic attack hitbox and damage.
11. Add stock and respawn rules.
12. Add server snapshot loop and client snapshot consumption.

## What To Do Tomorrow

If the team is starting cold, tomorrow should look like this:

1. Member 2 creates the monorepo and server/shared package skeleton.
2. Member 3 boots Phaser and scene switching.
3. Member 1 builds a rectangle-based player controller in a local scene.
4. Member 4 writes two character JSON files and one stage JSON file.
5. Before the day ends, integrate all four into one branch and verify nothing drifted.
