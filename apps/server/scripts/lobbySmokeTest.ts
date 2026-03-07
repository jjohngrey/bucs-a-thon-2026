import { once } from "node:events";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  type LobbyStatePayload,
  type SessionJoinedPayload,
} from "@bucs/shared";
import { io, type Socket } from "socket.io-client";

const TEST_PORT = 3101;
const SERVER_URL = `http://127.0.0.1:${TEST_PORT}`;
const SERVER_START_TIMEOUT_MS = 5_000;
const EVENT_TIMEOUT_MS = 5_000;

type TestClientState = {
  session?: SessionJoinedPayload;
  lobbies: LobbyStatePayload[];
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
    await waitForServer(serverOutputRef(() => serverOutput));

    const host = createClientState();
    const guest = createClientState();

    const hostSocket = io(SERVER_URL, {
      transports: ["websocket"],
      forceNew: true,
    });
    const guestSocket = io(SERVER_URL, {
      transports: ["websocket"],
      forceNew: true,
    });

    try {
      attachObservers(hostSocket, host);
      attachObservers(guestSocket, guest);

      await Promise.all([waitForConnect(hostSocket), waitForConnect(guestSocket)]);
      hostSocket.emit(CLIENT_EVENTS.LOBBY_CREATE, {
        displayName: "Host",
      });

      const [hostSession, createdLobby] = await Promise.all([
        waitForSessionJoined(hostSocket, host),
        waitForLobbyWithPlayers(host, 1),
      ]);
      assert.ok(hostSession.playerId);
      assert.equal(createdLobby.lobby.players.length, 1);
      assert.equal(createdLobby.lobby.players[0]?.displayName, "Host");

      guestSocket.emit(CLIENT_EVENTS.LOBBY_JOIN, {
        roomCode: createdLobby.lobby.roomCode,
        displayName: "Guest",
      });

      const [guestSession, hostLobby, guestLobby] = await Promise.all([
        waitForSessionJoined(guestSocket, guest),
        waitForLobbyWithPlayers(host, 2),
        waitForLobbyWithPlayers(guest, 2),
      ]);

      assert.ok(guestSession.playerId);
      assert.equal(hostLobby.lobby.roomCode, createdLobby.lobby.roomCode);
      assert.equal(guestLobby.lobby.roomCode, createdLobby.lobby.roomCode);
      assert.equal(hostLobby.lobby.players.length, 2);
      assert.equal(guestLobby.lobby.players.length, 2);

      const playerNames = hostLobby.lobby.players
        .map((player) => player.displayName)
        .sort();
      assert.deepEqual(playerNames, ["Guest", "Host"]);

      console.log("Lobby smoke test passed.");
      console.log(`Room code: ${hostLobby.lobby.roomCode}`);
    } finally {
      hostSocket.disconnect();
      guestSocket.disconnect();
    }
  } finally {
    server.kill("SIGTERM");
    await once(server, "exit");
  }
}

function serverOutputRef(getValue: () => string) {
  return {
    read: getValue,
  };
}

async function waitForServer(output: { read: () => string }) {
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (output.read().includes("[server] listening")) {
      return;
    }

    await delay(50);
  }

  throw new Error(`Server did not start in time.\n${output.read()}`);
}

function createClientState(): TestClientState {
  return {
    lobbies: [],
  };
}

function attachObservers(socket: Socket, state: TestClientState) {
  socket.on(SERVER_EVENTS.SESSION_JOINED, (payload: SessionJoinedPayload) => {
    state.session = payload;
  });

  socket.on(SERVER_EVENTS.LOBBY_STATE, (payload: LobbyStatePayload) => {
    state.lobbies.push(payload);
  });
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
  const deadline = Date.now() + EVENT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const match = state.lobbies.findLast((payload) => payload.lobby.players.length === playerCount);
    if (match) {
      return match;
    }

    await delay(25);
  }

  throw new Error(`Timed out waiting for lobby with ${playerCount} players.`);
}

async function onceWithTimeout(socket: Socket, eventName: string) {
  return Promise.race([
    once(socket, eventName),
    delay(EVENT_TIMEOUT_MS).then(() => {
      throw new Error(`Timed out waiting for "${eventName}".`);
    }),
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
