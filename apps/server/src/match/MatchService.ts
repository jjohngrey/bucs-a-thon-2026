import type {
  LobbyErrorPayload,
  MatchEndPayload,
  MatchInputPayload,
  MatchSnapshot,
  MatchSummary,
  MatchSession,
  MatchStartPayload,
  MatchStartingPayload,
  PlayerMatchState,
} from "@bucs/shared";
import {
  DEFAULT_MATCH_RULES,
  DEFAULT_SPECIAL_BASE_KNOCKBACK,
  DEFAULT_SPECIAL_CHARGE_MAX_MS,
  DEFAULT_SPECIAL_COOLDOWN_TICKS,
  DEFAULT_SPECIAL_DAMAGE,
  DEFAULT_SPECIAL_HEIGHT,
  DEFAULT_SPECIAL_HITSTUN_TICKS,
  DEFAULT_SPECIAL_KNOCKBACK_GROWTH,
  DEFAULT_SPECIAL_LAUNCH_ANGLE_DEGREES,
  DEFAULT_SPECIAL_MAX_DAMAGE_MULTIPLIER,
  DEFAULT_SPECIAL_MAX_KNOCKBACK_MULTIPLIER,
  DEFAULT_SPECIAL_MIN_DAMAGE_MULTIPLIER,
  DEFAULT_SPECIAL_MIN_KNOCKBACK_MULTIPLIER,
  DEFAULT_SPECIAL_RANGE,
  DEFAULT_STAGE,
  DEFAULT_ATTACK_DAMAGE,
  DEFAULT_ATTACK_BASE_KNOCKBACK,
  DEFAULT_ATTACK_COOLDOWN_TICKS,
  DEFAULT_ATTACK_HEIGHT,
  DEFAULT_ATTACK_KNOCKBACK_GROWTH,
  DEFAULT_ATTACK_LAUNCH_ANGLE_DEGREES,
  DEFAULT_ATTACK_RANGE,
  DEFAULT_GRAVITY_PER_TICK,
  DEFAULT_HITSTUN_TICKS,
  DEFAULT_JUMP_VELOCITY,
  DEFAULT_KICK_BASE_KNOCKBACK,
  DEFAULT_KICK_COOLDOWN_TICKS,
  DEFAULT_KICK_DAMAGE,
  DEFAULT_KICK_HEIGHT,
  DEFAULT_KICK_HITSTUN_TICKS,
  DEFAULT_KICK_KNOCKBACK_GROWTH,
  DEFAULT_KICK_LAUNCH_ANGLE_DEGREES,
  DEFAULT_KICK_RANGE,
  DEFAULT_KO_FALL_SPEED_PER_TICK,
  DEFAULT_STAGE_ID,
  PLAYER_ACTIONS,
  SERVER_TICK_RATE,
  STAGES,
} from "@bucs/shared";
import { LobbyStore } from "../lobby/LobbyStore.js";
import { normalizeRoomCode } from "../lobby/RoomCode.js";
import { MatchStore } from "./MatchStore.js";

type MatchServiceError = {
  ok: false;
  error: LobbyErrorPayload;
};

type MatchServiceSuccess<T> = {
  ok: true;
  value: T;
};

export type MatchServiceResult<T> = MatchServiceError | MatchServiceSuccess<T>;

export type StartMatchResult = {
  match: MatchSession;
  startEvent: MatchStartingPayload;
};

export type ActivateMatchResult = {
  roomCode: string;
  match: MatchSession;
  snapshot: MatchSnapshot;
};

export type CleanupMatchResult = {
  roomCode: string;
  removed: boolean;
};

export type SubmitInputResult = {
  roomCode: string;
  playerId: string;
};

export type EndMatchResult = {
  roomCode: string;
  summary: MatchSummary;
};

export type AutoEndMatchResult = {
  roomCode: string;
  summary: MatchSummary;
};

export type DepartureMatchResult = {
  roomCode: string;
  summary: MatchSummary;
};

