# UI Backend Integration

This is the simple handoff doc for the client/UI person.

## Backend URL

- local server: `http://127.0.0.1:3001`
- health check: `GET /health`
- transport: Socket.IO

## What the backend already does

The server already owns:

- lobby create / join / leave
- ready state
- host start permissions
- match countdown
- live `match:snapshot` updates
- movement, jump, gravity, and floor collision
- attack, damage, knockback, and hitstun
- blast-zone KO detection
- stock decrement
- respawn timer
- respawn invulnerability
- automatic win detection when one player remains
- match end
- return to lobby

The UI should render this state, not simulate it again.

## What the client should store

Keep a small shared state with:

- `playerId`
- latest `lobby:state`
- latest `match:snapshot`
- latest `match:ended`
- latest `lobby:error`

That is enough for the current flow.

## Socket events

Listen for:

- `session:joined`
- `lobby:state`
- `lobby:error`
- `match:starting`
- `match:snapshot`
- `match:ended`

Emit:

- `lobby:create`
- `lobby:join`
- `lobby:leave`
- `lobby:ready`
- `lobby:return`
- `match:start`
- `match:input`
- `match:end`

Import event names and payload types from `@bucs/shared`.

## Screen-by-screen behavior

### Menu

Create lobby:

```ts
socket.emit(CLIENT_EVENTS.LOBBY_CREATE, {
  displayName: "Jay",
});
```

Join lobby:

```ts
socket.emit(CLIENT_EVENTS.LOBBY_JOIN, {
  roomCode: "ABCD",
  displayName: "Jay",
});
```

Expect:

- `session:joined`
- `lobby:state`

### Lobby

Render from `lobby:state`:

- `lobby.roomCode`
- `lobby.phase`
- `lobby.hostPlayerId`
- `lobby.players`
- `lobby.selectedStageId`

Each player includes:

- `id`
- `displayName`
- `isHost`
- `isReady`
- `presence`
- `selectedCharacterId`

Ready:

```ts
socket.emit(CLIENT_EVENTS.LOBBY_READY, {
  roomCode,
  isReady: true,
});
```

Leave:

```ts
socket.emit(CLIENT_EVENTS.LOBBY_LEAVE, {
  roomCode,
});
```

Start match:

```ts
socket.emit(CLIENT_EVENTS.MATCH_START, {
  roomCode,
});
```

Notes:

- only host should start
- current backend requires all non-host players to be ready
- invalid actions return `lobby:error`

### Countdown

`match:starting` includes:

- `roomCode`
- `stageId`
- `playerIds`
- `countdownMs`

Use this to switch from lobby UI to match UI and show the countdown.

### Match

Send local input:

```ts
socket.emit(CLIENT_EVENTS.MATCH_INPUT, {
  roomCode,
  inputFrame: 12,
  pressed: {
    left: false,
    right: true,
    jump: false,
    attack: false,
    special: false,
  },
});
```

Render directly from `match:snapshot`.

Each player in the snapshot includes:

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

Use snapshot state for:

- player positions
- damage %
- stocks
- KO / out-of-play state
- respawn countdown
- respawn platform visuals

### Results

`match:ended` includes:

- `winnerPlayerId`
- `eliminatedPlayerIds`

Use it to render the results screen.

Important:

- the server can emit `match:ended` automatically when only one player has stocks left
- client `match:end` is still available, but it is no longer the only end path

Return to lobby:

```ts
socket.emit(CLIENT_EVENTS.LOBBY_RETURN, {
  roomCode,
});
```

Expect:

- `lobby:state` with `phase: "waiting"`
- players still in the room
- ready states reset
- selected characters reset
- selected stage reset

## What to stop doing on the client

Once snapshots are wired, the client should not be the source of truth for:

- stock decrement
- blast-zone KO checks
- respawn timer
- respawn invulnerability
- respawn platform state

Client draft systems that should be disabled or removed after integration:

- `StockSystem`
- `RespawnSystem`
- local blast-zone KO decisions

## Immediate UI task list

1. Keep one shared Socket.IO connection.
2. Store `playerId` from `session:joined`.
3. Render lobby from `lobby:state`.
4. Switch into match scene from `match:starting`.
5. Render HUD and players from `match:snapshot`.
6. Render results from `match:ended`.
7. Remove local stock / respawn ownership once backend snapshot rendering is working.
