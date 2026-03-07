import type { LobbyState, PlayerLobbyState } from "@bucs/shared";

export type PlayerSession = {
  playerId: string;
  roomCode: string;
};

type LobbyRecord = {
  lobby: LobbyState;
  socketIdsByPlayerId: Map<string, string>;
};

export type RemovePlayerResult = {
  removed: boolean;
  playerId?: string;
  roomCode?: string;
  lobby?: LobbyState;
};

export class LobbyStore {
  private readonly lobbies = new Map<string, LobbyRecord>();
  private readonly sessionsBySocketId = new Map<string, PlayerSession>();

  hasLobby(roomCode: string): boolean {
    return this.lobbies.has(roomCode);
  }

  getLobby(roomCode: string): LobbyState | undefined {
    return this.lobbies.get(roomCode)?.lobby;
  }

  updateLobbyPhase(roomCode: string, phase: LobbyState["phase"]): LobbyState | undefined {
    const record = this.lobbies.get(roomCode);
    if (!record) {
      return undefined;
    }

    record.lobby.phase = phase;
    return record.lobby;
  }

  getSessionBySocketId(socketId: string): PlayerSession | undefined {
    return this.sessionsBySocketId.get(socketId);
  }

  createLobby(roomCode: string, hostPlayer: PlayerLobbyState, socketId: string): LobbyState {
    const lobby: LobbyState = {
      roomCode,
      hostPlayerId: hostPlayer.id,
      phase: "waiting",
      selectedStageId: null,
      players: [hostPlayer],
    };

    this.lobbies.set(roomCode, {
      lobby,
      socketIdsByPlayerId: new Map([[hostPlayer.id, socketId]]),
    });
    this.sessionsBySocketId.set(socketId, {
      playerId: hostPlayer.id,
      roomCode,
    });

    return lobby;
  }

  addPlayer(roomCode: string, player: PlayerLobbyState, socketId: string): LobbyState | undefined {
    const record = this.lobbies.get(roomCode);
    if (!record) {
      return undefined;
    }

    record.lobby.players.push(player);
    record.socketIdsByPlayerId.set(player.id, socketId);
    this.sessionsBySocketId.set(socketId, {
      playerId: player.id,
      roomCode,
    });

    return record.lobby;
  }

  setPlayerReady(roomCode: string, playerId: string, isReady: boolean): LobbyState | undefined {
    const record = this.lobbies.get(roomCode);
    if (!record) {
      return undefined;
    }

    const player = record.lobby.players.find((entry) => entry.id === playerId);
    if (!player) {
      return undefined;
    }

    player.isReady = isReady;
    return record.lobby;
  }

  resetLobbyForNextMatch(roomCode: string): LobbyState | undefined {
    const record = this.lobbies.get(roomCode);
    if (!record) {
      return undefined;
    }

    record.lobby.phase = "waiting";
    record.lobby.selectedStageId = null;
    record.lobby.players = record.lobby.players.map((player) => ({
      ...player,
      isReady: false,
      selectedCharacterId: null,
      presence: "connected",
    }));

    return record.lobby;
  }

  removePlayerBySocketId(socketId: string): RemovePlayerResult {
    const session = this.sessionsBySocketId.get(socketId);
    if (!session) {
      return { removed: false };
    }

    this.sessionsBySocketId.delete(socketId);

    const record = this.lobbies.get(session.roomCode);
    if (!record) {
      return { removed: false };
    }

    record.socketIdsByPlayerId.delete(session.playerId);
    record.lobby.players = record.lobby.players.filter((player) => player.id !== session.playerId);

    if (record.lobby.players.length === 0) {
      this.lobbies.delete(session.roomCode);
      return {
        removed: true,
        playerId: session.playerId,
        roomCode: session.roomCode,
      };
    }

    if (record.lobby.hostPlayerId === session.playerId) {
      const nextHostPlayerId = record.lobby.players[0].id;
      record.lobby.hostPlayerId = nextHostPlayerId;
      record.lobby.players = record.lobby.players.map((player) => ({
        ...player,
        isHost: player.id === nextHostPlayerId,
      }));
    }

    return {
      removed: true,
      playerId: session.playerId,
      roomCode: session.roomCode,
      lobby: record.lobby,
    };
  }
}
