import { createPlayerState } from "./PlayerState";

const p1 = createPlayerState({
  id: "p1",
  spawnPosition: { x: 300, y: 420 },
  hurtboxSize: { x: 44, y: 70 },
  renderSize: { x: 44, y: 70 },
  facing: 1
});

const p2 = createPlayerState({
  id: "jay",
  spawnPosition: { x: 900, y: 420 },
  hurtboxSize: { x: 44, y: 70 },
  renderSize: { x: 44, y: 70 },
  facing: -1
});

export const PLAYER_STATE_EXAMPLE = { p1, p2 };
