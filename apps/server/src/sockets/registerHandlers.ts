import type {
  LobbyCreatePayload,
  LobbyJoinPayload,
  LobbyLeavePayload,
  LobbyReadyPayload,
  MatchStartPayload,
} from "@bucs/shared";
import { CLIENT_EVENTS, SERVER_EVENTS } from "@bucs/shared";
import type { Server, Socket } from "socket.io";
import { LobbyService } from "../lobby/LobbyService.js";
import { LobbyStore } from "../lobby/LobbyStore.js";
import { MatchService } from "../match/MatchService.js";
import { MatchStore } from "../match/MatchStore.js";

const lobbyStore = new LobbyStore();
const lobbyService = new LobbyService(lobbyStore);
const matchService = new MatchService(lobbyStore, new MatchStore());

type SocketServer = Server;
type ClientSocket = Socket;

export function registerSocketHandlers(io: SocketServer, socket: ClientSocket) {
  socket.on(CLIENT_EVENTS.LOBBY_CREATE, (payload: LobbyCreatePayload) => {
    const result = lobbyService.createLobby(socket.id, payload);
    if (!result.ok) {
      socket.emit(SERVER_EVENTS.LOBBY_ERROR, result.error);
      return;
    }

    socket.join(result.value.roomCode);
    socket.emit(SERVER_EVENTS.SESSION_JOINED, {
      playerId: result.value.playerId,
    });
    io.to(result.value.roomCode).emit(SERVER_EVENTS.LOBBY_STATE, {
      lobby: result.value.lobby,
    });
  });

  socket.on(CLIENT_EVENTS.LOBBY_JOIN, (payload: LobbyJoinPayload) => {
    const result = lobbyService.joinLobby(socket.id, payload);
    if (!result.ok) {
      socket.emit(SERVER_EVENTS.LOBBY_ERROR, result.error);
      return;
    }

    socket.join(result.value.roomCode);
    socket.emit(SERVER_EVENTS.SESSION_JOINED, {
      playerId: result.value.playerId,
    });
    io.to(result.value.roomCode).emit(SERVER_EVENTS.LOBBY_STATE, {
      lobby: result.value.lobby,
    });
  });

  socket.on(CLIENT_EVENTS.LOBBY_LEAVE, (payload: LobbyLeavePayload) => {
    const result = lobbyService.leaveLobby(socket.id, payload);
    if (!result.ok) {
      socket.emit(SERVER_EVENTS.LOBBY_ERROR, result.error);
      return;
    }

    matchService.cleanupMatchForRoom(result.value.roomCode);
    socket.leave(result.value.roomCode);

    if (result.value.lobby) {
      io.to(result.value.roomCode).emit(SERVER_EVENTS.LOBBY_STATE, {
        lobby: result.value.lobby,
      });
    }
  });

  socket.on(CLIENT_EVENTS.LOBBY_READY, (payload: LobbyReadyPayload) => {
    const result = lobbyService.setReady(socket.id, payload);
    if (!result.ok) {
      socket.emit(SERVER_EVENTS.LOBBY_ERROR, result.error);
      return;
    }

    io.to(result.value.roomCode).emit(SERVER_EVENTS.LOBBY_STATE, {
      lobby: result.value.lobby,
    });
  });

  socket.on(CLIENT_EVENTS.MATCH_START, (payload: MatchStartPayload) => {
    const result = matchService.startMatch(socket.id, payload);
    if (!result.ok) {
      socket.emit(SERVER_EVENTS.LOBBY_ERROR, result.error);
      return;
    }

    const lobby = lobbyStore.getLobby(result.value.match.roomCode);
    if (lobby) {
      io.to(result.value.match.roomCode).emit(SERVER_EVENTS.LOBBY_STATE, {
        lobby,
      });
    }

    io.to(result.value.match.roomCode).emit(SERVER_EVENTS.MATCH_STARTING, result.value.startEvent);

    matchService.scheduleMatchActivation(
      result.value.match.roomCode,
      result.value.startEvent.countdownMs,
      ({ roomCode }) => {
        const updatedLobby = lobbyStore.getLobby(roomCode);
        if (!updatedLobby) {
          return;
        }

        io.to(roomCode).emit(SERVER_EVENTS.LOBBY_STATE, {
          lobby: updatedLobby,
        });
      },
    );
  });

  socket.onAny((eventName, payload) => {
    console.log("[socket:event]", {
      socketId: socket.id,
      eventName,
      payload,
    });
  });

  socket.on("disconnect", (reason) => {
    console.log("[socket:disconnect]", {
      socketId: socket.id,
      reason,
    });

    const result = lobbyService.leaveLobby(socket.id);
    if (!result.ok) {
      return;
    }

    matchService.cleanupMatchForRoom(result.value.roomCode);

    if (!result.value.lobby) {
      return;
    }

    io.to(result.value.roomCode).emit(SERVER_EVENTS.LOBBY_STATE, {
      lobby: result.value.lobby,
    });
  });
}