const DEFAULT_COUNTDOWN_MS = 3000;
const PLAYER_SPEED_PER_TICK = 20;
const MAX_FALL_SPEED_PER_TICK = 12;
const TICK_DURATION_MS = 1000 / SERVER_TICK_RATE;
const RESPAWN_HOVER_MS = 1000;
const MAX_SPECIAL_CHARGE_TICKS = Math.round(DEFAULT_SPECIAL_CHARGE_MAX_MS / TICK_DURATION_MS);
const TARGET_HURTBOX_HALF_WIDTH = 18;
const TARGET_HURTBOX_HALF_HEIGHT = 34;
const CLOSE_OVERLAP_HALF_WIDTH = 42;

export class MatchService {
  private readonly pendingStartTimers = new Map<string, NodeJS.Timeout>();
  private readonly activeMatchIntervals = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly lobbyStore: LobbyStore,
    private readonly matchStore: MatchStore,
  ) {}

  startMatch(socketId: string, payload: MatchStartPayload): MatchServiceResult<StartMatchResult> {
    const session = this.lobbyStore.getSessionBySocketId(socketId);
    if (!session) {
      return failure("NOT_IN_LOBBY", "Socket is not associated with a lobby.");
    }

    const roomCode = normalizeRoomCode(payload.roomCode);
    if (roomCode !== session.roomCode) {
      return failure("ROOM_MISMATCH", "Socket is not associated with that room.");
    }

    const lobby = this.lobbyStore.getLobby(roomCode);
    if (!lobby) {
      return failure("LOBBY_NOT_FOUND", "Lobby does not exist.");
    }

    if (lobby.hostPlayerId !== session.playerId) {
      return failure("ONLY_HOST_CAN_START", "Only the host can start the match.");
    }

    if (lobby.players.length < 2) {
      return failure("NOT_ENOUGH_PLAYERS", "At least two players are required to start a match.");
    }

    if (lobby.phase !== "waiting") {
      return failure("INVALID_LOBBY_PHASE", "Lobby must be in the waiting phase before match start.");
    }

    if (this.matchStore.hasMatch(roomCode)) {
      return failure("MATCH_ALREADY_EXISTS", "A match already exists for this room.");
    }

    const unreadyPlayer = lobby.players.find(
      (player) => player.id !== lobby.hostPlayerId && !player.isReady,
    );
    if (unreadyPlayer) {
      return failure("PLAYERS_NOT_READY", "All non-host players must be ready before match start.");
    }

    const match: MatchSession = {
      roomCode,
      stageId: "491",
      phase: "countdown",
      playerIds: lobby.players.map((player) => player.id),
      stage: STAGES["491"] ?? DEFAULT_STAGE,
      rules: DEFAULT_MATCH_RULES,
    };

    this.matchStore.createMatch(match);
    const updatedLobby = this.lobbyStore.updateLobbyPhase(roomCode, "starting");
    if (!updatedLobby) {
      this.matchStore.removeMatch(roomCode);
      return failure("MATCH_START_FAILED", "Unable to transition the lobby to match start.");
    }

    return {
      ok: true,
      value: {
        match,
        startEvent: {
          roomCode,
          stageId: match.stageId,
          playerIds: match.playerIds,
          countdownMs: DEFAULT_COUNTDOWN_MS,
        },
      },
    };
  }

  scheduleMatchActivation(
    roomCode: string,
    countdownMs: number,
    onActivated: (result: ActivateMatchResult) => void,
  ): void {
    const existingTimer = this.pendingStartTimers.get(roomCode);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.pendingStartTimers.delete(roomCode);

      const lobby = this.lobbyStore.getLobby(roomCode);
      const match = this.matchStore.getMatch(roomCode);
      if (!lobby || !match) {
        return;
      }

      if (lobby.phase !== "starting" || match.phase !== "countdown") {
        return;
      }

      if (lobby.players.length < 2) {
        return;
      }

      const updatedLobby = this.lobbyStore.updateLobbyPhase(roomCode, "in-match");
      const updatedMatch = this.matchStore.updateMatchPhase(roomCode, "active");
      if (!updatedLobby || !updatedMatch) {
        return;
      }

      onActivated({
        roomCode,
        match: updatedMatch,
        snapshot: createInitialSnapshot(lobby.players, updatedMatch),
      });
    }, countdownMs);

    this.pendingStartTimers.set(roomCode, timer);
  }

  cleanupMatchForRoom(roomCode: string): CleanupMatchResult {
    const normalizedRoomCode = normalizeRoomCode(roomCode);
    const existingTimer = this.pendingStartTimers.get(normalizedRoomCode);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.pendingStartTimers.delete(normalizedRoomCode);
    }

    const activeInterval = this.activeMatchIntervals.get(normalizedRoomCode);
    if (activeInterval) {
      clearInterval(activeInterval);
      this.activeMatchIntervals.delete(normalizedRoomCode);
    }

    return {
      roomCode: normalizedRoomCode,
      removed: this.matchStore.removeMatch(normalizedRoomCode),
    };
  }

  submitInput(socketId: string, payload: MatchInputPayload): MatchServiceResult<SubmitInputResult> {
    const session = this.lobbyStore.getSessionBySocketId(socketId);
    if (!session) {
      return failure("NOT_IN_LOBBY", "Socket is not associated with a lobby.");
    }

    const roomCode = normalizeRoomCode(payload.roomCode);
    if (roomCode !== session.roomCode) {
      return failure("ROOM_MISMATCH", "Socket is not associated with that room.");
    }

    const match = this.matchStore.getMatch(roomCode);
    if (!match) {
      return failure("MATCH_NOT_FOUND", "Match does not exist.");
    }

    if (match.phase !== "active") {
      return failure("MATCH_NOT_ACTIVE", "Match is not active.");
    }

    const updated = this.matchStore.updateLatestInput(roomCode, session.playerId, payload.pressed);
    if (!updated) {
      return failure("INPUT_REJECTED", "Unable to store player input.");
    }

    return {
      ok: true,
      value: {
        roomCode,
        playerId: session.playerId,
      },
    };
  }

  startSnapshotLoop(
    roomCode: string,
    onSnapshot: (payload: { roomCode: string; snapshot: MatchSnapshot }) => void,
    onMatchEnded: (payload: AutoEndMatchResult) => void,
  ): void {
    const normalizedRoomCode = normalizeRoomCode(roomCode);
    const existingInterval = this.activeMatchIntervals.get(normalizedRoomCode);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    const interval = setInterval(() => {
      const runtimeState = this.matchStore.getRuntimeState(normalizedRoomCode);
      if (!runtimeState || runtimeState.session.phase !== "active") {
        return;
      }

      const snapshot = advanceSnapshot(
        runtimeState.latestSnapshot ?? createInitialSnapshot(
          (this.lobbyStore.getLobby(normalizedRoomCode)?.players ?? []).map((player) => ({
            id: player.id,
            displayName: player.displayName,
            selectedCharacterId: player.selectedCharacterId,
          })),
          runtimeState.session,
        ),
        runtimeState.latestInputsByPlayerId,
        runtimeState.previousInputsByPlayerId,
        runtimeState.hitstunTicksByPlayerId,
        runtimeState.attackCooldownTicksByPlayerId,
        runtimeState.specialChargeTicksByPlayerId,
        runtimeState.session,
      );

      this.matchStore.updateLatestSnapshot(normalizedRoomCode, snapshot);
      this.matchStore.commitInputs(normalizedRoomCode);
      onSnapshot({
        roomCode: normalizedRoomCode,
        snapshot,
      });

      const summary = getAutoMatchSummary(snapshot);
      if (!summary) {
        return;
      }

      const updatedLobby = this.lobbyStore.updateLobbyPhase(normalizedRoomCode, "finished");
      if (!updatedLobby) {
        return;
      }

      this.cleanupMatchForRoom(normalizedRoomCode);
      onMatchEnded({
        roomCode: normalizedRoomCode,
        summary,
      });
    }, Math.round(1000 / SERVER_TICK_RATE));

    this.activeMatchIntervals.set(normalizedRoomCode, interval);
  }

  endMatch(socketId: string, payload: MatchEndPayload): MatchServiceResult<EndMatchResult> {
    const session = this.lobbyStore.getSessionBySocketId(socketId);
    if (!session) {
      return failure("NOT_IN_LOBBY", "Socket is not associated with a lobby.");
    }

    const roomCode = normalizeRoomCode(payload.roomCode);
    if (roomCode !== session.roomCode) {
      return failure("ROOM_MISMATCH", "Socket is not associated with that room.");
    }

    const lobby = this.lobbyStore.getLobby(roomCode);
    const match = this.matchStore.getMatch(roomCode);
    if (!lobby || !match) {
      return failure("MATCH_NOT_FOUND", "Match does not exist.");
    }

    if (match.phase !== "active") {
      return failure("MATCH_NOT_ACTIVE", "Match is not active.");
    }

    const updatedLobby = this.lobbyStore.updateLobbyPhase(roomCode, "finished");
    if (!updatedLobby) {
      return failure("MATCH_END_FAILED", "Unable to update lobby to finished.");
    }

    this.cleanupMatchForRoom(roomCode);

    return {
      ok: true,
      value: {
        roomCode,
        summary: {
          winnerPlayerId: payload.winnerPlayerId,
          eliminatedPlayerIds: payload.eliminatedPlayerIds,
        },
      },
    };
  }

  endMatchForDeparture(roomCode: string, departingPlayerId: string): DepartureMatchResult | null {
    const normalizedRoomCode = normalizeRoomCode(roomCode);
    const match = this.matchStore.getMatch(normalizedRoomCode);
    if (!match) {
      return null;
    }

    if (match.phase !== "countdown" && match.phase !== "active") {
      return null;
    }

    const lobby = this.lobbyStore.getLobby(normalizedRoomCode);

    this.cleanupMatchForRoom(normalizedRoomCode);

    if (!lobby) {
      return {
        roomCode: normalizedRoomCode,
        summary: {
          winnerPlayerId: null,
          eliminatedPlayerIds: [departingPlayerId],
        },
      };
    }

    this.lobbyStore.updateLobbyPhase(normalizedRoomCode, "finished");
    const winnerPlayerId = lobby.players.length === 1 ? lobby.players[0]?.id ?? null : null;

    return {
      roomCode: normalizedRoomCode,
      summary: {
        winnerPlayerId,
        eliminatedPlayerIds: [departingPlayerId],
      },
    };
  }
}

