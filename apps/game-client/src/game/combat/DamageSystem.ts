import { MatchState } from "../states/MatchState";
import { ATTACK_DEFINITIONS } from "./AttackSystem";
import { ActiveHitbox, DamageHitEvent } from "./CombatTypes";

interface DamageSystemConfig {
  hurtboxWidth: number;
  hurtboxHeight: number;
}

const DEFAULT_CONFIG: DamageSystemConfig = {
  hurtboxWidth: 44,
  hurtboxHeight: 80
};

export interface DamageSystemContext {
  deltaMs: number;
  matchState: MatchState;
  activeHitboxes: ActiveHitbox[];
}

export class DamageSystem {
  private readonly config: DamageSystemConfig;
  private readonly hitTargetsByAttacker: Record<string, Set<string>> = {};

  constructor(config: Partial<DamageSystemConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config
    };
  }

  update(context: DamageSystemContext): DamageHitEvent[] {
    void context.deltaMs;
    const { matchState, activeHitboxes } = context;
    if (matchState.phase === "finished") {
      return [];
    }

    const damageHitEvents: DamageHitEvent[] = [];
    resetInactiveAttackers(matchState, this.hitTargetsByAttacker);

    for (const hitbox of activeHitboxes) {
      const attacker = matchState.playersById[hitbox.ownerPlayerId];
      if (!attacker || attacker.isOutOfPlay || attacker.stocks <= 0) {
        continue;
      }

      const attackDefinition = ATTACK_DEFINITIONS[hitbox.attackId];
      if (!attackDefinition) {
        continue;
      }

      const hitTargets = (this.hitTargetsByAttacker[hitbox.ownerPlayerId] ??= new Set<string>());

      for (const targetPlayerId of matchState.playerOrder) {
        if (targetPlayerId === hitbox.ownerPlayerId || hitTargets.has(targetPlayerId)) {
          continue;
        }

        const target = matchState.playersById[targetPlayerId];
        if (
          !target ||
          target.isOutOfPlay ||
          target.stocks <= 0 ||
          target.respawnInvulnerabilityMs > 0
        ) {
          continue;
        }

        if (!intersectsPlayerHurtbox(hitbox, target.position.x, target.position.y, this.config)) {
          continue;
        }

        target.damage += attackDefinition.damagePercent;
        target.currentAction = "hitstun";
        hitTargets.add(targetPlayerId);
        damageHitEvents.push({
          attackerPlayerId: hitbox.ownerPlayerId,
          targetPlayerId,
          attackId: hitbox.attackId
        });
      }
    }

    return damageHitEvents;
  }
}

function resetInactiveAttackers(
  matchState: MatchState,
  hitTargetsByAttacker: Record<string, Set<string>>
): void {
  for (const playerId of matchState.playerOrder) {
    const player = matchState.playersById[playerId];
    if (!player || player.attackState.phase !== "active" || !player.attackState.attackId) {
      delete hitTargetsByAttacker[playerId];
    }
  }
}

function intersectsPlayerHurtbox(
  hitbox: ActiveHitbox,
  playerX: number,
  playerY: number,
  config: DamageSystemConfig
): boolean {
  const hurtboxX = playerX - config.hurtboxWidth / 2;
  const hurtboxY = playerY - config.hurtboxHeight;

  return (
    hitbox.x < hurtboxX + config.hurtboxWidth &&
    hitbox.x + hitbox.width > hurtboxX &&
    hitbox.y < hurtboxY + config.hurtboxHeight &&
    hitbox.y + hitbox.height > hurtboxY
  );
}
