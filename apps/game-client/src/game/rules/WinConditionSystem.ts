import { MatchState } from "../states/MatchState";

export interface WinConditionSystemContext {
  deltaMs: number;
  matchState: MatchState;
}

export class WinConditionSystem {
  update(context: WinConditionSystemContext): void {
    void context.deltaMs;

    const { matchState } = context;
    if (matchState.phase === "finished") {
      return;
    }

    const contenders = matchState.playerOrder.filter((playerId) => {
      const player = matchState.playersById[playerId];
      return Boolean(player && player.stocks > 0);
    });

    if (contenders.length !== 1) {
      return;
    }

    matchState.winnerPlayerId = contenders[0];
    matchState.phase = "finished";
  }
}
