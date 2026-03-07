import type { MatchInputPayload } from "../protocol/clientToServer.js";
import type { PlayerMatchState } from "./Player.js";

export type MatchPhase = "countdown" | "active" | "finished";

export type MatchSession = {
  roomCode: string;
  stageId: string;
  phase: MatchPhase;
  playerIds: string[];
};

export type MatchRuntimeState = {
  session: MatchSession;
  latestInputsByPlayerId: Record<string, MatchInputPayload["pressed"]>;
  previousInputsByPlayerId: Record<string, MatchInputPayload["pressed"]>;
  hitstunTicksByPlayerId: Record<string, number>;
  latestSnapshot: MatchSnapshot | null;
};

export type MatchSnapshot = {
  serverFrame: number;
  phase: MatchPhase;
  players: PlayerMatchState[];
};

export type MatchSummary = {
  winnerPlayerId: string | null;
  eliminatedPlayerIds: string[];
};
