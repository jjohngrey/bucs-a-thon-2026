# UI Backend Integration

This doc is for the frontend/UI person.

It explains how to talk to the backend today without digging through the server code.

## Backend URL

- Local server default: `http://127.0.0.1:3001`
- Health check: `GET /health`
- Realtime transport: Socket.IO

## What the UI should do

The UI should:

- open one Socket.IO connection when the game/app loads
- keep track of `playerId`, latest `lobby:state`, latest `match:snapshot`, and any `lobby:error`
- render screens from server state instead of inventing local truth
- treat stocks, KO state, and respawn state as backend-owned data

## Recommended client setup

Import shared event names and payload types from `@bucs/shared` so the client and server stay aligned.

Example:

```ts
import { io } from "socket.io-client";
import { CLIENT_EVENTS, SERVER_EVENTS, type LobbyStatePayload } from "@bucs/shared";

const socket = io("http://127.0.0.1:3001", {
  transports: ["websocket"],
});

socket.on(SERVER_EVENTS.SESSION_JOINED, (payload) => {
  console.log("playerId", payload.playerId);
});

socket.on(SERVER_EVENTS.LOBBY_STATE, (payload: LobbyStatePayload) => {
  console.log("lobby", payload.lobby);
});

socket.on(SERVER_EVENTS.LOBBY_ERROR, (payload) => {
  console.error(payload.code, payload.message);
});
```

## Main screen flow

### 1. Home screen

When the app opens:

- connect socket
- wait for user action

The socket connecting does not automatically put the player in a room.

### 2. Create lobby screen

Send:

```ts
socket.emit(CLIENT_EVENTS.LOBBY_CREATE, {
  displayName: "Jay",
});
```

Expect:

- `session:joined`
- `lobby:state`

Use `lobby:state` to render:

- room code
- player list
- host badge
- ready states

### 3. Join lobby screen

Send:

```ts
socket.emit(CLIENT_EVENTS.LOBBY_JOIN, {
  roomCode: "ABCD",
  displayName: "Jay",
});
```

Expect:

- `session:joined`
- `lobby:state`

If room code is bad, expect:

- `lobby:error`

### 4. Lobby screen

The lobby UI should mostly be driven by `lobby:state`.

Important fields:

- `lobby.roomCode`
- `lobby.phase`
- `lobby.hostPlayerId`
- `lobby.players`
- `lobby.selectedStageId`

Each player entry includes:

- `id`
- `displayName`
- `isHost`
- `isReady`
- `presence`
- `selectedCharacterId`

### 5. Ready button

Send:

```ts
socket.emit(CLIENT_EVENTS.LOBBY_READY, {
  roomCode,
  isReady: true,
});
```

To unready:

```ts
socket.emit(CLIENT_EVENTS.LOBBY_READY, {
  roomCode,
  isReady: false,
});
```

Expect:

- updated `lobby:state`

### 6. Leave lobby button

Send:

```ts
socket.emit(CLIENT_EVENTS.LOBBY_LEAVE, {
  roomCode,
});
```

Expect:

- no special success event
- the server updates the room for remaining players
- your UI should return to the home screen after leaving

### 7. Start match button

Only the host should show this as enabled.

Send:

```ts
socket.emit(CLIENT_EVENTS.MATCH_START, {
  roomCode,
});
```

Expect:

- `lobby:state` with `phase: "starting"`
- `match:starting`

If start is invalid, expect:

- `lobby:error`

Common reasons:

- not enough players
- not all non-host players are ready
- caller is not host

### 8. Countdown / match transition

When `match:starting` arrives, use it to show the pre-match countdown.

Payload includes:

- `roomCode`
- `stageId`
- `playerIds`
- `countdownMs`

After the countdown, expect:

- `lobby:state` with `phase: "in-match"`
- `match:snapshot`

That first snapshot is your signal that the match is active.

### 9. In-match screen

Listen for:

- `match:snapshot`

Current server behavior:

- sends an initial snapshot when the countdown finishes
- keeps sending snapshots on a server tick
- stores player inputs from `match:input`
- applies movement, combat, blast-zone KO, stock loss, and respawn on the server

Send local input like:

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

For now, treat each `match:snapshot` as the source of truth for:

- player positions and velocities
- match phase
- damage and stocks
- KO / out-of-play state
- respawn timer and invulnerability
- respawn platform visuals

Client-side draft systems that should be disabled or removed once the socket snapshot is wired:

- `StockSystem`
- `RespawnSystem`
- local blast-zone KO checks

### 10. Match end

Send:

```ts
socket.emit(CLIENT_EVENTS.MATCH_END, {
  roomCode,
  winnerPlayerId,
  eliminatedPlayerIds,
});
```

Expect:

- `lobby:state` with `phase: "finished"`
- `match:ended`

Use `match:ended` to show results.

### 11. Return to lobby

From the results screen, send:

```ts
socket.emit(CLIENT_EVENTS.LOBBY_RETURN, {
  roomCode,
});
```

Expect:

- `lobby:state` with `phase: "waiting"`
- all players reset to not ready
- selected characters and selected stage cleared

## Events the UI should listen for

### Server to client

- `session:joined`
- `lobby:state`
- `lobby:error`
- `match:starting`
- `match:snapshot`
- `match:ended`

### Client to server

- `lobby:create`
- `lobby:join`
- `lobby:leave`
- `lobby:ready`
- `lobby:return`
- `match:start`
- `match:input`
- `match:end`

## Suggested frontend state

The frontend should keep a small shared store with:

- `socketStatus`
- `playerId`
- `currentLobby`
- `currentMatchSnapshot`
- `lastError`

That is enough for menu flow, lobby flow, and the current match prototype.

`currentMatchSnapshot.players[]` now includes:

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

## Important rule

Do not let the UI become the source of truth for lobby membership, ready state, or match phase.

Always re-render from the latest server event.
