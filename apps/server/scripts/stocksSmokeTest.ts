import { once } from "node:events";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
import {
  CLIENT_EVENTS,
  DEFAULT_MATCH_RULES,
  DEFAULT_STAGE,
  SERVER_EVENTS,
  type LobbyStatePayload,
  type MatchSnapshotPayload,
  type MatchStartingPayload,
  type SessionJoinedPayload,
} from "@bucs/shared";
import { io, type Socket } from "socket.io-client";

const TEST_PORT = 3106;
const SERVER_URL = `http://127.0.0.1:${TEST_PORT}`;
const SERVER_START_TIMEOUT_MS = 5_000;
const EVENT_TIMEOUT_MS = 12_000;

type TestClientState = {
  session?: SessionJoinedPayload;
  lobbies: LobbyStatePayload[];
  matchStarting?: MatchStartingPayload;
  snapshots: MatchSnapshotPayload[];
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

      guestSocket.emit(CLIENT_EVENTS.MATCH_INPUT, {
        roomCode: createdLobby.lobby.roomCode,
        inputFrame: 0,
        pressed: {
          left: false,
          right: true,
          jump: false,
          attack: false,
          kick: false,
          special: false,
        },
      });

      const koSnapshot = await waitForSnapshot(guest, (payload) => {
        const guestPlayer = payload.snapshot.players.find((player) => player.displayName === "Guest");
        return Boolean(guestPlayer && guestPlayer.isOutOfPlay && guestPlayer.stocks === 2);
      });

      const koGuest = koSnapshot.snapshot.players.find((player) => player.displayName === "Guest");
      assert.ok(koGuest);
      assert.equal(koGuest.action, "ko");
      assert.ok(koGuest.respawnTimerMs > 0);
      assert.equal(koGuest.respawnInvulnerabilityMs, 0);

      guestSocket.emit(CLIENT_EVENTS.MATCH_INPUT, {
        roomCode: createdLobby.lobby.roomCode,
        inputFrame: koSnapshot.snapshot.serverFrame,
        pressed: {
          left: false,
          right: false,
          jump: false,
          attack: false,
          kick: false,
          special: false,
        },
      });

      const respawnSnapshot = await waitForSnapshot(guest, (payload) => {
        const guestPlayer = payload.snapshot.players.find((player) => player.displayName === "Guest");
        return Boolean(guestPlayer && !guestPlayer.isOutOfPlay && guestPlayer.stocks === 2 && guestPlayer.respawnInvulnerabilityMs > 0);
      });

      const respawnedGuest = respawnSnapshot.snapshot.players.find((player) => player.displayName === "Guest");
      assert.ok(respawnedGuest);
      assert.equal(respawnedGuest.action, "respawn");
      assert.equal(respawnedGuest.damage, 0);
      assert.equal(respawnedGuest.respawnTimerMs, 0);
      assert.equal(
        respawnedGuest.x,
        (DEFAULT_STAGE.blastZone.minX + DEFAULT_STAGE.blastZone.maxX) / 2,
      );
      assert.equal(
        respawnedGuest.y,
        DEFAULT_STAGE.blastZone.minY + DEFAULT_MATCH_RULES.respawnTopBuffer,
      );
      assert.equal(respawnedGuest.respawnPlatformCenterX, respawnedGuest.x);
      assert.equal(respawnedGuest.respawnPlatformY, respawnedGuest.y);
      assert.equal(
        respawnedGuest.respawnPlatformWidth,
        DEFAULT_MATCH_RULES.respawnPlatformWidth,
      );
      assert.ok(
        respawnedGuest.respawnInvulnerabilityMs <=
          DEFAULT_MATCH_RULES.respawnInvulnerabilityMs,
      );

      console.log("Stocks and respawn smoke test passed.");
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

async function waitForSnapshot(
  state: TestClientState,
  predicate: (payload: MatchSnapshotPayload) => boolean,
) {
  const deadline = Date.now() + EVENT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const match = state.snapshots.findLast(predicate);
    if (match) return match;
    await delay(25);
  }
  throw new Error("Timed out waiting for matching snapshot.");
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
