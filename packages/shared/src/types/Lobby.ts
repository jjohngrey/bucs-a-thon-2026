import type { PlayerLobbyState } from "./Player.js";

export type LobbyPhase =
  | "waiting"
  | "character-select"
  | "starting"
  | "in-match"
  | "finished";

export type LobbyState = {
  roomCode: string;
  hostPlayerId: string;
  phase: LobbyPhase;
  selectedStageId: string | null;
  players: PlayerLobbyState[];
};
