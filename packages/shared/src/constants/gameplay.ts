export const MAX_PLAYERS_PER_MATCH = 4;
export const DEFAULT_STOCK_COUNT = 3;
export const DEFAULT_STAGE_ID = "rooftop";
export const DEFAULT_FLOOR_Y = 0;
export const DEFAULT_BLAST_ZONE_MIN_X = -200;
export const DEFAULT_BLAST_ZONE_MAX_X = 1400;
export const DEFAULT_BLAST_ZONE_MIN_Y = -400;
export const DEFAULT_BLAST_ZONE_MAX_Y = 900;
export const DEFAULT_GRAVITY_PER_TICK = 1.2;
export const DEFAULT_JUMP_VELOCITY = -14;
export const DEFAULT_ATTACK_DAMAGE = 12;
export const DEFAULT_ATTACK_RANGE = 72;
export const DEFAULT_ATTACK_HEIGHT = 48;
export const DEFAULT_KNOCKBACK_X = 10;
export const DEFAULT_KNOCKBACK_Y = -8;
export const DEFAULT_HITSTUN_TICKS = 8;
export const DEFAULT_KO_FALL_SPEED_PER_TICK = 30;
export const DEFAULT_RESPAWN_DURATION_MS = 2000;
export const DEFAULT_RESPAWN_TOP_BUFFER = 360;
export const DEFAULT_RESPAWN_INVULNERABILITY_MS = 1200;
export const DEFAULT_RESPAWN_PLATFORM_WIDTH = 170;

export const PLAYER_ACTIONS = {
  IDLE: "idle",
  RUN: "run",
  JUMP: "jump",
  FALL: "fall",
  ATTACK: "attack",
  HITSTUN: "hitstun",
  RESPAWN: "respawn",
  KO: "ko",
} as const;

export type PlayerAction =
  (typeof PLAYER_ACTIONS)[keyof typeof PLAYER_ACTIONS];
