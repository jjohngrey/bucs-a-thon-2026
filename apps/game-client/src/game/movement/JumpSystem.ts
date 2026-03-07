import { MatchState } from "../states/MatchState";

interface JumpSystemConfig {
  jumpVelocity: number;
}

const DEFAULT_CONFIG: JumpSystemConfig = {
  jumpVelocity: 900
};

export interface JumpSystemContext {
  deltaMs: number;
  matchState: MatchState;
  jumpPressedByPlayerId: Partial<Record<string, boolean>>;
}

export class JumpSystem {
  private readonly config: JumpSystemConfig;

  constructor(config: Partial<JumpSystemConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config
    };
  }

  update(context: JumpSystemContext): void {
    void context.deltaMs;
    const { matchState, jumpPressedByPlayerId } = context;
    if (matchState.phase === "finished") {
      return;
    }

    for (const playerId of matchState.playerOrder) {
      if (!jumpPressedByPlayerId[playerId]) {
        continue;
      }

      const player = matchState.playersById[playerId];
      if (!player || player.isOutOfPlay || player.stocks <= 0 || !player.grounded) {
        continue;
      }

      player.grounded = false;
      player.velocity.y = -this.config.jumpVelocity;
      player.currentAction = "jump";
    }
  }
}
