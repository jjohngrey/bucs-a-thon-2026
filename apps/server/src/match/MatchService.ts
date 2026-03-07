import type {
  LobbyErrorPayload,
  MatchEndPayload,
  MatchInputPayload,
  MatchSnapshot,
  MatchSummary,
  MatchSession,
  MatchStartPayload,
  MatchStartingPayload,
  PlayerMatchState,
} from "@bucs/shared";
import {
  DEFAULT_ATTACK_DAMAGE,
  DEFAULT_ATTACK_HEIGHT,
  DEFAULT_ATTACK_RANGE,
  DEFAULT_FLOOR_Y,
  DEFAULT_GRAVITY_PER_TICK,
  DEFAULT_HITSTUN_TICKS,
  DEFAULT_JUMP_VELOCITY,
  DEFAULT_KNOCKBACK_X,
  DEFAULT_KNOCKBACK_Y,
  DEFAULT_STAGE_ID,
  DEFAULT_STOCK_COUNT,
  PLAYER_ACTIONS,
  SERVER_TICK_RATE,
} from "@bucs/shared";
import { LobbyStore } from "../lobby/LobbyStore.js";
import { normalizeRoomCode } from "../lobby/RoomCode.js";
import { MatchStore } from "./MatchStore.js";

type MatchServiceError = {
  ok: false;
  error: LobbyErrorPayload;
};

type MatchServiceSuccess<T> = {
  ok: true;
  value: T;
};

export type MatchServiceResult<T> = MatchServiceError | MatchServiceSuccess<T>;

export type StartMatchResult = {
  match: MatchSession;
  startEvent: MatchStartingPayload;
};

export type ActivateMatchResult = {
  roomCode: string;
  match: MatchSession;
  snapshot: MatchSnapshot;
};

export type CleanupMatchResult = {
  roomCode: string;
  removed: boolean;
};

export type SubmitInputResult = {
  roomCode: string;
  playerId: string;
};

export type EndMatchResult = {
  roomCode: string;
  summary: MatchSummary;
};

const DEFAULT_COUNTDOWN_MS = 3000;
const PLAYER_SPEED_PER_TICK = 6;

