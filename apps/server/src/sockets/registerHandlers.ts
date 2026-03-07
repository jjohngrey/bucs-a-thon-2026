import type {
  LobbyCreatePayload,
  LobbyJoinPayload,
  LobbyLeavePayload,
  LobbyReturnPayload,
  LobbyReadyPayload,
  MatchEndPayload,
  MatchInputPayload,
  MatchSelectCharacterPayload,
  MatchSelectStagePayload,
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

    const departureMatchResult = matchService.endMatchForDeparture(
      result.value.roomCode,
      result.value.playerId,
    );
    if (!departureMatchResult) {
      matchService.cleanupMatchForRoom(result.value.roomCode);
    }
    socket.leave(result.value.roomCode);

    if (result.value.lobby) {
      io.to(result.value.roomCode).emit(SERVER_EVENTS.LOBBY_STATE, {
        lobby: result.value.lobby,
      });
    }

    if (departureMatchResult) {
      io.to(departureMatchResult.roomCode).emit(SERVER_EVENTS.MATCH_ENDED, {
        roomCode: departureMatchResult.roomCode,
        summary: departureMatchResult.summary,
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

  socket.on(CLIENT_EVENTS.MATCH_SELECT_CHARACTER, (payload: MatchSelectCharacterPayload) => {
    const result = lobbyService.selectCharacter(socket.id, payload);
    if (!result.ok) {
      socket.emit(SERVER_EVENTS.LOBBY_ERROR, result.error);
      return;
    }

    io.to(result.value.roomCode).emit(SERVER_EVENTS.LOBBY_STATE, {
      lobby: result.value.lobby,
    });
  });

  socket.on(CLIENT_EVENTS.MATCH_SELECT_STAGE, (payload: MatchSelectStagePayload) => {
    const result = lobbyService.selectStage(socket.id, payload);
    if (!result.ok) {
      socket.emit(SERVER_EVENTS.LOBBY_ERROR, result.error);
      return;
    }

    io.to(result.value.roomCode).emit(SERVER_EVENTS.LOBBY_STATE, {
      lobby: result.value.lobby,
    });
  });

  socket.on(CLIENT_EVENTS.LOBBY_RETURN, (payload: LobbyReturnPayload) => {
    const result = lobbyService.returnToLobby(socket.id, payload);
    if (!result.ok) {
      socket.emit(SERVER_EVENTS.LOBBY_ERROR, result.error);
      return;
    }

    matchService.cleanupMatchForRoom(result.value.roomCode);
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
      ({ roomCode, snapshot }) => {
        const updatedLobby = lobbyStore.getLobby(roomCode);
        if (!updatedLobby) {
          return;
        }

        io.to(roomCode).emit(SERVER_EVENTS.LOBBY_STATE, {
          lobby: updatedLobby,
        });
        io.to(roomCode).emit(SERVER_EVENTS.MATCH_SNAPSHOT, {
          roomCode,
          snapshot,
        });
        matchService.startSnapshotLoop(
          roomCode,
          ({ roomCode: activeRoomCode, snapshot: nextSnapshot }) => {
            io.to(activeRoomCode).emit(SERVER_EVENTS.MATCH_SNAPSHOT, {
              roomCode: activeRoomCode,
              snapshot: nextSnapshot,
            });
          },
          ({ roomCode: endedRoomCode, summary }) => {
            const finishedLobby = lobbyStore.getLobby(endedRoomCode);
            if (finishedLobby) {
              io.to(endedRoomCode).emit(SERVER_EVENTS.LOBBY_STATE, {
                lobby: finishedLobby,
              });
            }

            io.to(endedRoomCode).emit(SERVER_EVENTS.MATCH_ENDED, {
              roomCode: endedRoomCode,
              summary,
            });
          });
      },
    );
  });

  socket.on(CLIENT_EVENTS.MATCH_INPUT, (payload: MatchInputPayload) => {
    const result = matchService.submitInput(socket.id, payload);
    if (!result.ok) {
      socket.emit(SERVER_EVENTS.LOBBY_ERROR, result.error);
    }
  });

  socket.on(CLIENT_EVENTS.MATCH_END, (payload: MatchEndPayload) => {
    const result = matchService.endMatch(socket.id, payload);
    if (!result.ok) {
      socket.emit(SERVER_EVENTS.LOBBY_ERROR, result.error);
      return;
    }

    const updatedLobby = lobbyStore.getLobby(result.value.roomCode);
    if (updatedLobby) {
      io.to(result.value.roomCode).emit(SERVER_EVENTS.LOBBY_STATE, {
        lobby: updatedLobby,
      });
    }

    io.to(result.value.roomCode).emit(SERVER_EVENTS.MATCH_ENDED, {
      roomCode: result.value.roomCode,
      summary: result.value.summary,
    });
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

    const departureMatchResult = matchService.endMatchForDeparture(
      result.value.roomCode,
      result.value.playerId,
    );
    if (!departureMatchResult) {
      matchService.cleanupMatchForRoom(result.value.roomCode);
    }

    if (!result.value.lobby) {
      return;
    }

    io.to(result.value.roomCode).emit(SERVER_EVENTS.LOBBY_STATE, {
      lobby: result.value.lobby,
    });

    if (departureMatchResult) {
      io.to(departureMatchResult.roomCode).emit(SERVER_EVENTS.MATCH_ENDED, {
        roomCode: departureMatchResult.roomCode,
        summary: departureMatchResult.summary,
      });
    }
  });
}
