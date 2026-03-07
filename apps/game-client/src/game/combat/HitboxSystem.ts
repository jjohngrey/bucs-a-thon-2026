import { MatchState } from "../states/MatchState";
import { ATTACK_DEFINITIONS, BASIC_ATTACK_ID } from "./AttackSystem";
import { ActiveHitbox } from "./CombatTypes";

export interface HitboxSystemContext {
  deltaMs: number;
  matchState: MatchState;
}

export class HitboxSystem {
  private activeHitboxes: ActiveHitbox[] = [];

  update(context: HitboxSystemContext): void {
    void context.deltaMs;
    this.activeHitboxes = buildActiveHitboxes(context.matchState);
  }

  getActiveHitboxes(): ActiveHitbox[] {
    return this.activeHitboxes;
  }
}

function buildActiveHitboxes(matchState: MatchState): ActiveHitbox[] {
  const output: ActiveHitbox[] = [];

  for (const playerId of matchState.playerOrder) {
    const player = matchState.playersById[playerId];
    if (!player || player.isOutOfPlay || player.attackState.phase !== "active") {
      continue;
    }

    const attackId = player.attackState.attackId;
    if (!attackId || attackId !== BASIC_ATTACK_ID) {
      continue;
    }

    const definition = ATTACK_DEFINITIONS[attackId];
    if (!definition) {
      continue;
    }

    const centerX = player.position.x + definition.hitboxOffset.x * player.facing;
    const centerY = player.position.y - definition.hitboxOffset.y;

    output.push({
      ownerPlayerId: playerId,
      attackId,
      x: centerX - definition.hitboxSize.x / 2,
      y: centerY - definition.hitboxSize.y / 2,
      width: definition.hitboxSize.x,
      height: definition.hitboxSize.y
    });
  }

  return output;
}
