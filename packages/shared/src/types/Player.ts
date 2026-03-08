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
  grounded: boolean;
  damage: number;
  stocks: number;
  isOutOfPlay: boolean;
  respawnTimerMs: number;
  respawnInvulnerabilityMs: number;
  respawnPlatformCenterX: number | null;
  respawnPlatformY: number | null;
  respawnPlatformWidth: number;
  specialChargeMs: number;
  facing: FacingDirection;
  action: PlayerAction;
};