export class MatchService {
  private readonly pendingStartTimers = new Map<string, NodeJS.Timeout>();
  private readonly activeMatchIntervals = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly lobbyStore: LobbyStore,
    private readonly matchStore: MatchStore,
  ) {}

  startMatch(socketId: string, payload: MatchStartPayload): MatchServiceResult<StartMatchResult> {
    const session = this.lobbyStore.getSessionBySocketId(socketId);
    if (!session) {
      return failure("NOT_IN_LOBBY", "Socket is not associated with a lobby.");
    }

    const roomCode = normalizeRoomCode(payload.roomCode);
    if (roomCode !== session.roomCode) {
      return failure("ROOM_MISMATCH", "Socket is not associated with that room.");
    }

    const lobby = this.lobbyStore.getLobby(roomCode);
    if (!lobby) {
      return failure("LOBBY_NOT_FOUND", "Lobby does not exist.");
    }

    if (lobby.hostPlayerId !== session.playerId) {
      return failure("ONLY_HOST_CAN_START", "Only the host can start the match.");
    }

    if (lobby.players.length < 2) {
      return failure("NOT_ENOUGH_PLAYERS", "At least two players are required to start a match.");
    }

    if (lobby.phase !== "waiting") {
      return failure("INVALID_LOBBY_PHASE", "Lobby must be in the waiting phase before match start.");
    }

    if (this.matchStore.hasMatch(roomCode)) {
      return failure("MATCH_ALREADY_EXISTS", "A match already exists for this room.");
    }

    const unreadyPlayer = lobby.players.find(
      (player) => player.id !== lobby.hostPlayerId && !player.isReady,
    );
    if (unreadyPlayer) {
      return failure("PLAYERS_NOT_READY", "All non-host players must be ready before match start.");
    }

    const match: MatchSession = {
      roomCode,
      stageId: lobby.selectedStageId ?? DEFAULT_STAGE_ID,
      phase: "countdown",
      playerIds: lobby.players.map((player) => player.id),
    };

    this.matchStore.createMatch(match);
    const updatedLobby = this.lobbyStore.updateLobbyPhase(roomCode, "starting");
    if (!updatedLobby) {
      this.matchStore.removeMatch(roomCode);
      return failure("MATCH_START_FAILED", "Unable to transition the lobby to match start.");
    }

    return {
      ok: true,
      value: {
        match,
        startEvent: {
          roomCode,
          stageId: match.stageId,
          playerIds: match.playerIds,
          countdownMs: DEFAULT_COUNTDOWN_MS,
        },
      },
    };
  }

  scheduleMatchActivation(
    roomCode: string,
    countdownMs: number,
    onActivated: (result: ActivateMatchResult) => void,
  ): void {
    const existingTimer = this.pendingStartTimers.get(roomCode);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.pendingStartTimers.delete(roomCode);

      const lobby = this.lobbyStore.getLobby(roomCode);
      const match = this.matchStore.getMatch(roomCode);
      if (!lobby || !match) {
        return;
      }

      if (lobby.phase !== "starting" || match.phase !== "countdown") {
        return;
      }

      if (lobby.players.length < 2) {
        return;
      }

      const updatedLobby = this.lobbyStore.updateLobbyPhase(roomCode, "in-match");
      const updatedMatch = this.matchStore.updateMatchPhase(roomCode, "active");
      if (!updatedLobby || !updatedMatch) {
        return;
      }

      onActivated({
        roomCode,
        match: updatedMatch,
        snapshot: createInitialSnapshot(lobby.players),
      });
    }, countdownMs);

    this.pendingStartTimers.set(roomCode, timer);
  }

  cleanupMatchForRoom(roomCode: string): CleanupMatchResult {
    const normalizedRoomCode = normalizeRoomCode(roomCode);
    const existingTimer = this.pendingStartTimers.get(normalizedRoomCode);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.pendingStartTimers.delete(normalizedRoomCode);
    }

    const activeInterval = this.activeMatchIntervals.get(normalizedRoomCode);
    if (activeInterval) {
      clearInterval(activeInterval);
      this.activeMatchIntervals.delete(normalizedRoomCode);
    }

    return {
      roomCode: normalizedRoomCode,
      removed: this.matchStore.removeMatch(normalizedRoomCode),
    };
  }

  submitInput(socketId: string, payload: MatchInputPayload): MatchServiceResult<SubmitInputResult> {
    const session = this.lobbyStore.getSessionBySocketId(socketId);
    if (!session) {
      return failure("NOT_IN_LOBBY", "Socket is not associated with a lobby.");
    }

    const roomCode = normalizeRoomCode(payload.roomCode);
    if (roomCode !== session.roomCode) {
      return failure("ROOM_MISMATCH", "Socket is not associated with that room.");
    }

    const match = this.matchStore.getMatch(roomCode);
    if (!match) {
      return failure("MATCH_NOT_FOUND", "Match does not exist.");
    }

    if (match.phase !== "active") {
      return failure("MATCH_NOT_ACTIVE", "Match is not active.");
    }

    const updated = this.matchStore.updateLatestInput(roomCode, session.playerId, payload.pressed);
    if (!updated) {
      return failure("INPUT_REJECTED", "Unable to store player input.");
    }

    return {
      ok: true,
      value: {
        roomCode,
        playerId: session.playerId,
      },
    };
  }

  startSnapshotLoop(
    roomCode: string,
    onSnapshot: (payload: { roomCode: string; snapshot: MatchSnapshot }) => void,
  ): void {
    const normalizedRoomCode = normalizeRoomCode(roomCode);
    const existingInterval = this.activeMatchIntervals.get(normalizedRoomCode);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    const interval = setInterval(() => {
      const runtimeState = this.matchStore.getRuntimeState(normalizedRoomCode);
      if (!runtimeState || runtimeState.session.phase !== "active") {
        return;
      }

      const snapshot = advanceSnapshot(
        runtimeState.latestSnapshot ?? createInitialSnapshot(
          (this.lobbyStore.getLobby(normalizedRoomCode)?.players ?? []).map((player) => ({
            id: player.id,
            displayName: player.displayName,
            selectedCharacterId: player.selectedCharacterId,
          })),
        ),
        runtimeState.latestInputsByPlayerId,
        runtimeState.previousInputsByPlayerId,
        runtimeState.hitstunTicksByPlayerId,
      );

      this.matchStore.updateLatestSnapshot(normalizedRoomCode, snapshot);
      this.matchStore.commitInputs(normalizedRoomCode);
      onSnapshot({
        roomCode: normalizedRoomCode,
        snapshot,
      });
    }, Math.round(1000 / SERVER_TICK_RATE));

    this.activeMatchIntervals.set(normalizedRoomCode, interval);
  }

  endMatch(socketId: string, payload: MatchEndPayload): MatchServiceResult<EndMatchResult> {
    const session = this.lobbyStore.getSessionBySocketId(socketId);
    if (!session) {
      return failure("NOT_IN_LOBBY", "Socket is not associated with a lobby.");
    }

    const roomCode = normalizeRoomCode(payload.roomCode);
    if (roomCode !== session.roomCode) {
      return failure("ROOM_MISMATCH", "Socket is not associated with that room.");
    }

    const lobby = this.lobbyStore.getLobby(roomCode);
    const match = this.matchStore.getMatch(roomCode);
    if (!lobby || !match) {
      return failure("MATCH_NOT_FOUND", "Match does not exist.");
    }

    if (match.phase !== "active") {
      return failure("MATCH_NOT_ACTIVE", "Match is not active.");
    }

    const updatedLobby = this.lobbyStore.updateLobbyPhase(roomCode, "finished");
    if (!updatedLobby) {
      return failure("MATCH_END_FAILED", "Unable to update lobby to finished.");
    }

    this.cleanupMatchForRoom(roomCode);

    return {
      ok: true,
      value: {
        roomCode,
        summary: {
          winnerPlayerId: payload.winnerPlayerId,
          eliminatedPlayerIds: payload.eliminatedPlayerIds,
        },
      },
    };
  }
}

