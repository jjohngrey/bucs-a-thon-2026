import "./style.css";

type Screen = "home" | "join-code" | "character-select" | "lobby";
type FlowMode = "create" | "join" | null;

type AppState = {
  screen: Screen;
  mode: FlowMode;
  joinCodeInput: string;
  roomCode: string;
  selectedCharacterId: string | null;
  lobbyNote: string;
};

const CHARACTER_CHOICES = ["fighter-a", "fighter-b", "fighter-c", "fighter-d"];
const ROOM_CODE_LENGTH = 6;

const appRoot = document.querySelector<HTMLDivElement>("#app");

if (!appRoot) {
  throw new Error("Missing #app root element.");
}
const app = appRoot;

const state: AppState = {
  screen: "home",
  mode: null,
  joinCodeInput: "",
  roomCode: "",
  selectedCharacterId: null,
  lobbyNote: "",
};

render();

app.addEventListener("click", (event) => {
  const target = event.target as HTMLElement | null;
  const actionElement = target?.closest<HTMLElement>("[data-action]");
  if (!actionElement) {
    return;
  }

  const action = actionElement.dataset.action;
  switch (action) {
    case "start-create":
      state.mode = "create";
      state.roomCode = generateRoomCode();
      state.joinCodeInput = "";
      state.selectedCharacterId = null;
      state.lobbyNote = "";
      state.screen = "character-select";
      break;
    case "start-join":
      state.mode = "join";
      state.roomCode = "";
      state.joinCodeInput = "";
      state.selectedCharacterId = null;
      state.lobbyNote = "";
      state.screen = "join-code";
      break;
    case "go-home":
      state.screen = "home";
      state.mode = null;
      state.roomCode = "";
      state.joinCodeInput = "";
      state.selectedCharacterId = null;
      state.lobbyNote = "";
      break;
    case "continue-join": {
      const normalized = normalizeRoomCode(state.joinCodeInput);
      if (normalized.length !== ROOM_CODE_LENGTH) {
        state.lobbyNote = "Enter a 6-character room code.";
      } else {
        state.roomCode = normalized;
        state.lobbyNote = "";
        state.screen = "character-select";
      }
      break;
    }
    case "back-from-character":
      state.screen = state.mode === "join" ? "join-code" : "home";
      state.selectedCharacterId = null;
      break;
    case "select-character": {
      const selectedCharacterId = actionElement.dataset.characterId;
      if (selectedCharacterId) {
        state.selectedCharacterId = selectedCharacterId;
      }
      break;
    }
    case "to-lobby":
      if (!state.selectedCharacterId || !state.mode) {
        break;
      }
      state.lobbyNote = "";
      state.screen = "lobby";
      break;
    case "lobby-back":
      state.screen = "character-select";
      state.lobbyNote = "";
      break;
    case "host-start":
      state.lobbyNote = "Host start clicked. Wire this to match:start when backend integration is added.";
      break;
    default:
      break;
  }

  render();
});

app.addEventListener("input", (event) => {
  const target = event.target as HTMLElement | null;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (target.dataset.field === "join-room-code") {
    state.joinCodeInput = normalizeRoomCode(target.value);
    state.lobbyNote = "";
    render();
  }
});

function render(): void {
  app.innerHTML = renderScreen();
}

function renderScreen(): string {
  switch (state.screen) {
    case "home":
      return renderHomeScreen();
    case "join-code":
      return renderJoinCodeScreen();
    case "character-select":
      return renderCharacterSelectScreen();
    case "lobby":
      return renderLobbyScreen();
    default:
      return renderHomeScreen();
  }
}

function renderHomeScreen(): string {
  return `
    <main class="shell">
      <section class="card">
        <h1>BUCS Fighter</h1>
        <p>Choose how to enter a match.</p>
        <div class="row">
          <button type="button" data-action="start-create">Create Lobby</button>
          <button type="button" data-action="start-join">Join Lobby</button>
        </div>
      </section>
    </main>
  `;
}

function renderJoinCodeScreen(): string {
  const normalizedValue = normalizeRoomCode(state.joinCodeInput);
  const canContinue = normalizedValue.length === ROOM_CODE_LENGTH;

  return `
    <main class="shell">
      <section class="card">
        <h1>Join Lobby</h1>
        <p>Enter the room code from the host.</p>
        <label class="field">
          Room Code
          <input
            data-field="join-room-code"
            value="${normalizedValue}"
            maxlength="${ROOM_CODE_LENGTH}"
            placeholder="ABC123"
          />
        </label>
        ${state.lobbyNote ? `<p class="note">${state.lobbyNote}</p>` : ""}
        <div class="row">
          <button type="button" data-action="go-home">Back</button>
          <button type="button" data-action="continue-join" ${canContinue ? "" : "disabled"}>Continue</button>
        </div>
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
        <p>Placeholder selection. Pick one rectangle.</p>
        <div class="character-grid">${cards}</div>
        <div class="row">
          <button type="button" data-action="back-from-character">Back</button>
          <button type="button" data-action="to-lobby" ${state.selectedCharacterId ? "" : "disabled"}>Continue</button>
        </div>
      </section>
    </main>
  `;
}

function renderLobbyScreen(): string {
  const isHost = state.mode === "create";
  const selectedCharacterLabel = state.selectedCharacterId ?? "none";

  return `
    <main class="shell">
      <section class="card">
        <h1>Lobby</h1>
        <p>Room Code: <strong>${state.roomCode}</strong></p>
        <ul class="player-list">
          <li>You (${isHost ? "Host" : "Guest"}) - ${selectedCharacterLabel}</li>
          <li>Waiting for other players...</li>
        </ul>
        ${state.lobbyNote ? `<p class="note">${state.lobbyNote}</p>` : ""}
        <div class="row">
          <button type="button" data-action="lobby-back">Change Character</button>
          ${
            isHost
              ? '<button type="button" data-action="host-start">Start Match</button>'
              : '<button type="button" disabled>Waiting For Host</button>'
          }
        </div>
      </section>
    </main>
  `;
}

function normalizeRoomCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, ROOM_CODE_LENGTH);
}

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    const index = Math.floor(Math.random() * chars.length);
    code += chars[index];
  }
  return code;
}
