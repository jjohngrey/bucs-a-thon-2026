import type { LobbyState } from "../types/Lobby.js";
import type { MatchSnapshot, MatchSummary } from "../types/Match.js";

export type SessionJoinedPayload = {
  playerId: string;
};

export type LobbyStatePayload = {
  lobby: LobbyState;
};

export type LobbyErrorPayload = {
  code: string;
  message: string;
};

export type MatchStartingPayload = {
  roomCode: string;
  stageId: string;
  playerIds: string[];
  countdownMs: number;
};

export type MatchSnapshotPayload = {
  roomCode: string;
  snapshot: MatchSnapshot;
};

export type MatchEndedPayload = {
  roomCode: string;
  summary: MatchSummary;
};

export type PlayerDisconnectedPayload = {
  roomCode: string;
  playerId: string;
};
