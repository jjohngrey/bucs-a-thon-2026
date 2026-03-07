export const CLIENT_EVENTS = {
  LOBBY_CREATE: "lobby:create",
  LOBBY_JOIN: "lobby:join",
  LOBBY_LEAVE: "lobby:leave",
  LOBBY_READY: "lobby:ready",
  MATCH_SELECT_CHARACTER: "match:select-character",
  MATCH_SELECT_STAGE: "match:select-stage",
  MATCH_START: "match:start",
  MATCH_END: "match:end",
  MATCH_INPUT: "match:input",
} as const;

export const SERVER_EVENTS = {
  SESSION_JOINED: "session:joined",
  LOBBY_STATE: "lobby:state",
  LOBBY_ERROR: "lobby:error",
  MATCH_STARTING: "match:starting",
  MATCH_SNAPSHOT: "match:snapshot",
  MATCH_ENDED: "match:ended",
  PLAYER_DISCONNECTED: "player:disconnected",
} as const;
