import { cloneVector2, Vector2, ZERO_VECTOR } from "../../core/types/Vector2";

export type PlayerFacing = -1 | 1;

export const PLAYER_ACTIONS = [
  "idle",
  "run",
  "jump",
  "fall",
  "attack",
  "hitstun",
  "respawn",
  "ko"
] as const;

export type PlayerAction = (typeof PLAYER_ACTIONS)[number];

export type AttackPhase = "idle" | "startup" | "active" | "recovery";

export interface PlayerAttackState {
  attackId: string | null;
  phase: AttackPhase;
  phaseFrame: number;
}

export interface PlayerState {
  id: string;
  position: Vector2;
  velocity: Vector2;
  hurtboxSize: Vector2;
  renderSize: Vector2;
  facing: PlayerFacing;
  grounded: boolean;
  damage: number;
  stocks: number;
  isOutOfPlay: boolean;
  respawnTimerMs: number;
  respawnInvulnerabilityMs: number;
  respawnPlatformCenterX: number | null;
  respawnPlatformY: number | null;
  respawnPlatformWidth: number;
  attackState: PlayerAttackState;
  currentAction: PlayerAction;
}

export interface CreatePlayerStateInput {
  id: string;
  spawnPosition: Vector2;
  hurtboxSize?: Vector2;
  renderSize?: Vector2;
  facing?: PlayerFacing;
  startingStocks?: number;
}

const DEFAULT_STARTING_STOCKS = 3;
const DEFAULT_HURTBOX_SIZE: Vector2 = { x: 42, y: 64 };
const DEFAULT_RENDER_SIZE: Vector2 = { x: 42, y: 64 };

export function createPlayerState(input: CreatePlayerStateInput): PlayerState {
  return {
    id: input.id,
    position: cloneVector2(input.spawnPosition),
    velocity: cloneVector2(ZERO_VECTOR),
    hurtboxSize: cloneVector2(input.hurtboxSize ?? DEFAULT_HURTBOX_SIZE),
    renderSize: cloneVector2(input.renderSize ?? DEFAULT_RENDER_SIZE),
    facing: input.facing ?? 1,
    grounded: false,
    damage: 0,
    stocks: input.startingStocks ?? DEFAULT_STARTING_STOCKS,
    isOutOfPlay: false,
    respawnTimerMs: 0,
    respawnInvulnerabilityMs: 0,
    respawnPlatformCenterX: null,
    respawnPlatformY: null,
    respawnPlatformWidth: 0,
    attackState: {
      attackId: null,
      phase: "idle",
      phaseFrame: 0
    },
    currentAction: "idle"
  };
}

export function resetPlayerForRespawn(
  player: PlayerState,
  respawnPosition: Vector2,
  respawnInvulnerabilityMs = 0,
  respawnPlatformWidth = 0
): PlayerState {
  return {
    ...player,
    position: cloneVector2(respawnPosition),
    velocity: cloneVector2(ZERO_VECTOR),
    hurtboxSize: cloneVector2(player.hurtboxSize),
    renderSize: cloneVector2(player.renderSize),
    grounded: false,
    damage: 0,
    isOutOfPlay: false,
    respawnTimerMs: 0,
    respawnInvulnerabilityMs,
    respawnPlatformCenterX: respawnPosition.x,
    respawnPlatformY: respawnPosition.y,
    respawnPlatformWidth,
    attackState: {
      attackId: null,
      phase: "idle",
      phaseFrame: 0
    },
    currentAction: "respawn"
  };
}
