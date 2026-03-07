import { PlayerAction } from "../states/PlayerState";
import { MatchState, StagePlatform } from "../states/MatchState";

const MS_PER_SECOND = 1000;
const GROUND_EPSILON = 0.001;

interface GravitySystemConfig {
  gravityPerSecond: number;
  maxFallSpeed: number;
}

const DEFAULT_CONFIG: GravitySystemConfig = {
  gravityPerSecond: 2200,
  maxFallSpeed: 1400
};

export interface GravitySystemContext {
  deltaMs: number;
  matchState: MatchState;
}

export class GravitySystem {
  private readonly config: GravitySystemConfig;

  constructor(config: Partial<GravitySystemConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config
    };
  }

  update(context: GravitySystemContext): void {
    const { deltaMs, matchState } = context;
    if (matchState.phase === "finished") {
      return;
    }

    const deltaSeconds = Math.max(0, deltaMs / MS_PER_SECOND);
    if (deltaSeconds === 0) {
      return;
    }

    for (const playerId of matchState.playerOrder) {
      const player = matchState.playersById[playerId];
      if (!player || player.isOutOfPlay || player.stocks <= 0) {
        continue;
      }

      const respawnPlatform = getRespawnPlatform(player);
      if (respawnPlatform && player.respawnInvulnerabilityMs > 0) {
        const left = respawnPlatform.centerX - respawnPlatform.width / 2;
        const right = respawnPlatform.centerX + respawnPlatform.width / 2;
        const onRespawnPlatform = player.position.x >= left && player.position.x <= right;
        if (onRespawnPlatform) {
          player.position.y = respawnPlatform.y;
          player.velocity.y = 0;
          player.grounded = true;
          if (player.currentAction === "fall" || player.currentAction === "jump") {
            player.currentAction = "respawn";
          }
          continue;
        }
      }

      if (player.grounded) {
        if (!isStandingOnPlatformTop(player.position.x, player.position.y, matchState.stage.platforms)) {
          player.grounded = false;
        } else {
          player.velocity.y = 0;
          continue;
        }
      }

      player.velocity.y = Math.min(
        this.config.maxFallSpeed,
        player.velocity.y + this.config.gravityPerSecond * deltaSeconds
      );

      const previousY = player.position.y;
      const nextY = previousY + player.velocity.y * deltaSeconds;
      const landingY = findLandingY(player.position.x, previousY, nextY, matchState.stage.platforms);

      if (landingY !== null) {
        player.position.y = landingY;
        player.velocity.y = 0;
        player.grounded = true;
        if (player.currentAction === "jump" || player.currentAction === "fall") {
          player.currentAction = "idle";
        }
        continue;
      }

      player.position.y = nextY;
      if (player.velocity.y > 0) {
        player.currentAction = deriveAerialAction(player.currentAction);
      }
    }
  }
}

function isStandingOnPlatformTop(playerX: number, playerY: number, platforms: StagePlatform[]): boolean {
  for (const platform of platforms) {
    const topY = platform.position.y;
    const leftX = platform.position.x;
    const rightX = platform.position.x + platform.size.x;
    const withinHorizontalBounds = playerX >= leftX && playerX <= rightX;
    const onTopSurface = Math.abs(playerY - topY) <= GROUND_EPSILON;
    if (withinHorizontalBounds && onTopSurface) {
      return true;
    }
  }
  return false;
}

function findLandingY(playerX: number, previousY: number, nextY: number, platforms: StagePlatform[]): number | null {
  if (nextY < previousY) {
    return null;
  }

  let closestLandingY: number | null = null;
  for (const platform of platforms) {
    const topY = platform.position.y;
    const leftX = platform.position.x;
    const rightX = platform.position.x + platform.size.x;
    const withinHorizontalBounds = playerX >= leftX && playerX <= rightX;
    const crossedPlatformTop = previousY <= topY + GROUND_EPSILON && nextY >= topY - GROUND_EPSILON;
    if (!withinHorizontalBounds || !crossedPlatformTop) {
      continue;
    }

    if (closestLandingY === null || topY < closestLandingY) {
      closestLandingY = topY;
    }
  }

  return closestLandingY;
}

function deriveAerialAction(currentAction: PlayerAction): PlayerAction {
  if (currentAction === "jump" || currentAction === "fall") {
    return currentAction;
  }

  return "fall";
}

function getRespawnPlatform(player: {
  respawnPlatformCenterX: number | null;
  respawnPlatformY: number | null;
  respawnPlatformWidth: number;
}): { centerX: number; y: number; width: number } | null {
  if (
    player.respawnPlatformCenterX === null ||
    player.respawnPlatformY === null ||
    player.respawnPlatformWidth <= 0
  ) {
    return null;
  }

  return {
    centerX: player.respawnPlatformCenterX,
    y: player.respawnPlatformY,
    width: player.respawnPlatformWidth
  };
}