function createInitialSnapshot(players: Array<{
  id: string;
  displayName: string;
  selectedCharacterId: string | null;
}>, session: MatchSession): MatchSnapshot {
  return {
    serverFrame: 0,
    phase: "active",
    players: players.map((player, index) => createInitialPlayerState(player, index, session)),
  };
}

function advanceSnapshot(
  previous: MatchSnapshot,
  latestInputsByPlayerId: Record<
    string,
    {
      left: boolean;
      right: boolean;
      jump: boolean;
      attack: boolean;
      kick: boolean;
      special: boolean;
    }
  >,
  previousInputsByPlayerId: Record<
    string,
    {
      left: boolean;
      right: boolean;
      jump: boolean;
      attack: boolean;
      kick: boolean;
      special: boolean;
    }
  >,
  hitstunTicksByPlayerId: Record<string, number>,
  attackCooldownTicksByPlayerId: Record<string, number>,
  specialChargeTicksByPlayerId: Record<string, number>,
  session: MatchSession,
): MatchSnapshot {
  const nextPlayers: PlayerMatchState[] = previous.players.map((player) => {
    const isEliminated = player.stocks <= 0;
    if (isEliminated) {
      specialChargeTicksByPlayerId[player.id] = 0;
      return {
        ...player,
        isOutOfPlay: true,
        grounded: false,
        vx: 0,
        vy: Math.max(player.vy, DEFAULT_KO_FALL_SPEED_PER_TICK),
        y: player.y + Math.max(player.vy, DEFAULT_KO_FALL_SPEED_PER_TICK),
        specialChargeMs: 0,
        action: PLAYER_ACTIONS.KO,
      };
    }

    if (player.isOutOfPlay) {
      specialChargeTicksByPlayerId[player.id] = 0;
      const nextRespawnTimerMs = Math.max(0, player.respawnTimerMs - TICK_DURATION_MS);
      if (nextRespawnTimerMs > 0) {
        const fallVelocity = Math.max(player.vy, DEFAULT_KO_FALL_SPEED_PER_TICK);
        return {
          ...player,
          grounded: false,
          vx: 0,
          vy: fallVelocity,
          y: player.y + fallVelocity,
          respawnTimerMs: nextRespawnTimerMs,
          specialChargeMs: 0,
          action: PLAYER_ACTIONS.KO,
        };
      }

      return createRespawnedPlayerState(player, session);
    }

    const nextInvulnerabilityMs = Math.max(0, player.respawnInvulnerabilityMs - TICK_DURATION_MS);
    const hoverWindowMs = Math.min(RESPAWN_HOVER_MS, session.rules.respawnInvulnerabilityMs);
    const hoverThresholdMs = session.rules.respawnInvulnerabilityMs - hoverWindowMs;
    const hasRespawnPlatform = player.respawnPlatformCenterX !== null && player.respawnPlatformY !== null;
    if (hasRespawnPlatform && player.respawnInvulnerabilityMs > 0) {
      const respawnCenterX = player.respawnPlatformCenterX;
      const respawnY = player.respawnPlatformY;
      const shouldHoverDuringRespawn = player.respawnInvulnerabilityMs > hoverThresholdMs;
      return {
        ...player,
        x: respawnCenterX!,
        y: respawnY!,
        vx: 0,
        vy: 0,
        grounded: !shouldHoverDuringRespawn,
        respawnInvulnerabilityMs: nextInvulnerabilityMs,
        respawnPlatformCenterX: nextInvulnerabilityMs > 0 ? respawnCenterX : null,
        respawnPlatformY: nextInvulnerabilityMs > 0 ? respawnY : null,
        respawnPlatformWidth: nextInvulnerabilityMs > 0 ? player.respawnPlatformWidth : 0,
        action: shouldHoverDuringRespawn ? PLAYER_ACTIONS.RESPAWN : PLAYER_ACTIONS.IDLE,
      };
    }
    const input = latestInputsByPlayerId[player.id];
    const inHitstun = (hitstunTicksByPlayerId[player.id] ?? 0) > 0;
    const attackOnCooldown = (attackCooldownTicksByPlayerId[player.id] ?? 0) > 0;
    const specialChargeTicks = specialChargeTicksByPlayerId[player.id] ?? 0;
    const chargingSpecial = Boolean(input?.special) && !inHitstun && (specialChargeTicks > 0 || !attackOnCooldown);
    const horizontalVelocityFromInput =
      chargingSpecial
        ? 0
        : input?.left && !input.right
        ? -PLAYER_SPEED_PER_TICK
        : input?.right && !input.left
          ? PLAYER_SPEED_PER_TICK
          : 0;
    const horizontalVelocity = inHitstun
      ? Math.abs(player.vx) < 0.5
        ? 0
        : player.vx * 0.85
      : horizontalVelocityFromInput;
    const jumped = Boolean(input?.jump && player.grounded && !inHitstun && !chargingSpecial);
    const verticalVelocity = jumped ? DEFAULT_JUMP_VELOCITY : Math.min(player.vy + DEFAULT_GRAVITY_PER_TICK, MAX_FALL_SPEED_PER_TICK);
    const nextY = player.y + verticalVelocity;
    const nextX = player.x + horizontalVelocity;
    const onPlatform =
      session.stageId === "491"
        ? nextX >= STAGE_491_PLATFORM_MIN_X && nextX <= STAGE_491_PLATFORM_MAX_X
        : true;
    const grounded = onPlatform && nextY >= session.stage.floorY;
    const resolvedY = grounded ? session.stage.floorY : nextY;
    const resolvedVy = grounded ? 0 : verticalVelocity;
    const facing =
      horizontalVelocity < 0
        ? "left"
        : horizontalVelocity > 0
          ? "right"
          : player.facing;
    const action: PlayerMatchState["action"] = inHitstun
      ? PLAYER_ACTIONS.HITSTUN
      : chargingSpecial
        ? PLAYER_ACTIONS.ATTACK
      : grounded
        ? horizontalVelocity === 0
          ? PLAYER_ACTIONS.IDLE
          : PLAYER_ACTIONS.RUN
        : resolvedVy < 0
          ? PLAYER_ACTIONS.JUMP
          : PLAYER_ACTIONS.FALL;

    return {
      ...player,
      x: player.x + horizontalVelocity,
      y: resolvedY,
      vx: horizontalVelocity,
      vy: resolvedVy,
      grounded,
      respawnInvulnerabilityMs: nextInvulnerabilityMs,
      respawnPlatformCenterX: nextInvulnerabilityMs > 0 ? player.respawnPlatformCenterX : null,
      respawnPlatformY: nextInvulnerabilityMs > 0 ? player.respawnPlatformY : null,
      respawnPlatformWidth: nextInvulnerabilityMs > 0 ? player.respawnPlatformWidth : 0,
      specialChargeMs: ticksToMs(specialChargeTicks),
      facing,
      action,
    };
  });

  for (const playerId of Object.keys(hitstunTicksByPlayerId)) {
    hitstunTicksByPlayerId[playerId] = Math.max(0, (hitstunTicksByPlayerId[playerId] ?? 0) - 1);
  }

  for (const playerId of Object.keys(attackCooldownTicksByPlayerId)) {
    attackCooldownTicksByPlayerId[playerId] = Math.max(
      0,
      (attackCooldownTicksByPlayerId[playerId] ?? 0) - 1,
    );
  }

  for (const attacker of nextPlayers) {
    const currentInput = latestInputsByPlayerId[attacker.id];
    const previousInput = previousInputsByPlayerId[attacker.id];
    const attackOnCooldown = (attackCooldownTicksByPlayerId[attacker.id] ?? 0) > 0;
    const specialHeld = Boolean(currentInput?.special);
    const specialReleased = Boolean(previousInput?.special && !currentInput?.special);
    let specialChargeTicks = specialChargeTicksByPlayerId[attacker.id] ?? 0;
    if (attacker.action === PLAYER_ACTIONS.HITSTUN || attacker.isOutOfPlay || attacker.stocks <= 0) {
      specialChargeTicksByPlayerId[attacker.id] = 0;
      attacker.specialChargeMs = 0;
      continue;
    }

    if (specialHeld) {
      if (specialChargeTicks > 0 || !attackOnCooldown) {
        specialChargeTicks = Math.min(MAX_SPECIAL_CHARGE_TICKS, specialChargeTicks + 1);
        specialChargeTicksByPlayerId[attacker.id] = specialChargeTicks;
        attacker.specialChargeMs = ticksToMs(specialChargeTicks);
        attacker.vx = 0;
      } else {
        specialChargeTicksByPlayerId[attacker.id] = 0;
        attacker.specialChargeMs = 0;
      }
      continue;
    }

    const specialChargeRatio = clamp01(specialChargeTicks / Math.max(1, MAX_SPECIAL_CHARGE_TICKS));
    specialChargeTicksByPlayerId[attacker.id] = 0;
    attacker.specialChargeMs = 0;

    const attackTriggered = Boolean(currentInput?.attack && !previousInput?.attack);
    const kickTriggered = Boolean(currentInput?.kick && !previousInput?.kick);
    const specialTriggered = specialReleased && specialChargeTicks > 0;
    if (!attackTriggered && !kickTriggered && !specialTriggered) {
      continue;
    }
    if (attackOnCooldown) {
      continue;
    }

    const attackProfile = kickTriggered
        ? {
          action: PLAYER_ACTIONS.KICK,
          cooldownTicks: DEFAULT_KICK_COOLDOWN_TICKS,
          range: DEFAULT_KICK_RANGE,
          height: DEFAULT_KICK_HEIGHT,
          damage: DEFAULT_KICK_DAMAGE,
          launchAngleDegrees: DEFAULT_KICK_LAUNCH_ANGLE_DEGREES,
          baseKnockback: DEFAULT_KICK_BASE_KNOCKBACK,
          knockbackGrowth: DEFAULT_KICK_KNOCKBACK_GROWTH,
          hitstunTicks: DEFAULT_KICK_HITSTUN_TICKS,
        }
      : specialTriggered
        ? (() => {
          const damageMultiplier = lerp(
            DEFAULT_SPECIAL_MIN_DAMAGE_MULTIPLIER,
            DEFAULT_SPECIAL_MAX_DAMAGE_MULTIPLIER,
            specialChargeRatio,
          );
          const knockbackMultiplier = lerp(
            DEFAULT_SPECIAL_MIN_KNOCKBACK_MULTIPLIER,
            DEFAULT_SPECIAL_MAX_KNOCKBACK_MULTIPLIER,
            specialChargeRatio,
          );
          return {
            action: PLAYER_ACTIONS.ATTACK,
            cooldownTicks: DEFAULT_SPECIAL_COOLDOWN_TICKS,
            range: DEFAULT_SPECIAL_RANGE,
            height: DEFAULT_SPECIAL_HEIGHT,
            damage: DEFAULT_SPECIAL_DAMAGE * damageMultiplier,
            launchAngleDegrees: DEFAULT_SPECIAL_LAUNCH_ANGLE_DEGREES,
            baseKnockback: DEFAULT_SPECIAL_BASE_KNOCKBACK * knockbackMultiplier,
            knockbackGrowth: DEFAULT_SPECIAL_KNOCKBACK_GROWTH * knockbackMultiplier,
            hitstunTicks: DEFAULT_SPECIAL_HITSTUN_TICKS,
          };
        })()
      : {
          action: PLAYER_ACTIONS.ATTACK,
          cooldownTicks: DEFAULT_ATTACK_COOLDOWN_TICKS,
          range: DEFAULT_ATTACK_RANGE,
          height: DEFAULT_ATTACK_HEIGHT,
          damage: DEFAULT_ATTACK_DAMAGE,
          launchAngleDegrees: DEFAULT_ATTACK_LAUNCH_ANGLE_DEGREES,
          baseKnockback: DEFAULT_ATTACK_BASE_KNOCKBACK,
          knockbackGrowth: DEFAULT_ATTACK_KNOCKBACK_GROWTH,
          hitstunTicks: DEFAULT_HITSTUN_TICKS,
        };

    attacker.action = attackProfile.action;
    attackCooldownTicksByPlayerId[attacker.id] = attackProfile.cooldownTicks;

    const target = nextPlayers.find((candidate) => {
      if (candidate.id === attacker.id) {
        return false;
      }
      if (candidate.isOutOfPlay || candidate.stocks <= 0 || candidate.respawnInvulnerabilityMs > 0) {
        return false;
      }

      const dx = candidate.x - attacker.x;
      const effectiveHorizontalRange = attackProfile.range + TARGET_HURTBOX_HALF_WIDTH;
      const overlappingAtCloseRange = Math.abs(dx) <= CLOSE_OVERLAP_HALF_WIDTH;
      const withinFacing = overlappingAtCloseRange
        || (attacker.facing === "right"
          ? dx >= -TARGET_HURTBOX_HALF_WIDTH && dx <= effectiveHorizontalRange
          : dx <= TARGET_HURTBOX_HALF_WIDTH && dx >= -effectiveHorizontalRange);
      const withinHeight =
        Math.abs(candidate.y - attacker.y) <= attackProfile.height + TARGET_HURTBOX_HALF_HEIGHT;
      return withinFacing && withinHeight;
    });

    if (!target) {
      continue;
    }

    const damageBeforeHit = target.damage;
    target.damage += attackProfile.damage;
    const knockbackMagnitude = calculateKnockbackMagnitude(
      damageBeforeHit,
      attackProfile.baseKnockback,
      attackProfile.knockbackGrowth,
    );
    const launchVector = getLaunchVector(
      attackProfile.launchAngleDegrees,
      attacker.x,
      target.x,
    );
    target.vx = launchVector.x * knockbackMagnitude;
    target.vy = launchVector.y * knockbackMagnitude;
    target.grounded = false;
    target.y = Math.min(target.y, session.stage.floorY - 4);
    target.facing = attacker.facing === "right" ? "left" : "right";
    target.action = PLAYER_ACTIONS.HITSTUN;
    hitstunTicksByPlayerId[target.id] = attackProfile.hitstunTicks;
  }

  for (const player of nextPlayers) {
    if (player.isOutOfPlay || player.stocks <= 0) {
      continue;
    }

    if (!isOutsideBlastZone(player, session)) {
      continue;
    }

    player.stocks = Math.max(0, player.stocks - 1);
    player.isOutOfPlay = true;
    player.respawnTimerMs = player.stocks > 0 ? session.rules.respawnDurationMs : 0;
    player.respawnInvulnerabilityMs = 0;
    player.respawnPlatformCenterX = null;
    player.respawnPlatformY = null;
    player.respawnPlatformWidth = 0;
    player.specialChargeMs = 0;
    player.action = PLAYER_ACTIONS.KO;
    player.vx = 0;
    player.vy = Math.max(player.vy, DEFAULT_KO_FALL_SPEED_PER_TICK);
    player.grounded = false;
    specialChargeTicksByPlayerId[player.id] = 0;
  }

  return {
    serverFrame: previous.serverFrame + 1,
    phase: "active",
    players: nextPlayers,
  };
}

