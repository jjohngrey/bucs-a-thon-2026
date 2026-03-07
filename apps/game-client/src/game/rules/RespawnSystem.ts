import { resetPlayerForRespawn } from "../states/PlayerState";
import { MatchState } from "../states/MatchState";

const KO_FALL_SPEED_PER_SECOND = 900;

export interface RespawnSystemContext {
  deltaMs: number;
  matchState: MatchState;
}

export class RespawnSystem {
  update(context: RespawnSystemContext): void {
    const { deltaMs, matchState } = context;
    if (matchState.phase === "finished") {
      return;
    }

    const deltaSeconds = Math.max(0, deltaMs / 1000);

    for (const playerId of matchState.playerOrder) {
      const player = matchState.playersById[playerId];
      if (!player) {
        continue;
      }

      if (player.respawnInvulnerabilityMs > 0) {
        player.respawnInvulnerabilityMs = Math.max(0, player.respawnInvulnerabilityMs - deltaMs);
        if (player.respawnInvulnerabilityMs === 0) {
          player.respawnPlatformCenterX = null;
          player.respawnPlatformY = null;
          player.respawnPlatformWidth = 0;
          if (player.currentAction === "respawn") {
            player.currentAction = "fall";
          }
        }
      }

      if (!player.isOutOfPlay || player.stocks <= 0) {
        continue;
      }

      // During KO timeout, keep the player falling so they visibly travel off-screen.
      player.position.y += Math.max(player.velocity.y, KO_FALL_SPEED_PER_SECOND) * deltaSeconds;

      player.respawnTimerMs = Math.max(0, player.respawnTimerMs - deltaMs);
      if (player.respawnTimerMs > 0) {
        continue;
      }

      matchState.playersById[playerId] = resetPlayerForRespawn(
        player,
        getCenterRespawnPoint(matchState),
        matchState.rules.respawnInvulnerabilityMs,
        matchState.rules.respawnPlatformWidth
      );
    }
  }
}

function getCenterRespawnPoint(matchState: MatchState): { x: number; y: number } {
  const centerX = (matchState.stage.blastZoneMin.x + matchState.stage.blastZoneMax.x) / 2;
  const topPlatformY = matchState.stage.platforms.reduce<number | null>((current, platform) => {
    if (current === null) {
      return platform.position.y;
    }
    return Math.min(current, platform.position.y);
  }, null);

  const baseY = topPlatformY ?? (matchState.stage.blastZoneMin.y + matchState.stage.blastZoneMax.y) / 2;
  return {
    x: centerX,
    y: baseY - matchState.rules.respawnTopBuffer
  };
}
