import "./style.css";
import { CLIENT_EVENTS, SERVER_EVENTS, type LobbyState, type LobbyStatePayload, type MatchStartingPayload, type SessionJoinedPayload } from "@bucs/shared";
import { io, type Socket } from "socket.io-client";

type Screen = "home" | "character-select" | "lobby";
type FlowMode = "create" | "join" | null;

type AppState = {
  screen: Screen;
  mode: FlowMode;
  isConnecting: boolean;
  displayNameInput: string;
  joinCodeInput: string;
  roomCode: string;
  playerId: string;
  selectedCharacterId: string | null;
  lobby: LobbyState | null;
  statusMessage: string;
  errorMessage: string;
};

const SERVER_URL = `${window.location.protocol}//${window.location.hostname}:3001`;
const ROOM_CODE_LENGTH = 6;
const CHARACTER_CHOICES = ["fighter-1", "fighter-2", "fighter-3", "fighter-4"];
const DEFAULT_MATCH_CHARACTER_LABEL = "temp-fighter";

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot) {
  throw new Error("Missing #app root element.");
}
const app = appRoot;

let socket: Socket | null = null;
let listenersAttached = false;

const state: AppState = {
  screen: "home",
  mode: null,
  isConnecting: false,
  displayNameInput: "Player",
  joinCodeInput: "",
  roomCode: "",
  playerId: "",
  selectedCharacterId: null,
  lobby: null,
  statusMessage: "",
  errorMessage: "",
};

render();

appRoot.addEventListener("click", async (event) => {
  const target = event.target as HTMLElement | null;
  const actionElement = target?.closest<HTMLElement>("[data-action]");
  if (!actionElement) {
    return;
  }

  const action = actionElement.dataset.action;

  switch (action) {
    case "create-lobby":
      await handleCreateLobby();
      break;
    case "join-lobby":
      await handleJoinLobby();
      break;
    case "select-character": {
      const characterId = actionElement.dataset.characterId;
      if (characterId) {
        state.selectedCharacterId = characterId;
        state.errorMessage = "";
      }
      render();
      break;
    }
    case "character-ready":
      await handleReadyAfterCharacterSelect();
      break;
    case "character-back":
      await leaveAndDisconnectToHome();
      break;
    case "change-character":
      await handleChangeCharacter();
      break;
    case "leave-lobby":
      await leaveAndDisconnectToHome();
      break;
    case "start-match":
      emitMatchStart();
      break;
    default:
      break;
  }
});

appRoot.addEventListener("input", (event) => {
  const target = event.target as HTMLElement | null;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (target.dataset.field === "display-name") {
    state.displayNameInput = target.value.slice(0, 24);
    state.errorMessage = "";
  }

  if (target.dataset.field === "join-code") {
    state.joinCodeInput = normalizeRoomCode(target.value);
    state.errorMessage = "";
  }

  render();
});

async function handleCreateLobby(): Promise<void> {
  const displayName = normalizeDisplayName(state.displayNameInput);

  state.mode = "create";
  state.displayNameInput = displayName;
  state.errorMessage = "";
  state.statusMessage = "Connecting...";
  state.isConnecting = true;
  render();

  const connected = await ensureConnected();
  if (!connected) {
    state.isConnecting = false;
    state.errorMessage = "Unable to connect to server.";
    state.statusMessage = "";
    render();
    return;
  }

  socket?.emit(CLIENT_EVENTS.LOBBY_CREATE, { displayName });
  state.statusMessage = "Creating lobby...";
  state.isConnecting = false;
  render();
}

async function handleJoinLobby(): Promise<void> {
  const displayName = normalizeDisplayName(state.displayNameInput);
  const roomCode = normalizeRoomCode(state.joinCodeInput);

  if (roomCode.length !== ROOM_CODE_LENGTH) {
    state.errorMessage = "Enter a 6-character room code.";
    render();
    return;
  }

  state.mode = "join";
  state.displayNameInput = displayName;
  state.joinCodeInput = roomCode;
  state.errorMessage = "";
  state.statusMessage = "Connecting...";
  state.isConnecting = true;
  render();

  const connected = await ensureConnected();
  if (!connected) {
    state.isConnecting = false;
    state.errorMessage = "Unable to connect to server.";
    state.statusMessage = "";
    render();
    return;
  }

  socket?.emit(CLIENT_EVENTS.LOBBY_JOIN, { roomCode, displayName });
  state.statusMessage = "Joining lobby...";
  state.isConnecting = false;
  render();
}