function createInitialPlayerState(
  player: {
    id: string;
    displayName: string;
    selectedCharacterId: string | null;
  },
  index: number,
  session: MatchSession,
): PlayerMatchState {
  const spawnPoint = session.stage.spawnPoints[index] ?? session.stage.spawnPoints[0] ?? { x: 0, y: session.stage.floorY };
  return {
    id: player.id,
    displayName: player.displayName,
    characterId: player.selectedCharacterId ?? `placeholder-${index + 1}`,
    x: spawnPoint.x,
    y: spawnPoint.y,
    vx: 0,
    vy: 0,
    grounded: true,
    damage: 0,
    stocks: session.rules.startingStocks,
    isOutOfPlay: false,
    respawnTimerMs: 0,
    respawnInvulnerabilityMs: 0,
    respawnPlatformCenterX: null,
    respawnPlatformY: null,
    respawnPlatformWidth: 0,
    specialChargeMs: 0,
    facing: index % 2 === 0 ? "right" : "left",
    action: PLAYER_ACTIONS.IDLE,
  };
}

function createRespawnedPlayerState(player: PlayerMatchState, session: MatchSession): PlayerMatchState {
  const respawnX = (session.stage.blastZone.minX + session.stage.blastZone.maxX) / 2;
  const respawnY = session.stage.floorY - session.rules.respawnTopBuffer;

  return {
    ...player,
    x: respawnX,
    y: respawnY,
    vx: 0,
    vy: 0,
    grounded: false,
    damage: 0,
    isOutOfPlay: false,
    respawnTimerMs: 0,
    respawnInvulnerabilityMs: session.rules.respawnInvulnerabilityMs,
    respawnPlatformCenterX: respawnX,
    respawnPlatformY: respawnY,
    respawnPlatformWidth: session.rules.respawnPlatformWidth,
    specialChargeMs: 0,
    action: PLAYER_ACTIONS.RESPAWN,
  };
}

