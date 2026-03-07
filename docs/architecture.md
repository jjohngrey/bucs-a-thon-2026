# Architecture

This repo is a small pnpm workspace with one real backend, one shared contract package, and an early Phaser client scaffold.

## Current repo layout

```text
bucs-a-thon-2026/
  apps/
    game-client/   # Vite + Phaser scaffold
    server/        # Node + TypeScript Socket.IO backend
  packages/
    shared/        # shared event names, payloads, types, constants
  docs/
```

## What exists today

### `apps/server`

The server is the authoritative source of truth for:

- lobby membership
- ready state
- host permissions
- match lifecycle
- live match snapshots
- simple movement and combat simulation
- stock, KO, and respawn lifecycle
- match end and return-to-lobby flow

Code is organized like this:

- `src/http`: HTTP app and `/health`
- `src/sockets`: Socket.IO bootstrap and handlers
- `src/lobby`: lobby lifecycle and in-memory lobby/session storage
- `src/match`: match lifecycle, snapshot loop, and in-memory match runtime state

### `packages/shared`

The shared package contains:

- client-to-server payload types
- server-to-client payload types
- socket event constants
- lobby, match, and player types
- gameplay and network constants

Both client and server should import from here instead of duplicating protocol definitions.

### `apps/game-client`

The client package exists, but it is still mostly a scaffold. The backend is currently ahead of the UI.

## Runtime model

### Client responsibilities

The client should:

- connect with Socket.IO
- render screens and HUD
- collect player input
- send lobby and match actions
- render from `lobby:state`, `match:starting`, `match:snapshot`, and `match:ended`

### Server responsibilities

The server currently:

- creates and joins lobbies
- assigns `playerId`
- broadcasts `lobby:state`
- validates match start
- creates in-memory match sessions
- activates matches after a countdown
- emits recurring authoritative snapshots
- stores player input
- advances simple movement/combat state
- advances KO, stock, and respawn state
- ends matches and resets lobbies

## Current flow summary

The happy path today is:

1. client connects
2. create or join lobby
3. ready up
4. host starts match
5. server emits `match:starting`
6. countdown ends
7. server emits `match:snapshot` on a tick
8. clients send `match:input`
9. host or client ends the match with `match:end`
10. host returns room with `lobby:return`

## Current limitations

- no persistence or database
- no reconnect support
- no real character-select or stage-select flow yet
- no automatic winner detection from stocks yet
- client integration is still catching up to the backend
