# UI / Game Handoff

This is the simple guide for the UI person and gameplay person.

## What The Server Already Does

The backend already supports:

- creating and joining lobbies
- readying up in the lobby
- starting a match
- countdown from `starting` to `in-match`
- sending live `match:snapshot` updates
- ending a match with `match:ended`

That means the frontend team should stop waiting on backend basics and start integrating.

## What The UI Person Should Build

Build these screens in order:

1. `Menu`
- display name input
- create lobby button
- join lobby button
- room code input

2. `Lobby`
- room code
- player list
- host badge
- ready state
- ready/unready button
- start match button for host

3. `Match`
- countdown UI from `match:starting`
- HUD from `match:snapshot`
- player cards / percents / stocks

4. `Results`
- winner display from `match:ended`
- eliminated players list

## What The Gameplay Person Should Build

Build local gameplay against the same state shape the server sends.

Focus on:

- player movement
- jump / fall
- attacks
- damage
- knockback
- stocks

The important point:

- use the server snapshot shape as the target model
- do not invent a totally different player state model on the client

## Socket Events To Use

Client should emit:

- `lobby:create`
- `lobby:join`
- `lobby:leave`
- `lobby:ready`
- `match:start`
- `match:input`
- `match:end`

Client should listen for:

- `session:joined`
- `lobby:state`
- `lobby:error`
- `match:starting`
- `match:snapshot`
- `match:ended`

## What Each Event Means

### `session:joined`

The server gives the client its `playerId`.

Store this locally. The UI will need it to know:

- who the local player is
- whether the local player is host
- which player card to highlight

### `lobby:state`

This is the source of truth for:

- players in the room
- ready states
- host
- lobby phase

Do not keep your own separate lobby truth if the server already sent one.

### `match:starting`

Use this to:

- switch from lobby scene to match scene
- show countdown
- preload HUD/player panels

### `match:snapshot`

Use this to render the active match.

Current snapshot contains:

- `serverFrame`
- `phase`
- `players[]`

Each player currently has:

- `id`
- `displayName`
- `characterId`
- `x`
- `y`
- `vx`
- `vy`
- `damage`
- `stocks`
- `facing`
- `action`

### `match:ended`

Use this to show the results screen.

Current summary contains:

- `winnerPlayerId`
- `eliminatedPlayerIds`

## What To Fake / Stub For Now

Until gameplay is fully integrated, it is fine to:

- render players as colored boxes
- render placeholder character portraits
- render damage/stocks from server snapshot only
- use a very simple results screen

Do not block on art.

## Recommended Frontend File Ownership

UI person:

- `apps/game-client/src/scenes/MenuScene.ts`
- `apps/game-client/src/scenes/LobbyScene.ts`
- `apps/game-client/src/scenes/MatchScene.ts`
- `apps/game-client/src/scenes/ResultsScene.ts`
- `apps/game-client/src/network/client.ts`
- `apps/game-client/src/ui/*`

Gameplay person:

- `apps/game-client/src/game/*`
- `apps/game-client/src/core/*`

## Simple Frontend Flow

1. Connect socket
2. Create or join lobby
3. Render `lobby:state`
4. Host starts match
5. Show countdown from `match:starting`
6. Render live updates from `match:snapshot`
7. Show results from `match:ended`

## Important Rule

The server is the truth for:

- lobby membership
- ready state
- match phase
- snapshot state
- match end summary

The client is the truth for:

- rendering
- local input capture
- scene transitions and UI presentation

## If You Are Blocked

Read these next:

- `docs/client-server-flow.md`
- `docs/server-progress.md`
- `packages/shared/src/protocol/*`
- `packages/shared/src/types/*`