/** Stage 491: platform exists only between these X bounds; outside = no floor, fall to death. */
const STAGE_491_PLATFORM_MIN_X = 120;
const STAGE_491_PLATFORM_MAX_X = 1144;
/** Stage 491: die soon after falling off (bottom kill line, was 900). */
const STAGE_491_BLAST_MAX_Y = 120;

function isOutsideBlastZone(player: PlayerMatchState, session: MatchSession): boolean {
  const stage = STAGES[session.stageId] ?? session.stage;
  const b = stage.blastZone;
  if (session.stageId === "491") {
    return player.y < b.minY || player.y > STAGE_491_BLAST_MAX_Y;
  }
  return (
    player.x < b.minX ||
    player.x > b.maxX ||
    player.y < b.minY ||
    player.y > b.maxY
  );
}

function failure(code: string, message: string): MatchServiceError {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  };
}

function getAutoMatchSummary(snapshot: MatchSnapshot): MatchSummary | null {
  const survivingPlayers = snapshot.players.filter((player) => player.stocks > 0);
  if (survivingPlayers.length > 1) {
    return null;
  }

  const winnerPlayerId = survivingPlayers[0]?.id ?? null;
  const eliminatedPlayerIds = snapshot.players
    .filter((player) => player.id !== winnerPlayerId)
    .map((player) => player.id);

  return {
    winnerPlayerId,
    eliminatedPlayerIds,
  };
}

function ticksToMs(ticks: number): number {
  return Math.max(0, Math.min(DEFAULT_SPECIAL_CHARGE_MAX_MS, ticks * TICK_DURATION_MS));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lerp(min: number, max: number, ratio: number): number {
  return min + (max - min) * clamp01(ratio);
}

function calculateKnockbackMagnitude(
  targetDamage: number,
  baseKnockback: number,
  knockbackGrowth: number,
): number {
  const safeDamage = Math.max(0, targetDamage);
  // Use sublinear damage scaling so early hits don't launch like finishers.
  return baseKnockback + knockbackGrowth * Math.pow(safeDamage, 0.8);
}

function getLaunchVector(
  angleDegrees: number,
  attackerX: number,
  targetX: number,
): { x: number; y: number } {
  const radians = (angleDegrees * Math.PI) / 180;
  const direction = targetX >= attackerX ? 1 : -1;

  return {
    x: Math.cos(radians) * direction,
    y: -Math.sin(radians),
  };
}
