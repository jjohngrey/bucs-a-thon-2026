import "./style.css";
import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  SERVER_TICK_RATE,
  type LobbyState,
  type LobbyStatePayload,
  type MatchEndedPayload,
  type MatchInputPayload,
  type MatchSnapshot,
  type MatchSnapshotPayload,
  type MatchStartingPayload,
  type PlayerAction,
  type SessionJoinedPayload,
} from "@bucs/shared";
import { io, type Socket } from "socket.io-client";

type Screen = "home" | "character-select" | "lobby" | "countdown" | "match" | "results";
type FlowMode = "create" | "join" | null;
type PressedInput = MatchInputPayload["pressed"];

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
  matchStarting: MatchStartingPayload | null;
  matchSnapshot: MatchSnapshot | null;
  matchEnded: MatchEndedPayload["summary"] | null;
  inputFrame: number;
  statusMessage: string;
  errorMessage: string;
};

const DEFAULT_SERVER_URL = `${window.location.protocol}//${window.location.hostname}:3001`;
const SERVER_URL = resolveServerUrl();
const ROOM_CODE_LENGTH = 6;
const CHARACTER_CHOICES = ["fighter-1", "fighter-2", "fighter-3", "fighter-4"];
const WORLD_MIN_X = -200;
const WORLD_MAX_X = 1400;
const ARENA_WIDTH = 840;
const ARENA_HEIGHT = 360;
const GROUND_Y_PX = 280;
const LOCAL_SPEED_PER_TICK = 6;
const LOCAL_JUMP_VELOCITY = -14;
const LOCAL_GRAVITY_PER_TICK = 1.2;

type CharacterSpriteSet = {
  stand: string;
  walking: string;
  punch: string;
  fighting: string;
  cheer: string;
};

const CHARACTER_SPRITES: Record<string, CharacterSpriteSet> = {
  "fighter-1": {
    stand: "/assets/jay/jay_stand.png",
    walking: "/assets/jay/jay_walking.png",
    punch: "/assets/jay/jay_punch.png",
    fighting: "/assets/jay/jay_fighting.png",
    cheer: "/assets/jay/jay_cheer.png",
  },
  "fighter-2": {
    stand: "/assets/jia/jia_stand.png",
    walking: "/assets/jia/jia_walking.png",
    punch: "/assets/jia/jia_punch.png",
    fighting: "/assets/jia/jia_fighting.png",
    cheer: "/assets/jia/jia%20cheer.png",
  },
  "fighter-3": {
    stand: "/assets/ryan/ryan_stand.png",
    walking: "/assets/ryan/ryan%20walking.png",
    punch: "/assets/ryan/ryan_punch.png",
    fighting: "/assets/ryan/ryan_fighting.png",
    cheer: "/assets/ryan/ryan_cheer.png",
  },
  "fighter-4": {
    stand: "/assets/fahim/fahim_stand.png",
    walking: "/assets/fahim/fahim_walking.png",
    punch: "/assets/fahim/fahim_punch.png",
    fighting: "/assets/fahim/fahim_fighting.png",
    cheer: "/assets/fahim/fahim_cheer.png",
  },
  jay: {
    stand: "/assets/jay/jay_stand.png",
    walking: "/assets/jay/jay_walking.png",
    punch: "/assets/jay/jay_punch.png",
    fighting: "/assets/jay/jay_fighting.png",
    cheer: "/assets/jay/jay_cheer.png",
  },
  jia: {
    stand: "/assets/jia/jia_stand.png",
    walking: "/assets/jia/jia_walking.png",
    punch: "/assets/jia/jia_punch.png",
    fighting: "/assets/jia/jia_fighting.png",
    cheer: "/assets/jia/jia%20cheer.png",
  },
  ryan: {
    stand: "/assets/ryan/ryan_stand.png",
    walking: "/assets/ryan/ryan%20walking.png",
    punch: "/assets/ryan/ryan_punch.png",
    fighting: "/assets/ryan/ryan_fighting.png",
    cheer: "/assets/ryan/ryan_cheer.png",
  },
  fahim: {
    stand: "/assets/fahim/fahim_stand.png",
    walking: "/assets/fahim/fahim_walking.png",
    punch: "/assets/fahim/fahim_punch.png",
    fighting: "/assets/fahim/fahim_fighting.png",
    cheer: "/assets/fahim/fahim_cheer.png",
  },
};

