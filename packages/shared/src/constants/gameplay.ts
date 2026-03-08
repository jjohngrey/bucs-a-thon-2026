export const MAX_PLAYERS_PER_MATCH = 4;
export const DEFAULT_STOCK_COUNT = 3;
export const DEFAULT_STAGE_ID = "rooftop";
export const DEFAULT_GRAVITY_PER_TICK = 1.2;
export const DEFAULT_JUMP_VELOCITY = -14;
export const DEFAULT_ATTACK_DAMAGE = 12;
export const DEFAULT_ATTACK_RANGE = 100;
export const DEFAULT_ATTACK_HEIGHT = 48;
export const DEFAULT_ATTACK_LAUNCH_ANGLE_DEGREES = 40;
export const DEFAULT_ATTACK_BASE_KNOCKBACK = 12;
export const DEFAULT_ATTACK_KNOCKBACK_GROWTH = 0.9;
export const DEFAULT_HITSTUN_TICKS = 8;
export const DEFAULT_ATTACK_COOLDOWN_TICKS = 10;
export const DEFAULT_KO_FALL_SPEED_PER_TICK = 30;
export const DEFAULT_KICK_DAMAGE = 16;
export const DEFAULT_KICK_RANGE = 112;
export const DEFAULT_KICK_HEIGHT = 24;
export const DEFAULT_KICK_LAUNCH_ANGLE_DEGREES = 18;
export const DEFAULT_KICK_BASE_KNOCKBACK = 15;
export const DEFAULT_KICK_KNOCKBACK_GROWTH = 1.1;
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