async function handleReadyAfterCharacterSelect(): Promise<void> {
  if (!state.lobby || !state.selectedCharacterId) {
    state.errorMessage = "Pick a character first.";
    render();
    return;
  }

  socket?.emit(CLIENT_EVENTS.LOBBY_READY, {
    roomCode: state.lobby.roomCode,
    isReady: true,
  });

  state.screen = "lobby";
  state.errorMessage = "";
  state.statusMessage = `Ready set. Match will use ${DEFAULT_MATCH_CHARACTER_LABEL} for now.`;
  render();
}

async function handleChangeCharacter(): Promise<void> {
  if (state.lobby) {
    socket?.emit(CLIENT_EVENTS.LOBBY_READY, {
      roomCode: state.lobby.roomCode,
      isReady: false,
    });
  }

  state.screen = "character-select";
  state.statusMessage = "You are unready. Pick again.";
  state.errorMessage = "";
  render();
}

async function leaveAndDisconnectToHome(): Promise<void> {
  const currentRoomCode = state.lobby?.roomCode ?? state.roomCode;
  if (currentRoomCode) {
    socket?.emit(CLIENT_EVENTS.LOBBY_LEAVE, { roomCode: currentRoomCode });
  }

  disconnectSocket();

  state.screen = "home";
  state.mode = null;
  state.roomCode = "";
  state.playerId = "";
  state.selectedCharacterId = null;
  state.lobby = null;
  state.statusMessage = "Disconnected.";
  state.errorMessage = "";
  render();
}

function emitMatchStart(): void {
  if (!state.lobby) {
    return;
  }

  socket?.emit(CLIENT_EVENTS.MATCH_START, {
    roomCode: state.lobby.roomCode,
  });

  state.errorMessage = "";
  state.statusMessage = "Host requested match start...";
  render();
}

async function ensureConnected(): Promise<boolean> {
  if (socket?.connected) {
    return true;
  }

  if (!socket) {
    socket = io(SERVER_URL, {
      transports: ["websocket"],
      autoConnect: false,
    });
  }

  if (!listenersAttached) {
    attachSocketListeners(socket);
    listenersAttached = true;
  }

  return new Promise<boolean>((resolve) => {
    if (!socket) {
      resolve(false);
      return;
    }

    socket.connect();

    const onConnect = () => {
      cleanup();
      resolve(true);
    };

    const onConnectError = () => {
      cleanup();
      resolve(false);
    };

    const timeout = window.setTimeout(() => {
      cleanup();
      resolve(false);
    }, 4000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      socket?.off("connect", onConnect);
      socket?.off("connect_error", onConnectError);
    };

    socket.on("connect", onConnect);
    socket.on("connect_error", onConnectError);
  });
}

function attachSocketListeners(activeSocket: Socket): void {
  activeSocket.on(SERVER_EVENTS.SESSION_JOINED, (payload: SessionJoinedPayload) => {
    state.playerId = payload.playerId;
    state.errorMessage = "";
    render();
  });

  activeSocket.on(SERVER_EVENTS.LOBBY_STATE, (payload: LobbyStatePayload) => {
    state.lobby = payload.lobby;
    state.roomCode = payload.lobby.roomCode;
    state.errorMessage = "";

    if (state.screen === "home") {
      state.screen = "character-select";
      state.statusMessage = "Connected. Pick a character and ready up.";
    }

    render();
  });

  activeSocket.on(SERVER_EVENTS.MATCH_STARTING, (payload: MatchStartingPayload) => {
    state.statusMessage = `Match starting in ${Math.ceil(payload.countdownMs / 1000)}s. Using ${DEFAULT_MATCH_CHARACTER_LABEL}.`;
    render();
  });

  activeSocket.on(SERVER_EVENTS.LOBBY_ERROR, (payload: { code: string; message: string }) => {
    state.errorMessage = `${payload.code}: ${payload.message}`;
    state.statusMessage = "";
    render();
  });

  activeSocket.on("disconnect", () => {
    if (state.screen !== "home") {
      state.statusMessage = "Disconnected from server.";
      render();
    }
  });
}

function disconnectSocket(): void {
  if (!socket) {
    return;
  }

  socket.disconnect();
  socket.removeAllListeners();
  socket = null;
  listenersAttached = false;
}

function render(): void {
  app.innerHTML = renderScreen();
}

