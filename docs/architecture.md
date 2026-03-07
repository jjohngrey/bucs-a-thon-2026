# Architecture

## Goal

Build a browser-based 2D platform fighter inspired by Smash with:

- online lobbies
- up to 4 players per match
- custom characters based on real people
- fast iteration in a code-first workflow

The project should separate gameplay simulation from lobby/backend concerns. That keeps the core combat loop testable and prevents online code from leaking into every gameplay system.

## Recommended Repo Structure

```text
bucs-a-thon-2026/
  apps/
    game-client/              # Phaser client
      src/
        core/                 # game loop, entity model, collision, utilities
        game/                 # combat rules, player state, attacks, stocks
        scenes/               # menus, lobby, character select, match scene
        network/              # socket client, sync, reconciliation
        ui/                   # HUD and menu UI
        assets/               # sprites, sounds, portraits, stage art
    server/                   # Node + TypeScript backend
      src/
        http/                 # health checks, simple REST endpoints if needed
        sockets/              # socket server, room handlers, match handlers
        lobby/                # lobby lifecycle, invites, room codes
        match/                # authoritative match simulation coordination
        state/                # in-memory room/player state
        storage/              # optional persistence adapters
  packages/
    shared/
      src/
        protocol/             # websocket message types and schemas
        content/              # characters, moves, stages, balance data
        constants/            # tick rate, limits, game constants
        types/                # shared domain types
  docs/
    architecture.md
    stack.md
    netcode.md
    mvp.md
```

## Runtime Architecture

### Client

The Phaser client is responsible for:

- rendering the world and UI
- collecting player input
- local animation and effects
- predicting the local player when possible
- reconciling to server state

The client should not be the source of truth for match results.

### Server

The Node server is responsible for:

- creating and joining lobbies
- tracking connected players
- starting matches
- validating match participation
- running or coordinating the authoritative game state
- broadcasting snapshots and match events

For an MVP, keep state in memory. Add a database only for accounts, history, or cosmetics.

### Shared Package

The shared package prevents protocol drift. Both client and server should import:

- socket event names
- payload types
- content schemas
- game constants

This reduces bugs caused by duplicated interfaces.

## Domain Breakdown

Keep code ownership aligned to these systems:

1. `Lobby`
   - create room
   - join by code
   - leave room
   - ready/unready
   - host starts game
2. `Match Flow`
   - character select
   - stage select
   - countdown
   - match end
   - return to lobby
3. `Combat Simulation`
   - movement
   - jump/fall
   - hitboxes/hurtboxes
   - damage percent
   - knockback
   - stocks and respawn
4. `Content`
   - characters
   - stages
   - attacks
   - balance tuning
5. `Online Sync`
   - input delivery
   - snapshots
   - interpolation
   - reconciliation
   - disconnect/reconnect handling

## Design Rules

- Keep character and stage definitions data-driven.
- Keep simulation logic deterministic where practical.
- Prefer simple rectangles/circles for early hit detection.
- Do not start with rollback netcode.
- Ship 2-player online first, then expand to 4-player once the model is stable.
