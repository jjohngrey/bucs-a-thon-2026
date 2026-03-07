import type { PlayerAction } from "../constants/gameplay.js";

export type FacingDirection = "left" | "right";

export type PlayerPresence = "connected" | "disconnected";

export type PlayerPosition = {
  x: number;
  y: number;
};

export type PlayerVelocity = {
  x: number;
  y: number;
};

export type PlayerLobbyState = {
  id: string;
  displayName: string;
  isHost: boolean;
  isReady: boolean;
  selectedCharacterId: string | null;
  presence: PlayerPresence;
};

export type PlayerMatchState = {
  id: string;
  displayName: string;
  characterId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  stocks: number;
  facing: FacingDirection;
  action: PlayerAction;
};