function renderScreen(): string {
  switch (state.screen) {
    case "home":
      return renderHomeScreen();
    case "character-select":
      return renderCharacterSelectScreen();
    case "lobby":
      return renderLobbyScreen();
    default:
      return renderHomeScreen();
  }
}

function renderHomeScreen(): string {
  const canJoin = normalizeRoomCode(state.joinCodeInput).length === ROOM_CODE_LENGTH;

  return `
    <main class="shell">
      <section class="card">
        <h1>BUCS Fighter MVP</h1>
        <p>Create or join from this one screen.</p>

        <label class="field">
          Display Name
          <input data-field="display-name" value="${escapeHtml(state.displayNameInput)}" maxlength="24" placeholder="Player" />
        </label>

        <div class="home-actions">
          <button type="button" data-action="create-lobby" ${state.isConnecting ? "disabled" : ""}>Create Lobby</button>
        </div>

        <div class="inline-join">
          <label class="field field--inline">
            Join Code
            <input data-field="join-code" value="${escapeHtml(normalizeRoomCode(state.joinCodeInput))}" maxlength="${ROOM_CODE_LENGTH}" placeholder="ABC123" />
          </label>
          <button type="button" data-action="join-lobby" ${canJoin && !state.isConnecting ? "" : "disabled"}>Join Lobby</button>
        </div>

        ${renderMessages()}
      </section>
    </main>
  `;
}

function renderCharacterSelectScreen(): string {
  const cards = CHARACTER_CHOICES.map((characterId, index) => {
    const isSelected = state.selectedCharacterId === characterId;
    return `
      <button
        type="button"
        class="character-card ${isSelected ? "character-card--selected" : ""}"
        data-action="select-character"
        data-character-id="${characterId}"
      >
        Character ${index + 1}
      </button>
    `;
  }).join("");

  return `
    <main class="shell">
      <section class="card">
        <h1>Character Select</h1>
        <p>Pick any placeholder. Match currently starts everyone as ${DEFAULT_MATCH_CHARACTER_LABEL}.</p>
        <div class="character-grid">${cards}</div>
        <div class="row">
          <button type="button" data-action="character-back">Back</button>
          <button type="button" data-action="character-ready" ${state.selectedCharacterId ? "" : "disabled"}>Ready</button>
        </div>
        ${renderMessages()}
      </section>
    </main>
  `;
}

function renderLobbyScreen(): string {
  const lobby = state.lobby;
  const players = lobby?.players ?? [];
  const isHost = Boolean(lobby && state.playerId && lobby.hostPlayerId === state.playerId);
  const everyoneReady = Boolean(
    lobby &&
      lobby.players.length >= 2 &&
      lobby.players.every((player) => player.id === lobby.hostPlayerId || player.isReady),
  );

  const playerLines = players
    .map((player) => {
      const role = player.id === lobby?.hostPlayerId ? "Host" : "Player";
      const ready = player.isReady ? "Ready" : "Not Ready";
      const isMe = player.id === state.playerId ? " (You)" : "";
      return `<li>${escapeHtml(player.displayName)}${isMe} - ${role} - ${ready}</li>`;
    })
    .join("");

  return `
    <main class="shell">
      <section class="card">
        <h1>Lobby</h1>
        <p>Room Code: <strong>${escapeHtml(state.roomCode)}</strong></p>
        <p>Local pick: <strong>${escapeHtml(state.selectedCharacterId ?? "none")}</strong></p>
        <p>Gameplay start character: <strong>${DEFAULT_MATCH_CHARACTER_LABEL}</strong></p>

        <ul class="player-list">${playerLines || "<li>Waiting for players...</li>"}</ul>

        <div class="row">
          <button type="button" data-action="change-character">Change Character (Unready)</button>
          <button type="button" data-action="leave-lobby">Back (Disconnect)</button>
          <button type="button" data-action="start-match" ${isHost && everyoneReady ? "" : "disabled"}>Start Match</button>
        </div>

        ${renderMessages()}
      </section>
    </main>
  `;
}

function renderMessages(): string {
  const lines: string[] = [];

  if (state.statusMessage) {
    lines.push(`<p class="note note--status">${escapeHtml(state.statusMessage)}</p>`);
  }

  if (state.errorMessage) {
    lines.push(`<p class="note note--error">${escapeHtml(state.errorMessage)}</p>`);
  }

  return lines.join("");
}

function normalizeRoomCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, ROOM_CODE_LENGTH);
}

function normalizeDisplayName(input: string): string {
  return input.trim().slice(0, 24) || "Player";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
