import { randomUUID } from "node:crypto";
import type {
  LobbyCreatePayload,
  LobbyErrorPayload,
  LobbyJoinPayload,
  LobbyLeavePayload,
  LobbyReturnPayload,
  LobbyReadyPayload,
  LobbyState,
  MatchSelectCharacterPayload,
  MatchSelectStagePayload,
  PlayerLobbyState,
} from "@bucs/shared";
import { STAGES } from "@bucs/shared";
import { LobbyStore } from "./LobbyStore.js";
import { generateRoomCode, normalizeRoomCode } from "./RoomCode.js";

type ServiceError = {
  ok: false;
  error: LobbyErrorPayload;
};

type ServiceSuccess<T> = {
  ok: true;
  value: T;
};

export type ServiceResult<T> = ServiceError | ServiceSuccess<T>;

export type CreateOrJoinLobbyResult = {
  playerId: string;
  roomCode: string;
  lobby: LobbyState;
};

export type LeaveLobbyResult = {
  playerId: string;
  roomCode: string;
  lobby?: LobbyState;
};

export class LobbyService {
  constructor(private readonly lobbyStore: LobbyStore) {}

  createLobby(socketId: string, payload: LobbyCreatePayload): ServiceResult<CreateOrJoinLobbyResult> {
    if (this.lobbyStore.getSessionBySocketId(socketId)) {
      return failure("ALREADY_IN_LOBBY", "Socket is already associated with a lobby.");
    }

    const playerId = randomUUID();
    const roomCode = generateRoomCode((candidate) => this.lobbyStore.hasLobby(candidate));
    const lobby = this.lobbyStore.createLobby(
      roomCode,
      createPlayer({
        playerId,
        displayName: payload.displayName,
        isHost: true,
      }),
      socketId,
    );

    return {
      ok: true,
      value: {
        playerId,
        roomCode,
        lobby,
      },
    };
  }

  joinLobby(socketId: string, payload: LobbyJoinPayload): ServiceResult<CreateOrJoinLobbyResult> {
    if (this.lobbyStore.getSessionBySocketId(socketId)) {
      return failure("ALREADY_IN_LOBBY", "Socket is already associated with a lobby.");
    }

    const roomCode = normalizeRoomCode(payload.roomCode);
    if (!this.lobbyStore.getLobby(roomCode)) {
      return failure("LOBBY_NOT_FOUND", "Lobby does not exist.");
    }

    const playerId = randomUUID();
    const lobby = this.lobbyStore.addPlayer(
      roomCode,
      createPlayer({
        playerId,
        displayName: payload.displayName,
        isHost: false,
      }),
      socketId,
    );

    if (!lobby) {
      return failure("JOIN_FAILED", "Unable to join lobby.");
    }

    return {
      ok: true,
      value: {
        playerId,
        roomCode,
        lobby,
      },
    };
  }

  leaveLobby(socketId: string, payload?: LobbyLeavePayload): ServiceResult<LeaveLobbyResult> {
    const session = this.lobbyStore.getSessionBySocketId(socketId);
    if (!session) {
      return failure("NOT_IN_LOBBY", "Socket is not associated with a lobby.");
    }

    if (payload && normalizeRoomCode(payload.roomCode) !== session.roomCode) {
      return failure("ROOM_MISMATCH", "Socket is not associated with that room.");
    }

    const result = this.lobbyStore.removePlayerBySocketId(socketId);
    if (!result.removed || !result.playerId || !result.roomCode) {
      return failure("LEAVE_FAILED", "Unable to leave lobby.");
    }

    return {
      ok: true,
      value: {
        playerId: result.playerId,
        roomCode: result.roomCode,
        lobby: result.lobby,
      },
    };
  }

  setReady(socketId: string, payload: LobbyReadyPayload): ServiceResult<CreateOrJoinLobbyResult> {
    const session = this.lobbyStore.getSessionBySocketId(socketId);
    if (!session) {
      return failure("NOT_IN_LOBBY", "Socket is not associated with a lobby.");
    }

    const roomCode = normalizeRoomCode(payload.roomCode);
    if (roomCode !== session.roomCode) {
      return failure("ROOM_MISMATCH", "Socket is not associated with that room.");
    }

    const lobby = this.lobbyStore.setPlayerReady(roomCode, session.playerId, payload.isReady);
    if (!lobby) {
      return failure("READY_FAILED", "Unable to update ready state.");
    }

    return {
      ok: true,
      value: {
        playerId: session.playerId,
        roomCode,
        lobby,
      },
    };
  }

  selectCharacter(
    socketId: string,
    payload: MatchSelectCharacterPayload,
  ): ServiceResult<CreateOrJoinLobbyResult> {
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

    if (lobby.phase !== "waiting" && lobby.phase !== "character-select") {
      return failure("INVALID_LOBBY_PHASE", "Character selection is only allowed before match start.");
    }

    const characterId = payload.characterId.trim();
    if (!characterId) {
      return failure("INVALID_CHARACTER", "Character id is required.");
    }

    const updatedLobby = this.lobbyStore.setPlayerCharacter(roomCode, session.playerId, characterId);
    if (!updatedLobby) {
      return failure("CHARACTER_SELECT_FAILED", "Unable to update selected character.");
    }

    return {
      ok: true,
      value: {
        playerId: session.playerId,
        roomCode,
        lobby: updatedLobby,
      },
    };
  }

  selectStage(
    socketId: string,
    payload: MatchSelectStagePayload,
  ): ServiceResult<CreateOrJoinLobbyResult> {
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
      return failure("HOST_ONLY", "Only the host can select the stage.");
    }

    if (lobby.phase !== "waiting" && lobby.phase !== "character-select") {
      return failure("INVALID_LOBBY_PHASE", "Stage selection is only allowed before match start.");
    }

    if (!STAGES[payload.stageId]) {
      return failure("INVALID_STAGE", "Stage does not exist.");
    }

    const updatedLobby = this.lobbyStore.setStage(roomCode, payload.stageId);
    if (!updatedLobby) {
      return failure("STAGE_SELECT_FAILED", "Unable to update selected stage.");
    }

    return {
      ok: true,
      value: {
        playerId: session.playerId,
        roomCode,
        lobby: updatedLobby,
      },
    };
  }

  returnToLobby(socketId: string, payload: LobbyReturnPayload): ServiceResult<CreateOrJoinLobbyResult> {
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
      return failure("HOST_ONLY", "Only the host can return the room to the lobby.");
    }

    if (lobby.phase !== "finished") {
      return failure("INVALID_LOBBY_PHASE", "Lobby must be finished before returning.");
    }

    const resetLobby = this.lobbyStore.resetLobbyForNextMatch(roomCode);
    if (!resetLobby) {
      return failure("RETURN_FAILED", "Unable to reset the lobby.");
    }

    return {
      ok: true,
      value: {
        playerId: session.playerId,
        roomCode,
        lobby: resetLobby,
      },
    };
  }
}

function createPlayer(input: {
  playerId: string;
  displayName: string;
  isHost: boolean;
}): PlayerLobbyState {
  const displayName = input.displayName.trim().slice(0, 24) || "Player";

  return {
    id: input.playerId,
    displayName,
    isHost: input.isHost,
    isReady: false,
    selectedCharacterId: null,
    presence: "connected",
  };
}

function failure(code: string, message: string): ServiceError {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  };
}
