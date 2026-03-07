# Netcode

## Netcode Strategy

Start with a server-authoritative model.

That means:

- clients send input
- server owns the official match state
- server sends snapshots/events back to clients

This is not full rollback netcode. It is simpler, easier to reason about, and much more realistic for an early build.

## Why Not Rollback First

Rollback is powerful but expensive. It requires:

- highly deterministic simulation
- input buffering
- re-simulation
- prediction error handling
- careful debugging tools

If the team has never implemented rollback, it will likely consume the project.

## Match Tick Model

Suggested starting point:

- server tick rate: `20-30` ticks per second
- render frame rate: browser-native via Phaser
- client input send rate: every tick or on input change
- snapshot broadcast: every server tick or every 2 ticks

The client should interpolate remote players between snapshots to hide jitter.

## Data Flow

### Lobby Phase

1. client connects
2. player creates or joins room
3. server assigns room state
4. players ready up
5. host starts match

### Match Phase

1. each client sends input frames
2. server advances simulation
3. server emits authoritative snapshot
4. clients reconcile visible state
5. server emits end-of-match event when a winner is decided

## Suggested Socket Events

### Client to Server

- `lobby:create`
- `lobby:join`
- `lobby:leave`
- `lobby:ready`
- `match:select-character`
- `match:select-stage`
- `match:start`
- `match:input`
- `match:ack-snapshot`

### Server to Client

- `session:joined`
- `lobby:state`
- `lobby:error`
- `match:starting`
- `match:snapshot`
- `match:event`
- `match:ended`
- `player:disconnected`

## Example Shared Protocol Shape

```ts
export type PlayerInputPayload = {
  playerId: string;
  inputFrame: number;
  pressed: {
    left: boolean;
    right: boolean;
    jump: boolean;
    attack: boolean;
    special: boolean;
  };
};

export type MatchSnapshotPayload = {
  serverFrame: number;
  players: Array<{
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    damage: number;
    stocks: number;
    facing: "left" | "right";
    state: string;
  }>;
};
```

## Reconciliation Rules

- The local client keeps a small history of sent inputs.
- When a snapshot arrives, the client corrects to authoritative state.
- If prediction is used, the client replays local unconfirmed inputs after correction.

Keep this implementation minimal at first. Hard snaps are acceptable during the earliest prototype if they unblock the team.

## 4-Player Constraint

Four players increase:

- collision combinations
- bandwidth
- state size
- visual chaos

Build for 2-player online first. Expand to 4 players after:

- the protocol is stable
- the simulation is fair
- the client can render and reconcile cleanly

## Anti-Cheat Baseline

For MVP:

- never trust client-reported damage or kills
- never trust client-reported position as final truth
- trust only player inputs and lobby actions

That alone prevents the worst class of multiplayer exploits.
