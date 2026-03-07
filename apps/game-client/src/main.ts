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

const DEFAULT_SERVER_URL = `${window.location.protocol}//${window.location.hostname}:3001`;
const SERVER_URL = resolveServerUrl();
const ROOM_CODE_LENGTH = 6;
const CHARACTER_CHOICES = ["fighter-1", "fighter-2", "fighter-3", "fighter-4"] as const;
const CHARACTER_DISPLAY: Record<(typeof CHARACTER_CHOICES)[number], { name: string; stand: string }> = {
  "fighter-1": { name: "Jay", stand: "/assets/jay/jay_stand.png" },
  "fighter-2": { name: "Fahim", stand: "/assets/fahim/fahim_stand.png" },
  "fighter-3": { name: "Ryan", stand: "/assets/ryan/ryan_stand.png" },
  "fighter-4": { name: "Jia", stand: "/assets/jia/jia_stand.png" },
};
const DEFAULT_MATCH_CHARACTER_LABEL = "temp-fighter";

function resolveServerUrl(): string {
  const configuredServerUrl = import.meta.env.VITE_SERVER_URL?.trim();
  if (!configuredServerUrl) {
    return DEFAULT_SERVER_URL;
  }

  return configuredServerUrl.endsWith("/")
    ? configuredServerUrl.slice(0, -1)
    : configuredServerUrl;
}

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot) {
  throw new Error("Missing #app root element.");
}
const app = appRoot;

let socket: Socket | null = null;
let listenersAttached = false;

const LOBBY_MUSIC_SCREENS: Screen[] = ["home", "character-select", "lobby"];
const lobbyMusic = new Audio("/audio/music/lobby.mp3");
lobbyMusic.loop = true;

function updateLobbyMusic(): void {
  const shouldPlay = LOBBY_MUSIC_SCREENS.includes(state.screen);
  if (shouldPlay && lobbyMusic.paused) {
    lobbyMusic.play().catch(() => {});
  } else if (!shouldPlay && !lobbyMusic.paused) {
    lobbyMusic.pause();
  }
}

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
  const active = document.activeElement;
  const focusedField =
    active instanceof HTMLInputElement ? active.dataset.field : null;
  const selectionStart = active instanceof HTMLInputElement ? active.selectionStart : null;
  const selectionEnd = active instanceof HTMLInputElement ? active.selectionEnd : null;

  document.body.classList.toggle("home-active", state.screen === "home");
  document.body.classList.toggle("character-select-active", state.screen === "character-select");
  document.body.classList.toggle("lobby-active", state.screen === "lobby");
  updateLobbyMusic();
  app.innerHTML = renderScreen();

  if (focusedField != null && selectionStart != null && selectionEnd != null) {
    const input = app.querySelector<HTMLInputElement>(`input[data-field="${focusedField}"]`);
    if (input) {
      input.focus();
      input.setSelectionRange(selectionStart, selectionEnd);
    }
  }
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
    <main class="shell home-screen">
      <section class="card home-card">
        <div class="home-title">
          <img src="/assets/home/title.png" alt="BUCS Fighter" class="home-title-img" />
        </div>

        <div class="home-form">
          <label class="field">
            Display Name
            <input data-field="display-name" value="${escapeHtml(state.displayNameInput)}" maxlength="24" placeholder="Player" />
          </label>

          <label class="field">
            Join Code
            <input data-field="join-code" value="${escapeHtml(normalizeRoomCode(state.joinCodeInput))}" maxlength="${ROOM_CODE_LENGTH}" placeholder="ABC123" />
          </label>

          <div class="home-actions">
            <button type="button" class="home-btn home-btn--create" data-action="create-lobby" ${state.isConnecting ? "disabled" : ""}>
              <img src="/assets/home/create_lobby.png" alt="Create Lobby" />
            </button>
            <button type="button" class="home-btn home-btn--join" data-action="join-lobby" ${canJoin && !state.isConnecting ? "" : "disabled"}>
              <img src="/assets/home/join_lobby.png" alt="Join Lobby" />
            </button>
          </div>
        </div>

        ${renderMessages()}
      </section>
    </main>
  `;
}

function renderCharacterSelectScreen(): string {
  const cards = CHARACTER_CHOICES.map((characterId) => {
    const isSelected = state.selectedCharacterId === characterId;
    const { name, stand } = CHARACTER_DISPLAY[characterId];
    return `
      <button
        type="button"
        class="character-card ${isSelected ? "character-card--selected" : ""}"
        data-action="select-character"
        data-character-id="${characterId}"
      >
        <img src="${stand}" alt="${escapeHtml(name)}" class="character-card-img" />
        <span class="character-card-name">${escapeHtml(name)}</span>
      </button>
    `;
  }).join("");

  return `
    <main class="shell character-select-screen">
      <section class="card character-select-card">
        <h1 class="character-select-title">Character Select</h1>
        <p class="character-select-subtitle">Choose your fighter.</p>
        <div class="character-grid">${cards}</div>
        <div class="character-select-actions">
          <button type="button" class="character-select-btn character-select-btn--back" data-action="character-back">Back</button>
          <button type="button" class="character-select-btn character-select-btn--ready" data-action="character-ready" ${state.selectedCharacterId ? "" : "disabled"}>Ready</button>
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

  const playerItems = players.length
    ?       players.map((player) => {
        const role = player.id === lobby?.hostPlayerId ? "Host" : "Player";
        const ready = player.isReady ? "Ready" : "Not ready";
        const isMe = player.id === state.playerId;
        const characterId = isMe
          ? (state.selectedCharacterId ?? player.selectedCharacterId)
          : player.selectedCharacterId;
        const playerChar =
          characterId && characterId in CHARACTER_DISPLAY
            ? CHARACTER_DISPLAY[characterId as keyof typeof CHARACTER_DISPLAY]
            : null;
        const avatarImg = playerChar
          ? `<span class="lobby-player-avatar-crop"><img src="${playerChar.stand}" alt="" class="lobby-avatar lobby-avatar--player" /></span>`
          : "";
        return `
          <li class="lobby-player ${isMe ? "lobby-player--you" : ""}">
            ${avatarImg}
            <span class="lobby-player-name">${escapeHtml(player.displayName)}${isMe ? " (You)" : ""}</span>
            <span class="lobby-player-role">${role}</span>
            <span class="lobby-player-ready ${player.isReady ? "lobby-player-ready--yes" : ""}">${ready}</span>
          </li>`;
      }).join("")
    : "<li class=\"lobby-player lobby-player--empty\">Waiting for players...</li>";

  return `
    <main class="shell lobby-screen">
      <section class="card lobby-card">
        <h1 class="lobby-title">Lobby</h1>
        <div class="lobby-room-code">
          <span class="lobby-room-code-label">Room Code</span>
          <span class="lobby-room-code-value">${escapeHtml(state.roomCode)}</span>
        </div>

        <ul class="lobby-player-list">${playerItems}</ul>

        <div class="lobby-actions">
          <button type="button" class="lobby-btn lobby-btn--change" data-action="change-character">Change Character</button>
          <button type="button" class="lobby-btn lobby-btn--back" data-action="leave-lobby">Back</button>
          <button type="button" class="lobby-btn lobby-btn--start" data-action="start-match" ${isHost && everyoneReady ? "" : "disabled"}>Start Match</button>
        </div>

        ${renderMessages()}
      </section>
    </main>
  `;
}

function renderMessages(): string {
  if (!state.errorMessage) return "";
  return `<p class="note note--error">${escapeHtml(state.errorMessage)}</p>`;
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
