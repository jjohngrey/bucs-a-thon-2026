export const MAX_PLAYERS_PER_MATCH = 4;
export const DEFAULT_STOCK_COUNT = 3;
export const DEFAULT_STAGE_ID = "rooftop";

export const PLAYER_ACTIONS = {
  IDLE: "idle",
  RUN: "run",
  JUMP: "jump",
  FALL: "fall",
  ATTACK: "attack",
  HITSTUN: "hitstun",
  RESPAWN: "respawn",
} as const;

export type PlayerAction =
  (typeof PLAYER_ACTIONS)[keyof typeof PLAYER_ACTIONS];
