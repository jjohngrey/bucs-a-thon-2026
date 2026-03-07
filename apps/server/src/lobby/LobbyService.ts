import { randomUUID } from "node:crypto";
import type {
  LobbyCreatePayload,
  LobbyErrorPayload,
  LobbyJoinPayload,
  LobbyLeavePayload,
  LobbyReadyPayload,
  LobbyState,
  PlayerLobbyState,
} from "@bucs/shared";
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
