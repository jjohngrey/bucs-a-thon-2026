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

const TEST_PORT = 3102;
const SERVER_URL = `http://127.0.0.1:${TEST_PORT}`;
const SERVER_START_TIMEOUT_MS = 5_000;
const EVENT_TIMEOUT_MS = 5_000;
const FLOOR_Y = DEFAULT_STAGE.floorY;

type TestClientState = {
  session?: SessionJoinedPayload;
  lobbies: LobbyStatePayload[];
  matchStarting?: MatchStartingPayload;
  snapshots: MatchSnapshotPayload[];
};

async function main() {
  const server = spawn("node", ["dist/index.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      HOST: "127.0.0.1",
    },
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

      await Promise.all([
        waitForReadyCount(host, 1),
        waitForReadyCount(guest, 1),
      ]);

      hostSocket.emit(CLIENT_EVENTS.MATCH_START, {
        roomCode: createdLobby.lobby.roomCode,
      });

      const [hostStartingLobby, guestStartingLobby, hostMatch, guestMatch] = await Promise.all([
        waitForLobbyPhase(host, "starting"),
        waitForLobbyPhase(guest, "starting"),
        waitForMatchStarting(hostSocket, host),
        waitForMatchStarting(guestSocket, guest),
      ]);

      assert.equal(hostStartingLobby.lobby.roomCode, createdLobby.lobby.roomCode);
      assert.equal(guestStartingLobby.lobby.roomCode, createdLobby.lobby.roomCode);
      assert.equal(hostStartingLobby.lobby.phase, "starting");
      assert.equal(guestStartingLobby.lobby.phase, "starting");
      assert.equal(hostMatch.roomCode, createdLobby.lobby.roomCode);
      assert.equal(guestMatch.roomCode, createdLobby.lobby.roomCode);
      assert.equal(hostMatch.stageId, guestMatch.stageId);
      assert.equal(hostMatch.countdownMs, 3000);
      assert.equal(hostMatch.playerIds.length, 2);
      assert.deepEqual([...hostMatch.playerIds].sort(), [...guestMatch.playerIds].sort());

      const [hostInMatchLobby, guestInMatchLobby] = await Promise.all([
        waitForLobbyPhase(host, "in-match"),
        waitForLobbyPhase(guest, "in-match"),
      ]);

      const [hostInitialSnapshots, guestInitialSnapshots] = await Promise.all([
        waitForSnapshotCount(hostSocket, host, 1),
        waitForSnapshotCount(guestSocket, guest, 1),
      ]);
      const hostSnapshot = hostInitialSnapshots.at(-1);
      const guestSnapshot = guestInitialSnapshots.at(-1);

      assert.equal(hostInMatchLobby.lobby.roomCode, createdLobby.lobby.roomCode);
      assert.equal(guestInMatchLobby.lobby.roomCode, createdLobby.lobby.roomCode);
      assert.equal(hostInMatchLobby.lobby.phase, "in-match");
      assert.equal(guestInMatchLobby.lobby.phase, "in-match");
      assert.ok(hostSnapshot);
      assert.ok(guestSnapshot);
      assert.equal(hostSnapshot.roomCode, createdLobby.lobby.roomCode);
      assert.equal(guestSnapshot.roomCode, createdLobby.lobby.roomCode);
      assert.equal(hostSnapshot.snapshot.phase, "active");
      assert.equal(guestSnapshot.snapshot.phase, "active");
      assert.equal(hostSnapshot.snapshot.serverFrame, 0);
      assert.equal(hostSnapshot.snapshot.players.length, 2);
      assert.equal(guestSnapshot.snapshot.players.length, 2);
      assert.equal(hostSnapshot.snapshot.players[0]?.x, DEFAULT_STAGE.spawnPoints[0]?.x);
      assert.equal(hostSnapshot.snapshot.players[0]?.y, DEFAULT_STAGE.spawnPoints[0]?.y);
      assert.equal(hostSnapshot.snapshot.players[1]?.x, DEFAULT_STAGE.spawnPoints[1]?.x);
      assert.equal(hostSnapshot.snapshot.players[1]?.y, DEFAULT_STAGE.spawnPoints[1]?.y);
      assert.equal(hostSnapshot.snapshot.players[0]?.damage, 0);
      assert.equal(hostSnapshot.snapshot.players[0]?.stocks, DEFAULT_MATCH_RULES.startingStocks);
      assert.equal(hostSnapshot.snapshot.players[0]?.grounded, true);

      hostSocket.emit(CLIENT_EVENTS.MATCH_INPUT, {
        roomCode: createdLobby.lobby.roomCode,
        inputFrame: hostSnapshot.snapshot.serverFrame,
        pressed: {
          left: false,
          right: true,
          jump: false,
          attack: false,
          kick: false,
          special: false,
        },
      });

      const [hostSnapshots, guestSnapshots] = await Promise.all([
        waitForSnapshotCount(hostSocket, host, 3),
        waitForSnapshotCount(guestSocket, guest, 3),
      ]);

      const hostLatestSnapshot = hostSnapshots.at(-1);
      const guestLatestSnapshot = guestSnapshots.at(-1);
      assert.ok(hostLatestSnapshot);
      assert.ok(guestLatestSnapshot);
      assert.ok(hostLatestSnapshot.snapshot.serverFrame >= 2);
      assert.ok(guestLatestSnapshot.snapshot.serverFrame >= 2);
      assert.ok(hostLatestSnapshot.snapshot.players[0]?.x !== hostSnapshot.snapshot.players[0]?.x);
      assert.equal(hostLatestSnapshot.snapshot.players[0]?.grounded, true);
      assert.equal(hostLatestSnapshot.snapshot.players[0]?.action, "run");

      hostSocket.emit(CLIENT_EVENTS.MATCH_INPUT, {
        roomCode: createdLobby.lobby.roomCode,
        inputFrame: hostLatestSnapshot.snapshot.serverFrame,
        pressed: {
          left: false,
          right: false,
          jump: true,
          attack: false,
          kick: false,
          special: false,
        },
      });

      const jumpSnapshots = await waitForJumpArc(host, hostLatestSnapshot.snapshot.serverFrame);
      const airborneSnapshot = jumpSnapshots.find(
        (payload) => payload.snapshot.players[0]?.grounded === false,
      );
      const landingSnapshot = jumpSnapshots.findLast(
        (payload) =>
          payload.snapshot.serverFrame > hostLatestSnapshot.snapshot.serverFrame &&
          payload.snapshot.players[0]?.grounded === true,
      );

      assert.ok(airborneSnapshot);
      assert.ok(landingSnapshot);
      assert.ok((airborneSnapshot.snapshot.players[0]?.y ?? FLOOR_Y) < FLOOR_Y);
      assert.ok((airborneSnapshot.snapshot.players[0]?.vy ?? 0) < 0);
      assert.equal(airborneSnapshot.snapshot.players[0]?.action, "jump");
      assert.equal(landingSnapshot.snapshot.players[0]?.y, FLOOR_Y);
      assert.equal(landingSnapshot.snapshot.players[0]?.grounded, true);

      console.log("Match-start movement physics smoke test passed.");
      console.log(`Room code: ${hostMatch.roomCode}`);
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
    if (readOutput().includes("[server] listening")) {
      return;
    }

    await delay(50);
  }

  throw new Error(`Server did not start in time.\n${readOutput()}`);
}

