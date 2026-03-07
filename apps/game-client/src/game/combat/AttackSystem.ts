import { MatchState } from "../states/MatchState";
import { PlayerState } from "../states/PlayerState";

const FRAME_MS = 1000 / 60;
export const BASIC_ATTACK_ID = "jab";

export interface AttackDefinition {
  id: string;
  damagePercent: number;
  knockbackAngleDegrees: number;
  baseKnockback: number;
  knockbackGrowth: number;
  startupFrames: number;
  activeFrames: number;
  recoveryFrames: number;
  hitboxOffset: { x: number; y: number };
  hitboxSize: { x: number; y: number };
}

export const ATTACK_DEFINITIONS: Record<string, AttackDefinition> = {
  jab: {
    id: "jab",
    damagePercent: 3.5,
    knockbackAngleDegrees: 40,
    baseKnockback: 280,
    knockbackGrowth: 18,
    startupFrames: 5,
    activeFrames: 3,
    recoveryFrames: 12,
    hitboxOffset: { x: 36, y: 42 },
    hitboxSize: { x: 42, y: 24 }
  }
};

export interface AttackSystemContext {
  deltaMs: number;
  matchState: MatchState;
  attackPressedByPlayerId: Record<string, boolean>;
}

export class AttackSystem {
  private readonly previousAttackPressedByPlayerId: Record<string, boolean> = {};

  update(context: AttackSystemContext): void {
    const { deltaMs, matchState, attackPressedByPlayerId } = context;
    if (matchState.phase === "finished") {
      return;
    }

    const stepCount = Math.max(1, Math.round(deltaMs / FRAME_MS));

    for (const playerId of matchState.playerOrder) {
      const player = matchState.playersById[playerId];
      if (!player) {
        continue;
      }

      const isPressed = Boolean(attackPressedByPlayerId[playerId]);
      const wasPressed = Boolean(this.previousAttackPressedByPlayerId[playerId]);
      const justPressed = isPressed && !wasPressed;

      if (player.isOutOfPlay || player.stocks <= 0) {
        clearAttackState(player);
      } else {
        if (justPressed && player.attackState.phase === "idle") {
          startAttack(player, BASIC_ATTACK_ID);
        }

        for (let step = 0; step < stepCount; step += 1) {
          advanceAttackState(player);
        }
      }

      this.previousAttackPressedByPlayerId[playerId] = isPressed;
    }
  }
}

function startAttack(player: PlayerState, attackId: string): void {
  player.attackState.attackId = attackId;
  player.attackState.phase = "startup";
  player.attackState.phaseFrame = 0;
  player.currentAction = "attack";
}

function clearAttackState(player: PlayerState): void {
  player.attackState.attackId = null;
  player.attackState.phase = "idle";
  player.attackState.phaseFrame = 0;
}

function advanceAttackState(player: PlayerState): void {
  if (player.attackState.phase === "idle" || !player.attackState.attackId) {
    return;
  }

  const definition = ATTACK_DEFINITIONS[player.attackState.attackId];
  if (!definition) {
    clearAttackState(player);
    return;
  }

  player.attackState.phaseFrame += 1;

  if (player.attackState.phase === "startup" && player.attackState.phaseFrame >= definition.startupFrames) {
    player.attackState.phase = "active";
    player.attackState.phaseFrame = 0;
    return;
  }

  if (player.attackState.phase === "active" && player.attackState.phaseFrame >= definition.activeFrames) {
    player.attackState.phase = "recovery";
    player.attackState.phaseFrame = 0;
    return;
  }

  if (player.attackState.phase === "recovery" && player.attackState.phaseFrame >= definition.recoveryFrames) {
    clearAttackState(player);
    if (player.currentAction === "attack") {
      player.currentAction = player.grounded ? "idle" : "fall";
    }
  }
}
