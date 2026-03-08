export const MAX_PLAYERS_PER_MATCH = 4;
export const DEFAULT_STOCK_COUNT = 3;
export const DEFAULT_STAGE_ID = "rooftop";
export const DEFAULT_GRAVITY_PER_TICK = 1.2;
export const DEFAULT_JUMP_VELOCITY = -14;
export const DEFAULT_ATTACK_DAMAGE = 12;
export const DEFAULT_ATTACK_RANGE = 100;
export const DEFAULT_ATTACK_HEIGHT = 48;
export const DEFAULT_ATTACK_LAUNCH_ANGLE_DEGREES = 32;
export const DEFAULT_ATTACK_BASE_KNOCKBACK = 10;
export const DEFAULT_ATTACK_KNOCKBACK_GROWTH = 0.8;
export const DEFAULT_HITSTUN_TICKS = 8;
export const DEFAULT_ATTACK_COOLDOWN_TICKS = 10;
export const DEFAULT_KO_FALL_SPEED_PER_TICK = 30;
export const DEFAULT_KICK_DAMAGE = 14;
export const DEFAULT_KICK_RANGE = 104;
export const DEFAULT_KICK_HEIGHT = 34;
export const DEFAULT_KICK_LAUNCH_ANGLE_DEGREES = 12;
export const DEFAULT_KICK_BASE_KNOCKBACK = 13;
export const DEFAULT_KICK_KNOCKBACK_GROWTH = 0.9;
export const DEFAULT_KICK_HITSTUN_TICKS = 10;
export const DEFAULT_KICK_COOLDOWN_TICKS = 20;

export const PLAYER_ACTIONS = {
  IDLE: "idle",
  RUN: "run",
  JUMP: "jump",
  FALL: "fall",
  ATTACK: "attack",
  HITSTUN: "hitstun",
  RESPAWN: "respawn",
  KO: "ko",
  KICK: "kick",
} as const;

export type PlayerAction =
  (typeof PLAYER_ACTIONS)[keyof typeof PLAYER_ACTIONS];
