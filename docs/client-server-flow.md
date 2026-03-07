# Client-Server Flow

This is the plain-English version of how the client and server talk to each other.

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
- If all checks pass, the server changes the lobby phase to `starting`.
- The server broadcasts:
  - `lobby:state` with the updated phase
  - `match:starting` with the room code, stage ID, player IDs, and countdown
- The client uses that event to move from lobby UI into match-start flow.

## 7. Match begins

- After the host starts the match, the server creates an in-memory match session.
- The server broadcasts `match:starting` with a countdown.
- While countdown is running:
  - lobby phase is `starting`
  - match phase is `countdown`
- After the countdown:
  - lobby phase becomes `in-match`
  - match phase becomes `active`
  - the server broadcasts a fresh `lobby:state`
  - the server emits an initial `match:snapshot`
- while the match is active, the server keeps emitting `match:snapshot` on a tick
- clients can send `match:input`, and the server stores the latest input for each player
- a client can trigger `match:end` to end the current match lifecycle

The live gameplay loop is still the next step:

- clients send `match:input`
- server advances the match from those inputs
- server broadcasts recurring `match:snapshot`
- clients render and reconcile from those snapshots

## 8. If a player leaves or disconnects

- A client can explicitly send `lobby:leave`.
- Or the socket can disconnect unexpectedly.
- In either case, the server removes that player from the lobby.
- If a match session exists for that room, the server removes the in-memory match session too.
- If players remain, the server broadcasts a new `lobby:state`.
- If the lobby becomes empty, the lobby is removed from memory.

## 9. Match end

- When `match:end` is sent for an active room, the server:
  - stops the active match interval
  - removes the in-memory match session
  - updates lobby phase to `finished`
  - broadcasts `lobby:state`
  - broadcasts `match:ended` with the winner summary
- The next client-side step after that should be a results screen and return-to-lobby flow.

## 10. Source of truth

- The client is responsible for UI, rendering, and player input.
- The server is responsible for lobby membership, ready state, and match start validation.
- Shared event names and payload types live in `packages/shared` so the client and server stay in sync.
