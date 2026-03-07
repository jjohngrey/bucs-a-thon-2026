import type {
  MatchEndPayload,
  LobbyCreatePayload,
  LobbyJoinPayload,
  LobbyLeavePayload,
  LobbyReadyPayload,
  MatchInputPayload,
  MatchSelectCharacterPayload,
  MatchSelectStagePayload,
  MatchStartPayload,
} from "./clientToServer.js";
import { CLIENT_EVENTS, SERVER_EVENTS } from "./eventNames.js";
import type {
  LobbyErrorPayload,
  LobbyStatePayload,
  MatchEndedPayload,
  MatchSnapshotPayload,
  MatchStartingPayload,
  PlayerDisconnectedPayload,
  SessionJoinedPayload,
} from "./serverToClient.js";

export type ClientToServerEventMap = {
  [CLIENT_EVENTS.LOBBY_CREATE]: (payload: LobbyCreatePayload) => void;
  [CLIENT_EVENTS.LOBBY_JOIN]: (payload: LobbyJoinPayload) => void;
  [CLIENT_EVENTS.LOBBY_LEAVE]: (payload: LobbyLeavePayload) => void;
  [CLIENT_EVENTS.LOBBY_READY]: (payload: LobbyReadyPayload) => void;
  [CLIENT_EVENTS.MATCH_SELECT_CHARACTER]: (payload: MatchSelectCharacterPayload) => void;
  [CLIENT_EVENTS.MATCH_SELECT_STAGE]: (payload: MatchSelectStagePayload) => void;
  [CLIENT_EVENTS.MATCH_START]: (payload: MatchStartPayload) => void;
  [CLIENT_EVENTS.MATCH_END]: (payload: MatchEndPayload) => void;
  [CLIENT_EVENTS.MATCH_INPUT]: (payload: MatchInputPayload) => void;
};

export type ServerToClientEventMap = {
  [SERVER_EVENTS.SESSION_JOINED]: (payload: SessionJoinedPayload) => void;
  [SERVER_EVENTS.LOBBY_STATE]: (payload: LobbyStatePayload) => void;
  [SERVER_EVENTS.LOBBY_ERROR]: (payload: LobbyErrorPayload) => void;
  [SERVER_EVENTS.MATCH_STARTING]: (payload: MatchStartingPayload) => void;
  [SERVER_EVENTS.MATCH_SNAPSHOT]: (payload: MatchSnapshotPayload) => void;
  [SERVER_EVENTS.MATCH_ENDED]: (payload: MatchEndedPayload) => void;
  [SERVER_EVENTS.PLAYER_DISCONNECTED]: (payload: PlayerDisconnectedPayload) => void;
};
