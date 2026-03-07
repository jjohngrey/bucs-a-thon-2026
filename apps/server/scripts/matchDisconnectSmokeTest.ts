import { once } from "node:events";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  type LobbyStatePayload,
  type MatchEndedPayload,
  type MatchSnapshotPayload,
  type MatchStartingPayload,
  type SessionJoinedPayload,
} from "@bucs/shared";
import { io, type Socket } from "socket.io-client";

const TEST_PORT = 3108;
const SERVER_URL = `http://127.0.0.1:${TEST_PORT}`;
const SERVER_START_TIMEOUT_MS = 5_000;
const EVENT_TIMEOUT_MS = 8_000;

type TestClientState = {
  session?: SessionJoinedPayload;
  lobbies: LobbyStatePayload[];
  matchStarting?: MatchStartingPayload;
  snapshots: MatchSnapshotPayload[];
  matchEnded?: MatchEndedPayload;
};

async function main() {
  const server = spawn("node", ["dist/index.js"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, PORT: String(TEST_PORT), HOST: "127.0.0.1" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let serverOutput = "";
  server.stdout.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });

  try {
    await waitForServer(() => serverOutput);

    const host = createClientState();
    const guest = createClientState();
    const hostSocket = io(SERVER_URL, { transports: ["websocket"], forceNew: true });
    const guestSocket = io(SERVER_URL, { transports: ["websocket"], forceNew: true });

    try {
      attachObservers(hostSocket, host);
      attachObservers(guestSocket, guest);

      await Promise.all([waitForConnect(hostSocket), waitForConnect(guestSocket)]);

      hostSocket.emit(CLIENT_EVENTS.LOBBY_CREATE, { displayName: "Host" });
      const [, createdLobby] = await Promise.all([
        waitForSessionJoined(hostSocket, host),
        waitForLobbyWithPlayers(host, 1),
      ]);

      guestSocket.emit(CLIENT_EVENTS.LOBBY_JOIN, {
        roomCode: createdLobby.lobby.roomCode,
        displayName: "Guest",
      });

      await Promise.all([
        waitForSessionJoined(guestSocket, guest),
        waitForLobbyWithPlayers(host, 2),
        waitForLobbyWithPlayers(guest, 2),
      ]);

      guestSocket.emit(CLIENT_EVENTS.LOBBY_READY, {
        roomCode: createdLobby.lobby.roomCode,
        isReady: true,
      });

      await Promise.all([waitForReadyCount(host, 1), waitForReadyCount(guest, 1)]);

      hostSocket.emit(CLIENT_EVENTS.MATCH_START, { roomCode: createdLobby.lobby.roomCode });

      await Promise.all([
        waitForMatchStarting(hostSocket, host),
        waitForMatchStarting(guestSocket, guest),
        waitForLobbyPhase(host, "in-match"),
        waitForSnapshotCount(host, 1),
      ]);

      const hostPlayerId = host.session?.playerId;
      const guestPlayerId = guest.session?.playerId;
      assert.ok(hostPlayerId);
      assert.ok(guestPlayerId);

      guestSocket.disconnect();

      const [hostEnded, hostFinishedLobby] = await Promise.all([
        waitForMatchEnded(hostSocket, host),
        waitForLobbyPhase(host, "finished"),
      ]);

      assert.equal(hostEnded.roomCode, createdLobby.lobby.roomCode);
      assert.equal(hostEnded.summary.winnerPlayerId, hostPlayerId);
      assert.deepEqual(hostEnded.summary.eliminatedPlayerIds, [guestPlayerId]);
      assert.equal(hostFinishedLobby.lobby.phase, "finished");
      assert.equal(hostFinishedLobby.lobby.players.length, 1);
      assert.equal(hostFinishedLobby.lobby.players[0]?.id, hostPlayerId);

      console.log("Match-disconnect smoke test passed.");
      console.log(`Room code: ${createdLobby.lobby.roomCode}`);
    } finally {
      hostSocket.disconnect();
      guestSocket.disconnect();
    }
  } finally {
    server.kill("SIGTERM");
    await once(server, "exit");
  }
}

function createClientState(): TestClientState {
  return { lobbies: [], snapshots: [] };
}

function attachObservers(socket: Socket, state: TestClientState) {
  socket.on(SERVER_EVENTS.SESSION_JOINED, (payload: SessionJoinedPayload) => {
    state.session = payload;
  });
  socket.on(SERVER_EVENTS.LOBBY_STATE, (payload: LobbyStatePayload) => {
    state.lobbies.push(payload);
  });
  socket.on(SERVER_EVENTS.MATCH_STARTING, (payload: MatchStartingPayload) => {
    state.matchStarting = payload;
  });
  socket.on(SERVER_EVENTS.MATCH_SNAPSHOT, (payload: MatchSnapshotPayload) => {
    state.snapshots.push(payload);
  });
  socket.on(SERVER_EVENTS.MATCH_ENDED, (payload: MatchEndedPayload) => {
    state.matchEnded = payload;
  });
}

async function waitForServer(readOutput: () => string) {
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (readOutput().includes("[server] listening")) return;
    await delay(50);
  }
  throw new Error(`Server did not start in time.\n${readOutput()}`);
}

async function waitForConnect(socket: Socket) {
  if (socket.connected) return;
  await onceWithTimeout(socket, "connect");
}

async function waitForSessionJoined(socket: Socket, state: TestClientState) {
  if (state.session) return state.session;
  await onceWithTimeout(socket, SERVER_EVENTS.SESSION_JOINED);
  assert.ok(state.session);
  return state.session;
}

async function waitForLobbyWithPlayers(state: TestClientState, playerCount: number) {
  return waitForLobby(state, (payload) => payload.lobby.players.length === playerCount);
}

async function waitForReadyCount(state: TestClientState, readyCount: number) {
  return waitForLobby(
    state,
    (payload) => payload.lobby.players.filter((player) => player.isReady).length === readyCount,
  );
}

async function waitForLobbyPhase(
  state: TestClientState,
  phase: LobbyStatePayload["lobby"]["phase"],
) {
  return waitForLobby(state, (payload) => payload.lobby.phase === phase);
}

async function waitForLobby(
  state: TestClientState,
  predicate: (payload: LobbyStatePayload) => boolean,
) {
  const deadline = Date.now() + EVENT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const match = state.lobbies.findLast(predicate);
    if (match) return match;
    await delay(25);
  }
  throw new Error("Timed out waiting for matching lobby state.");
}

async function waitForMatchStarting(socket: Socket, state: TestClientState) {
  if (state.matchStarting) return state.matchStarting;
  await onceWithTimeout(socket, SERVER_EVENTS.MATCH_STARTING);
  assert.ok(state.matchStarting);
  return state.matchStarting;
}

async function waitForSnapshotCount(state: TestClientState, count: number) {
  const deadline = Date.now() + EVENT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (state.snapshots.length >= count) return state.snapshots;
    await delay(25);
  }
  throw new Error(`Timed out waiting for ${count} match:snapshot payloads.`);
}

async function waitForMatchEnded(socket: Socket, state: TestClientState) {
  if (state.matchEnded) return state.matchEnded;
  await onceWithTimeout(socket, SERVER_EVENTS.MATCH_ENDED);
  assert.ok(state.matchEnded);
  return state.matchEnded;
}

async function onceWithTimeout(socket: Socket, eventName: string, timeoutMs = EVENT_TIMEOUT_MS) {
  return Promise.race([
    once(socket, eventName),
    delay(timeoutMs).then(() => {
      throw new Error(`Timed out waiting for "${eventName}".`);
    }),
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
