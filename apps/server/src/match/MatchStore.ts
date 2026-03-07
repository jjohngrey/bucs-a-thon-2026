import type { MatchSession } from "@bucs/shared";

export class MatchStore {
  private readonly matchesByRoomCode = new Map<string, MatchSession>();

  getMatch(roomCode: string): MatchSession | undefined {
    return this.matchesByRoomCode.get(roomCode);
  }

  hasMatch(roomCode: string): boolean {
    return this.matchesByRoomCode.has(roomCode);
  }

  createMatch(match: MatchSession): MatchSession {
    this.matchesByRoomCode.set(match.roomCode, match);
    return match;
  }

  updateMatchPhase(roomCode: string, phase: MatchSession["phase"]): MatchSession | undefined {
    const match = this.matchesByRoomCode.get(roomCode);
    if (!match) {
      return undefined;
    }

    match.phase = phase;
    return match;
  }

  removeMatch(roomCode: string): boolean {
    return this.matchesByRoomCode.delete(roomCode);
  }
}