async function waitForConnect(socket: Socket) {
  if (socket.connected) {
    return;
  }

  await onceWithTimeout(socket, "connect");
}

async function waitForSessionJoined(socket: Socket, state: TestClientState) {
  if (state.session) {
    return state.session;
  }

  await onceWithTimeout(socket, SERVER_EVENTS.SESSION_JOINED);
  assert.ok(state.session, "Expected session:joined payload.");
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
    if (match) {
      return match;
    }

    await delay(25);
  }

  throw new Error("Timed out waiting for matching lobby state.");
}

async function waitForMatchStarting(socket: Socket, state: TestClientState) {
  if (state.matchStarting) {
    return state.matchStarting;
  }

  await onceWithTimeout(socket, SERVER_EVENTS.MATCH_STARTING);
  assert.ok(state.matchStarting, "Expected match:starting payload.");
  return state.matchStarting;
}

async function waitForSnapshotCount(socket: Socket, state: TestClientState, count: number) {
  const deadline = Date.now() + EVENT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (state.snapshots.length >= count) {
      return state.snapshots;
    }

    await onceWithTimeout(socket, SERVER_EVENTS.MATCH_SNAPSHOT, 1000);
  }

  throw new Error(`Timed out waiting for ${count} match:snapshot payloads.`);
}

async function waitForJumpArc(state: TestClientState, startingFrame: number) {
  const deadline = Date.now() + EVENT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const relevant = state.snapshots.filter((payload) => payload.snapshot.serverFrame > startingFrame);
    const hasAirborne = relevant.some((payload) => payload.snapshot.players[0]?.grounded === false);
    const hasLanding = relevant.some((payload) => payload.snapshot.players[0]?.grounded === true);

    if (hasAirborne && hasLanding) {
      return relevant;
    }

    await delay(25);
  }

  throw new Error("Timed out waiting for jump arc snapshots.");
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