const CHARACTER_DISPLAY: Record<string, { name: string; stand: string }> = {
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
let latestSnapshotReceivedAtMs = 0;
let matchStartingAtMs = 0;
let previousSnapshot: MatchSnapshot | null = null;
let localPredictionByPlayerId: Record<string, { x: number; y: number; vy: number; grounded: boolean }> = {};
let predictionAccumulatorMs = 0;
let frameLoopStarted = false;
let localBypassIntervalId: number | null = null;
let localBypassServerFrame = 0;

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
  matchStarting: null,
  matchSnapshot: null,
  matchEnded: null,
  inputFrame: 0,
  statusMessage: "",
  errorMessage: "",
};

const pressedInput: PressedInput = {
  left: false,
  right: false,
  jump: false,
  attack: false,
  special: false,
};

render();
registerKeyboardInput();
startInputEmitLoop();
startFrameLoop();

appRoot.addEventListener("click", async (event) => {
  const target = event.target as HTMLElement | null;
  const actionElement = target?.closest<HTMLElement>("[data-action]");
  if (!actionElement) {
    return;
  }

  const action = actionElement.dataset.action;

  switch (action) {
    case "quick-test-match":
      startLocalBypassMatch();
      break;
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

function registerKeyboardInput(): void {
  window.addEventListener("keydown", (event) => {
    if (event.repeat) {
      return;
    }
    const tagName = (event.target as HTMLElement | null)?.tagName;
    if (tagName === "INPUT" || tagName === "TEXTAREA") {
      return;
    }
    if (applyKeyboardPress(event.code, true)) {
      event.preventDefault();
    }
  });

  window.addEventListener("keyup", (event) => {
    if (applyKeyboardPress(event.code, false)) {
      event.preventDefault();
    }
  });
}

function applyKeyboardPress(code: string, isPressed: boolean): boolean {
  switch (code) {
    case "ArrowLeft":
    case "KeyA":
      pressedInput.left = isPressed;
      return true;
    case "ArrowRight":
    case "KeyD":
      pressedInput.right = isPressed;
      return true;
    case "ArrowUp":
    case "KeyW":
    case "Space":
      pressedInput.jump = isPressed;
      return true;
    case "KeyJ":
      pressedInput.attack = isPressed;
      return true;
    case "KeyK":
      pressedInput.special = isPressed;
      return true;
    default:
      return false;
  }
}

function startInputEmitLoop(): void {
  const tickMs = Math.round(1000 / SERVER_TICK_RATE);
  window.setInterval(() => {
    if (state.screen !== "match" || !state.roomCode || !socket?.connected) {
      return;
    }

    socket.emit(CLIENT_EVENTS.MATCH_INPUT, {
      roomCode: state.roomCode,
      inputFrame: state.inputFrame,
      pressed: { ...pressedInput },
    });
    state.inputFrame += 1;
  }, tickMs);
}

function startFrameLoop(): void {
  if (frameLoopStarted) {
    return;
  }
  frameLoopStarted = true;
  let previousAtMs = performance.now();
  const frame = (nowMs: number) => {
    const deltaMs = Math.max(0, nowMs - previousAtMs);
    previousAtMs = nowMs;
    updateLocalPrediction(deltaMs);
    if (state.screen === "match" || state.screen === "countdown") {
      render();
    }
    window.requestAnimationFrame(frame);
  };
  window.requestAnimationFrame(frame);
}

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

  socket?.emit(CLIENT_EVENTS.MATCH_SELECT_CHARACTER, {
    roomCode: state.lobby.roomCode,
    characterId: state.selectedCharacterId,
  });

  socket?.emit(CLIENT_EVENTS.LOBBY_READY, {
    roomCode: state.lobby.roomCode,
    isReady: true,
  });

  state.screen = "lobby";
  state.errorMessage = "";
  state.statusMessage = `Ready set with ${state.selectedCharacterId}.`;
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
  stopLocalBypassMatch();

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
  state.matchStarting = null;
  state.matchSnapshot = null;
  state.matchEnded = null;
  state.inputFrame = 0;
  matchStartingAtMs = 0;
  latestSnapshotReceivedAtMs = 0;
  previousSnapshot = null;
  localPredictionByPlayerId = {};
  predictionAccumulatorMs = 0;
  state.statusMessage = "Disconnected.";
  state.errorMessage = "";
  render();
}

function startLocalBypassMatch(): void {
  stopLocalBypassMatch();
  disconnectSocket();

  const displayName = normalizeDisplayName(state.displayNameInput);
  const localPlayerId = "local-player";
  const localCharacterId = state.selectedCharacterId ?? "fighter-1";

  state.mode = null;
  state.playerId = localPlayerId;
  state.roomCode = "LOCAL";
  state.lobby = null;
  state.matchStarting = null;
  state.matchEnded = null;
  state.errorMessage = "";
  state.statusMessage = "Local bypass match (no server).";
  state.inputFrame = 0;
  localBypassServerFrame = 0;
  predictionAccumulatorMs = 0;

  const initialSnapshot: MatchSnapshot = {
    serverFrame: localBypassServerFrame,
    phase: "active",
    players: [
      {
        id: localPlayerId,
        displayName,
        characterId: localCharacterId,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        grounded: true,
        damage: 0,
        stocks: 3,
        isOutOfPlay: false,
        respawnTimerMs: 0,
        respawnInvulnerabilityMs: 0,
        respawnPlatformCenterX: null,
        respawnPlatformY: null,
        respawnPlatformWidth: 0,
        facing: "right",
        action: "idle",
      },
    ],
  };

  state.matchSnapshot = initialSnapshot;
  state.screen = "match";
  localPredictionByPlayerId = {
    [localPlayerId]: {
      x: 0,
      y: 0,
      vy: 0,
      grounded: true,
    },
  };
  render();

  const tickMs = Math.round(1000 / SERVER_TICK_RATE);
  localBypassIntervalId = window.setInterval(() => {
    const current = state.matchSnapshot;
    if (!current || state.screen !== "match") {
      return;
    }
    state.matchSnapshot = advanceLocalBypassSnapshot(current);
  }, tickMs);
}

function stopLocalBypassMatch(): void {
  if (localBypassIntervalId !== null) {
    window.clearInterval(localBypassIntervalId);
    localBypassIntervalId = null;
  }
}

function advanceLocalBypassSnapshot(previous: MatchSnapshot): MatchSnapshot {
  const me = previous.players[0];
  if (!me) {
    return previous;
  }

  const horizontalVelocity =
    pressedInput.left && !pressedInput.right
      ? -LOCAL_SPEED_PER_TICK
      : pressedInput.right && !pressedInput.left
        ? LOCAL_SPEED_PER_TICK
        : 0;

  const jumped = pressedInput.jump && me.grounded;
  const verticalVelocity = jumped ? LOCAL_JUMP_VELOCITY : me.vy + LOCAL_GRAVITY_PER_TICK;
  const nextY = me.y + verticalVelocity;
  const grounded = nextY >= 0;
  const resolvedY = grounded ? 0 : nextY;
  const resolvedVy = grounded ? 0 : verticalVelocity;
  const facing = horizontalVelocity < 0 ? "left" : horizontalVelocity > 0 ? "right" : me.facing;
  const action = pressedInput.attack
    ? "attack"
    : grounded
      ? horizontalVelocity === 0
        ? "idle"
        : "run"
      : resolvedVy < 0
        ? "jump"
        : "fall";

  localBypassServerFrame += 1;
  return {
    serverFrame: localBypassServerFrame,
    phase: "active",
    players: [
      {
        ...me,
        x: me.x + horizontalVelocity,
        y: resolvedY,
        vx: horizontalVelocity,
        vy: resolvedVy,
        grounded,
        facing,
        action,
      },
    ],
  };
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
    state.matchStarting = payload;
    state.matchEnded = null;
    state.matchSnapshot = null;
    state.screen = "countdown";
    state.inputFrame = 0;
    matchStartingAtMs = performance.now();
    latestSnapshotReceivedAtMs = matchStartingAtMs;
    previousSnapshot = null;
    localPredictionByPlayerId = {};
    predictionAccumulatorMs = 0;
    state.statusMessage = `Match starting in ${Math.ceil(payload.countdownMs / 1000)}s.`;
    render();
  });

  activeSocket.on(SERVER_EVENTS.MATCH_SNAPSHOT, (payload: MatchSnapshotPayload) => {
    if (payload.roomCode !== state.roomCode) {
      return;
    }

    previousSnapshot = state.matchSnapshot;
    state.matchSnapshot = payload.snapshot;
    state.screen = "match";
    state.statusMessage = "";
    state.errorMessage = "";
    latestSnapshotReceivedAtMs = performance.now();

    const nextPrediction: Record<string, { x: number; y: number; vy: number; grounded: boolean }> = {};
    for (const player of payload.snapshot.players) {
      const existing = localPredictionByPlayerId[player.id];
      nextPrediction[player.id] = {
        x: existing ? blend(existing.x, player.x, 0.2) : player.x,
        y: existing ? blend(existing.y, player.y, 0.2) : player.y,
        vy: player.vy,
        grounded: player.grounded,
      };
    }
    localPredictionByPlayerId = nextPrediction;
    render();
  });

  activeSocket.on(SERVER_EVENTS.MATCH_ENDED, (payload: MatchEndedPayload) => {
    if (payload.roomCode !== state.roomCode) {
      return;
    }
    state.matchEnded = payload.summary;
    state.screen = "results";
    state.statusMessage = "Match ended.";
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
    case "countdown":
      return renderCountdownScreen();
    case "match":
      return renderMatchScreen();
    case "results":
      return renderResultsScreen();
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

function renderCountdownScreen(): string {
  const countdownMs = state.matchStarting?.countdownMs ?? 0;
  const elapsedMs = Math.max(0, performance.now() - matchStartingAtMs);
  const secondsLeft = Math.max(0, Math.ceil((countdownMs - elapsedMs) / 1000));

  return `
    <main class="shell">
      <section class="card">
        <h1>Match Starting</h1>
        <p>Stage: <strong>${escapeHtml(state.matchStarting?.stageId ?? "unknown")}</strong></p>
        <p class="countdown">${secondsLeft}</p>
        <p>Waiting for authoritative snapshots...</p>
        ${renderMessages()}
      </section>
    </main>
  `;
}

function renderMatchScreen(): string {
  const snapshot = state.matchSnapshot;
  if (!snapshot) {
    const placeholderPlayers = (state.lobby?.players ?? [])
      .map((player, index) => {
        const x = 260 + index * 260;
        const y = 280;
        return `
          <div
            class="arena-player arena-player--placeholder"
            style="left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;transform: translate(-50%, -100%);"
          >
            <div class="arena-player__label">${escapeHtml(player.displayName)} (loading)</div>
          </div>
        `;
      })
      .join("");

    return `
      <main class="shell shell--wide">
        <section class="card">
          <h1>Match</h1>
          <p>Waiting for snapshot...</p>
          <div class="arena">
            <div class="arena-floor"></div>
            ${placeholderPlayers}
          </div>
          ${renderMessages()}
        </section>
      </main>
    `;
  }

  const playersMarkup = snapshot.players
    .map((player) => {
      const predicted = localPredictionByPlayerId[player.id];
      const x = worldToScreenX(predicted?.x ?? player.x);
      const y = worldToScreenY(predicted?.y ?? player.y);
      const actionState = mapActionToAnimationState(player.action);
      const facingScale = player.facing === "left" ? -1 : 1;
      const koClass = player.isOutOfPlay ? "arena-player--ko" : "";
      const invulnClass = player.respawnInvulnerabilityMs > 0 ? "arena-player--invulnerable" : "";
      const spriteUrl = getSpriteUrlForPlayer(player.characterId, player.action);

      return `
        <div
          class="arena-player ${koClass} ${invulnClass} arena-player--anim-${actionState}"
          style="left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;transform: translate(-50%, -100%);"
        >
          <img
            class="arena-player__sprite"
            src="${spriteUrl}"
            alt="${escapeHtml(player.displayName)} ${actionState}"
            onerror="this.style.display='none'"
            style="transform: scaleX(${facingScale});"
          />
          <div class="arena-player__label">${escapeHtml(player.displayName)} (${actionState})</div>
        </div>
      `;
    })
    .join("");

  const respawnPlatformsMarkup = snapshot.players
    .filter((player) => player.respawnInvulnerabilityMs > 0 && player.respawnPlatformCenterX !== null && player.respawnPlatformY !== null)
    .map((player) => {
      const centerX = worldToScreenX(player.respawnPlatformCenterX ?? 0);
      const y = worldToScreenY(player.respawnPlatformY ?? 0);
      return `<div class="respawn-platform" style="left:${centerX.toFixed(1)}px;top:${y.toFixed(1)}px;width:${player.respawnPlatformWidth.toFixed(1)}px"></div>`;
    })
    .join("");

  const hudMarkup = snapshot.players
    .map((player) => {
      const status = player.isOutOfPlay
        ? `KO - respawn ${Math.ceil(player.respawnTimerMs / 1000)}s`
        : player.respawnInvulnerabilityMs > 0
          ? `Invulnerable ${Math.ceil(player.respawnInvulnerabilityMs / 1000)}s`
          : "In play";
      return `<li><strong>${escapeHtml(player.displayName)}</strong> - ${player.damage}% - Stocks: ${player.stocks} - ${status}</li>`;
    })
    .join("");

  return `
    <main class="shell shell--wide">
      <section class="card">
        <h1>Match</h1>
        <p>Authoritative snapshot rendering with temporary local prediction feel.</p>
        <p class="controls-note">Move: A/D or Arrow keys, Jump: W/Up/Space, Attack: J, Special: K</p>
        <div class="arena">
          <div class="arena-floor"></div>
          ${respawnPlatformsMarkup}
          ${playersMarkup}
        </div>
        <ul class="hud-list">${hudMarkup}</ul>
        ${renderMessages()}
      </section>
    </main>
  `;
}

function renderResultsScreen(): string {
  const summary = state.matchEnded;
  return `
    <main class="shell">
      <section class="card">
        <h1>Results</h1>
        <p>Winner: <strong>${escapeHtml(summary?.winnerPlayerId ?? "none")}</strong></p>
        <p>Eliminated: ${escapeHtml(summary?.eliminatedPlayerIds.join(", ") || "none")}</p>
        <div class="row">
          <button type="button" data-action="leave-lobby">Exit To Home</button>
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

function updateLocalPrediction(deltaMs: number): void {
  const snapshot = state.matchSnapshot;
  if (!snapshot || state.screen !== "match") {
    predictionAccumulatorMs = 0;
    return;
  }

  const tickMs = 1000 / SERVER_TICK_RATE;
  predictionAccumulatorMs += deltaMs;
  const simulatedTicks = Math.max(0, Math.floor(predictionAccumulatorMs / tickMs));
  if (simulatedTicks === 0) {
    return;
  }
  predictionAccumulatorMs -= simulatedTicks * tickMs;

  const localPlayerId = state.playerId;
  for (const player of snapshot.players) {
    const prediction = localPredictionByPlayerId[player.id];
    if (!prediction) {
      continue;
    }

    if (player.id !== localPlayerId) {
      prediction.x = blend(prediction.x, player.x, 0.15);
      prediction.y = blend(prediction.y, player.y, 0.15);
      prediction.vy = player.vy;
      prediction.grounded = player.grounded;
      continue;
    }

    for (let index = 0; index < simulatedTicks; index += 1) {
      const horizontalVelocity =
        pressedInput.left && !pressedInput.right
          ? -LOCAL_SPEED_PER_TICK
          : pressedInput.right && !pressedInput.left
            ? LOCAL_SPEED_PER_TICK
            : 0;

      const shouldJump = pressedInput.jump && prediction.grounded;
      prediction.vy = shouldJump ? LOCAL_JUMP_VELOCITY : prediction.vy + LOCAL_GRAVITY_PER_TICK;
      prediction.x += horizontalVelocity;
      prediction.y += prediction.vy;

      if (prediction.y >= 0) {
        prediction.y = 0;
        prediction.vy = 0;
        prediction.grounded = true;
      } else {
        prediction.grounded = false;
      }
    }
  }
}

function mapActionToAnimationState(action: PlayerAction): string {
  switch (action) {
    case "idle":
      return "idle";
    case "run":
      return "run";
    case "jump":
      return "jump";
    case "fall":
      return "fall";
    case "attack":
      return "attack";
    case "hitstun":
      return "hitstun";
    case "respawn":
      return "respawn";
    case "ko":
      return "ko";
    default:
      return "idle";
  }
}

function getSpriteUrlForPlayer(characterId: string, action: PlayerAction): string {
  const normalizedCharacterId = characterId.trim().toLowerCase();
  const sprites = CHARACTER_SPRITES[normalizedCharacterId] ?? CHARACTER_SPRITES["fighter-1"];
  switch (action) {
    case "idle":
      return sprites.stand;
    case "run":
      return sprites.walking;
    case "attack":
      return sprites.punch;
    case "jump":
    case "fall":
    case "hitstun":
      return sprites.fighting;
    case "respawn":
    case "ko":
      return sprites.cheer;
    default:
      return sprites.stand;
  }
}

function worldToScreenX(x: number): number {
  const normalized = clamp((x - WORLD_MIN_X) / (WORLD_MAX_X - WORLD_MIN_X), 0, 1);
  return normalized * ARENA_WIDTH;
}

function worldToScreenY(y: number): number {
  const raw = GROUND_Y_PX + y;
  return clamp(raw, 0, ARENA_HEIGHT - 4);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function blend(current: number, target: number, alpha: number): number {
  return current + (target - current) * alpha;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
