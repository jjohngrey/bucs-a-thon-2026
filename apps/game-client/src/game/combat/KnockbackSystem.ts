import { MatchState } from "../states/MatchState";
import { ATTACK_DEFINITIONS } from "./AttackSystem";
import { DamageHitEvent } from "./CombatTypes";

export interface KnockbackSystemContext {
  deltaMs: number;
  matchState: MatchState;
  damageHitEvents: DamageHitEvent[];
}

export class KnockbackSystem {
  update(context: KnockbackSystemContext): void {
    void context.deltaMs;
    const { matchState, damageHitEvents } = context;
    if (matchState.phase === "finished") {
      return;
    }

    for (const hitEvent of damageHitEvents) {
      const attacker = matchState.playersById[hitEvent.attackerPlayerId];
      if (!attacker || attacker.isOutOfPlay || attacker.stocks <= 0) {
        continue;
      }

      const target = matchState.playersById[hitEvent.targetPlayerId];
      if (!target || target.isOutOfPlay || target.stocks <= 0) {
        continue;
      }

      const attackDefinition = ATTACK_DEFINITIONS[hitEvent.attackId];
      if (!attackDefinition) {
        continue;
      }

      const totalKnockback = calculateKnockbackMagnitude(
        target.damage,
        attackDefinition.baseKnockback,
        attackDefinition.knockbackGrowth
      );
      const launchVector = getLaunchVector(
        attackDefinition.knockbackAngleDegrees,
        attacker.position.x,
        target.position.x
      );

      target.velocity.x = launchVector.x * totalKnockback;
      target.velocity.y = launchVector.y * totalKnockback;
      target.grounded = false;
      target.currentAction = "hitstun";
    }
  }
}

function calculateKnockbackMagnitude(
  targetDamagePercent: number,
  baseKnockback: number,
  knockbackGrowth: number
): number {
  const safeDamage = Math.max(0, targetDamagePercent);
  return baseKnockback + knockbackGrowth * Math.sqrt(safeDamage);
}

function getLaunchVector(angleDegrees: number, attackerX: number, targetX: number): { x: number; y: number } {
  const radians = (angleDegrees * Math.PI) / 180;
  const direction = targetX >= attackerX ? 1 : -1;

  return {
    x: Math.cos(radians) * direction,
    y: -Math.sin(radians)
  };
}
