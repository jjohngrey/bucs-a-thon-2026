import { MatchState } from "../states/MatchState";

interface MoveSystemConfig {
  moveSpeedPerSecond: number;
}

const DEFAULT_CONFIG: MoveSystemConfig = {
  moveSpeedPerSecond: 360
};

export interface MoveSystemContext {
  deltaMs: number;
  matchState: MatchState;
  moveDirectionByPlayerId: Partial<Record<string, -1 | 0 | 1>>;
}

export class MoveSystem {
  private readonly config: MoveSystemConfig;

  constructor(config: Partial<MoveSystemConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config
    };
  }

  update(context: MoveSystemContext): void {
    void context.deltaMs;
    const { matchState, moveDirectionByPlayerId } = context;
    if (matchState.phase === "finished") {
      return;
    }

    for (const playerId of matchState.playerOrder) {
      const player = matchState.playersById[playerId];
      if (!player || player.isOutOfPlay || player.stocks <= 0) {
        continue;
      }

      const direction = moveDirectionByPlayerId[playerId] ?? 0;
      player.velocity.x = direction * this.config.moveSpeedPerSecond;

      if (direction === 0) {
        if (player.grounded && player.currentAction === "run") {
          player.currentAction = "idle";
        }
      } else {
        player.facing = direction;
        if (player.grounded) {
          player.currentAction = "run";
        }
      }

      player.position.x += player.velocity.x * Math.max(0, context.deltaMs / 1000);
    }
  }
}
