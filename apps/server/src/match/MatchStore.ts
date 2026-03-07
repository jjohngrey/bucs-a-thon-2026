import type { MatchInputPayload, MatchRuntimeState, MatchSession, MatchSnapshot } from "@bucs/shared";

export class MatchStore {
  private readonly matchesByRoomCode = new Map<string, MatchRuntimeState>();

  getMatch(roomCode: string): MatchSession | undefined {
    return this.matchesByRoomCode.get(roomCode)?.session;
  }

  getRuntimeState(roomCode: string): MatchRuntimeState | undefined {
    return this.matchesByRoomCode.get(roomCode);
  }

  hasMatch(roomCode: string): boolean {
    return this.matchesByRoomCode.has(roomCode);
  }

  createMatch(match: MatchSession): MatchSession {
    this.matchesByRoomCode.set(match.roomCode, {
      session: match,
      latestInputsByPlayerId: Object.fromEntries(
        match.playerIds.map((playerId) => [
          playerId,
          {
            left: false,
            right: false,
            jump: false,
            attack: false,
            special: false,
          },
        ]),
      ),
      latestSnapshot: null,
    });
    return match;
  }

  updateMatchPhase(roomCode: string, phase: MatchSession["phase"]): MatchSession | undefined {
    const runtimeState = this.matchesByRoomCode.get(roomCode);
    if (!runtimeState) {
      return undefined;
    }

    runtimeState.session.phase = phase;
    return runtimeState.session;
  }

  updateLatestInput(
    roomCode: string,
    playerId: string,
    pressed: MatchInputPayload["pressed"],
  ): MatchRuntimeState | undefined {
    const runtimeState = this.matchesByRoomCode.get(roomCode);
    if (!runtimeState || !(playerId in runtimeState.latestInputsByPlayerId)) {
      return undefined;
    }

    runtimeState.latestInputsByPlayerId[playerId] = pressed;
    return runtimeState;
  }

  updateLatestSnapshot(roomCode: string, snapshot: MatchSnapshot): MatchRuntimeState | undefined {
    const runtimeState = this.matchesByRoomCode.get(roomCode);
    if (!runtimeState) {
      return undefined;
    }

    runtimeState.latestSnapshot = snapshot;
    return runtimeState;
  }

  removeMatch(roomCode: string): boolean {
    return this.matchesByRoomCode.delete(roomCode);
  }
}
