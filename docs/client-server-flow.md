# Client-Server Flow

This is the plain-English version of how the client and server talk to each other today.

## 1. Player opens the game

- The player launches the game client.
- The client loads the menu and prepares to connect to the backend.
- The client opens a Socket.IO connection to the server.

## 2. Socket connects

- The server accepts the socket connection.
- At this point, the server knows the connection by `socket.id`, but the player is not in a lobby yet.
- Nothing game-specific happens until the client sends a lobby action.

## 3. Player creates a lobby

- The player enters a display name and clicks create lobby.
- The client sends `lobby:create` with the display name.
- The server creates:
  - a new room code
  - a new player ID
  - a new lobby
  - a host player entry for that socket
- The server adds that socket to the Socket.IO room for the lobby.
- The server sends `session:joined` back to that client with the new `playerId`.
- The server sends `lobby:state` to everyone in the room.
- The client uses that lobby state to render the lobby screen.

## 4. Player joins a lobby

- A second player enters a display name and room code and clicks join.
- The client sends `lobby:join`.
- The server checks that:
  - the room code exists
  - the socket is not already in a lobby
- The server creates a new player ID for that joining player.
- The server adds the player to the lobby and adds the socket to the room.
- The server sends `session:joined` to the joining client.
- The server broadcasts `lobby:state` to everyone in that lobby.
- All connected clients now re-render from the same shared lobby state.

## 5. Players ready up

- Each player clicks ready in the lobby UI.
- The client sends `lobby:ready` with:
  - `roomCode`
  - `isReady`
- The server verifies that the socket belongs to that room.
- The server updates that player's ready state.
- The server broadcasts a fresh `lobby:state`.
- Every client updates the lobby UI from that server-owned state.

Important detail:

- the current server requires all non-host players to be ready before `match:start`

## 5a. Character and stage selection

- A player can send `match:select-character` with their `characterId`.
- The host can send `match:select-stage` with a `stageId`.
- The server updates `selectedCharacterId` on that player and `selectedStageId` on the lobby.
- The server broadcasts a fresh `lobby:state`.
- The client should render selection UI from that updated lobby state.

## 6. Host starts the match

- Once enough players are present and everyone is ready, the host clicks start.
- The client sends `match:start`.
- The server checks that:
  - the socket belongs to the room
  - the lobby exists
  - the caller is the host
  - there are at least 2 players
  - all players are ready
  - the lobby is in a startable phase
- If any check fails, the server sends `lobby:error`.
- If all checks pass, the server creates an in-memory match session and changes the lobby phase to `starting`.
- The server broadcasts:
  - `lobby:state` with the updated phase
  - `match:starting` with the room code, stage ID, player IDs, and countdown
- The client uses that event to move from lobby UI into match-start flow.

## 7. Match begins

- The server starts a countdown using `match:starting`.
- While countdown is running:
  - lobby phase is `starting`
  - match phase is `countdown`
- After the countdown:
  - lobby phase becomes `in-match`
  - match phase becomes `active`
  - the server broadcasts a fresh `lobby:state`
  - the server emits an initial `match:snapshot`
- while the match is active, the server keeps emitting `match:snapshot` on a `30` ticks/second server loop
- clients can send `match:input`, and the server stores the latest input for each player
- the current backend simulation now applies:
  - horizontal movement
  - jump
  - gravity
  - floor collision
- the current backend combat simulation now applies:
  - one attack input
  - melee hit detection
  - damage
  - exponential knockback launch
  - hitstun
- the current backend stock lifecycle now applies:
  - blast-zone KO detection
  - stock decrement
  - out-of-play KO fall
  - respawn timer
  - respawn invulnerability
  - respawn-platform snapshot fields
- floor, blast zone, spawn points, and respawn rules are now read from shared stage/rules data
- when only one player has stocks left, the server ends the match automatically
- a client can still trigger `match:end` as a fallback path

## 8. If a player leaves or disconnects

- A client can explicitly send `lobby:leave`.
- Or the socket can disconnect unexpectedly.
- In either case, the server removes that player from the lobby.
- The server also emits `player:disconnected` so clients can show a short status message immediately.
- If that room is in `starting` or `in-match`, the server ends the match immediately.
- The remaining players receive `match:ended`.
- The lobby phase moves to `finished`.
- If no live match is active, the server just removes the in-memory match session if one exists.
- If the host leaves but players remain, the first remaining player becomes the new host.
- If players remain, the server broadcasts a new `lobby:state`.
- If the lobby becomes empty, the lobby is removed from memory.

## 9. Match end

- When `match:end` is sent for an active room, or when the server detects one player remaining, the server:
  - stops the active match interval
  - removes the in-memory match session
  - updates lobby phase to `finished`
  - broadcasts `lobby:state`
  - broadcasts `match:ended` with the winner summary
- The client should treat that as the results-screen transition.

## 10. Return to lobby

- After the results screen, the host can send `lobby:return`.
- The server then:
  - keeps the same room and players
  - resets lobby phase to `waiting`
  - resets ready states to `false`
  - clears selected characters
  - clears selected stage
  - broadcasts a fresh `lobby:state`

## 11. Source of truth

- The client is responsible for UI, rendering, and player input.
- The server is responsible for lobby membership, ready state, match lifecycle, and authoritative snapshot state.
- Shared event names and payload types live in `packages/shared` so the client and server stay in sync.