function createInitialSnapshot(players: Array<{
  id: string;
  displayName: string;
  selectedCharacterId: string | null;
}>): MatchSnapshot {
  return {
    serverFrame: 0,
    phase: "active",
    players: players.map((player, index) => createInitialPlayerState(player, index)),
  };
}

function advanceSnapshot(
  previous: MatchSnapshot,
  latestInputsByPlayerId: Record<
    string,
    {
      left: boolean;
      right: boolean;
      jump: boolean;
      attack: boolean;
      special: boolean;
    }
  >,
  previousInputsByPlayerId: Record<
    string,
    {
      left: boolean;
      right: boolean;
      jump: boolean;
      attack: boolean;
      special: boolean;
    }
  >,
  hitstunTicksByPlayerId: Record<string, number>,
): MatchSnapshot {
  const nextPlayers: PlayerMatchState[] = previous.players.map((player) => {
    const input = latestInputsByPlayerId[player.id];
    const inHitstun = (hitstunTicksByPlayerId[player.id] ?? 0) > 0;
    const horizontalVelocityFromInput =
      input?.left && !input.right
        ? -PLAYER_SPEED_PER_TICK
        : input?.right && !input.left
          ? PLAYER_SPEED_PER_TICK
          : 0;
    const horizontalVelocity = inHitstun
      ? Math.abs(player.vx) < 0.5
        ? 0
        : player.vx * 0.85
      : horizontalVelocityFromInput;
    const jumped = Boolean(input?.jump && player.grounded && !inHitstun);
    const verticalVelocity = jumped
      ? DEFAULT_JUMP_VELOCITY
      : player.vy + DEFAULT_GRAVITY_PER_TICK;
    const nextY = player.y + verticalVelocity;
    const grounded = nextY >= DEFAULT_FLOOR_Y;
    const resolvedY = grounded ? DEFAULT_FLOOR_Y : nextY;
    const resolvedVy = grounded ? 0 : verticalVelocity;
    const facing =
      horizontalVelocity < 0
        ? "left"
        : horizontalVelocity > 0
          ? "right"
          : player.facing;
    const action: PlayerMatchState["action"] = inHitstun
      ? PLAYER_ACTIONS.HITSTUN
      : grounded
        ? horizontalVelocity === 0
          ? PLAYER_ACTIONS.IDLE
          : PLAYER_ACTIONS.RUN
        : resolvedVy < 0
          ? PLAYER_ACTIONS.JUMP
          : PLAYER_ACTIONS.FALL;

    return {
      ...player,
      x: player.x + horizontalVelocity,
      y: resolvedY,
      vx: horizontalVelocity,
      vy: resolvedVy,
      grounded,
      facing,
      action,
    };
  });

  for (const playerId of Object.keys(hitstunTicksByPlayerId)) {
    hitstunTicksByPlayerId[playerId] = Math.max(0, (hitstunTicksByPlayerId[playerId] ?? 0) - 1);
  }

  for (const attacker of nextPlayers) {
    const currentInput = latestInputsByPlayerId[attacker.id];
    const previousInput = previousInputsByPlayerId[attacker.id];
    const attackTriggered = Boolean(currentInput?.attack && !previousInput?.attack);
    if (!attackTriggered || attacker.action === PLAYER_ACTIONS.HITSTUN) {
      continue;
    }

    attacker.action = PLAYER_ACTIONS.ATTACK;

    const target = nextPlayers.find((candidate) => {
      if (candidate.id === attacker.id) {
        return false;
      }

      const dx = candidate.x - attacker.x;
      const withinFacing =
        attacker.facing === "right" ? dx >= 0 && dx <= DEFAULT_ATTACK_RANGE : dx <= 0 && dx >= -DEFAULT_ATTACK_RANGE;
      const withinHeight = Math.abs(candidate.y - attacker.y) <= DEFAULT_ATTACK_HEIGHT;
      return withinFacing && withinHeight;
    });

    if (!target) {
      continue;
    }

    target.damage += DEFAULT_ATTACK_DAMAGE;
    target.vx = attacker.facing === "right" ? DEFAULT_KNOCKBACK_X : -DEFAULT_KNOCKBACK_X;
    target.vy = DEFAULT_KNOCKBACK_Y;
    target.grounded = false;
    target.y = Math.min(target.y, DEFAULT_FLOOR_Y - 1);
    target.facing = attacker.facing === "right" ? "left" : "right";
    target.action = PLAYER_ACTIONS.HITSTUN;
    hitstunTicksByPlayerId[target.id] = DEFAULT_HITSTUN_TICKS;
  }

  return {
    serverFrame: previous.serverFrame + 1,
    phase: "active",
    players: nextPlayers,
  };
}

function createInitialPlayerState(
  player: {
    id: string;
    displayName: string;
    selectedCharacterId: string | null;
  },
  index: number,
): PlayerMatchState {
  return {
    id: player.id,
    displayName: player.displayName,
    characterId: player.selectedCharacterId ?? `placeholder-${index + 1}`,
    x: index * 160,
    y: DEFAULT_FLOOR_Y,
    vx: 0,
    vy: 0,
    grounded: true,
    damage: 0,
    stocks: DEFAULT_STOCK_COUNT,
    facing: index % 2 === 0 ? "right" : "left",
    action: PLAYER_ACTIONS.IDLE,
  };
}

function failure(code: string, message: string): MatchServiceError {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  };
}
