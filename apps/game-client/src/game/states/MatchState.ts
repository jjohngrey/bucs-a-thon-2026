import { cloneVector2, Vector2 } from "../../core/types/Vector2";
import { createPlayerState, CreatePlayerStateInput, PlayerState } from "./PlayerState";

export type MatchPhase = "countdown" | "in_progress" | "paused" | "finished";

export interface StagePlatform {
  id: string;
  position: Vector2;
  size: Vector2;
  passThrough: boolean;
}

export interface StageState {
  id: string;
  blastZoneMin: Vector2;
  blastZoneMax: Vector2;
  spawnPointsByPlayerId: Record<string, Vector2>;
  platforms: StagePlatform[];
}

export interface MatchRules {
  startingStocks: number;
  respawnDurationMs: number;
  respawnTopBuffer: number;
  respawnInvulnerabilityMs: number;
  respawnPlatformWidth: number;
}

export interface MatchState {
  id: string;
  phase: MatchPhase;
  frame: number;
  elapsedMs: number;
  winnerPlayerId: string | null;
  playersById: Record<string, PlayerState>;
  playerOrder: string[];
  stage: StageState;
  rules: MatchRules;
}

export interface CreateMatchStateInput {
  id: string;
  players: CreatePlayerStateInput[];
  stage: StageState;
  rules?: Partial<MatchRules>;
  startPaused?: boolean;
}

const DEFAULT_RULES: MatchRules = {
  startingStocks: 3,
  respawnDurationMs: 2000,
<<<<<<< HEAD
  respawnTopBuffer: 100,
=======
  respawnTopBuffer: 480,
>>>>>>> 49df34a (renames and remove map selection)
  respawnInvulnerabilityMs: 1200,
  respawnPlatformWidth: 170
};

export function createMatchState(input: CreateMatchStateInput): MatchState {
  const rules: MatchRules = {
    ...DEFAULT_RULES,
    ...input.rules
  };

  const playersById: Record<string, PlayerState> = {};
  const playerOrder: string[] = [];

  for (const playerInput of input.players) {
    playersById[playerInput.id] = createPlayerState({
      ...playerInput,
      spawnPosition: cloneVector2(playerInput.spawnPosition),
      startingStocks: playerInput.startingStocks ?? rules.startingStocks
    });
    playerOrder.push(playerInput.id);
  }

  return {
    id: input.id,
    phase: input.startPaused ? "paused" : "countdown",
    frame: 0,
    elapsedMs: 0,
    winnerPlayerId: null,
    playersById,
    playerOrder,
    stage: cloneStageState(input.stage),
    rules
  };
}

export function cloneStageState(stage: StageState): StageState {
  const spawnPointsByPlayerId: Record<string, Vector2> = {};
  for (const [playerId, spawnPoint] of Object.entries(stage.spawnPointsByPlayerId)) {
    spawnPointsByPlayerId[playerId] = cloneVector2(spawnPoint);
  }

  return {
    id: stage.id,
    blastZoneMin: cloneVector2(stage.blastZoneMin),
    blastZoneMax: cloneVector2(stage.blastZoneMax),
    spawnPointsByPlayerId,
    platforms: stage.platforms.map((platform) => ({
      id: platform.id,
      position: cloneVector2(platform.position),
      size: cloneVector2(platform.size),
      passThrough: platform.passThrough
    }))
  };
}

export function isOutsideBlastZone(stage: StageState, position: Vector2): boolean {
  return (
    position.x < stage.blastZoneMin.x ||
    position.x > stage.blastZoneMax.x ||
    position.y < stage.blastZoneMin.y ||
    position.y > stage.blastZoneMax.y
  );
}
