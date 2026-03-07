import { MatchState, isOutsideBlastZone } from "../states/MatchState";

export interface StockSystemContext {
  deltaMs: number;
  matchState: MatchState;
}

export class StockSystem {
  update(context: StockSystemContext): void {
    void context.deltaMs;

    const { matchState } = context;
    if (matchState.phase === "finished") {
      return;
    }

    for (const playerId of matchState.playerOrder) {
      const player = matchState.playersById[playerId];
      if (!player || player.isOutOfPlay || player.stocks <= 0) {
        continue;
      }

      if (!isOutsideBlastZone(matchState.stage, player.position)) {
        continue;
      }

      player.stocks = Math.max(0, player.stocks - 1);
      player.isOutOfPlay = true;
      player.respawnTimerMs = player.stocks > 0 ? matchState.rules.respawnDurationMs : 0;
      player.respawnInvulnerabilityMs = 0;
      player.respawnPlatformCenterX = null;
      player.respawnPlatformY = null;
      player.respawnPlatformWidth = 0;
      player.currentAction = "ko";
      // Keep downward momentum so KO feels continuous rather than frozen.
      player.velocity = { x: 0, y: Math.max(player.velocity.y, 900) };
      player.grounded = false;
    }
  }
}
