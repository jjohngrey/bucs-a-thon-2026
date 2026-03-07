import { createMatchState } from "./MatchState";

export const MATCH_STATE_EXAMPLE = createMatchState({
  id: "local-1v1-demo",
  players: [
    {
      id: "p1",
      spawnPosition: { x: 300, y: 420 },
      hurtboxSize: { x: 44, y: 66 },
      renderSize: { x: 44, y: 66 },
      facing: 1
    },
    {
      id: "p2",
      spawnPosition: { x: 900, y: 420 },  
      hurtboxSize: { x: 48, y: 70 },
      renderSize: { x: 48, y: 70 },
      facing: -1
    }
  ],
  stage: {
    id: "flat-stage",
    blastZoneMin: { x: -200, y: -400 },
    blastZoneMax: { x: 1400, y: 900 },
    spawnPointsByPlayerId: {
      p1: { x: 300, y: 420 },
      p2: { x: 900, y: 420 }
    },
    platforms: [
      {
        id: "main",
        position: { x: 200, y: 520 },
        size: { x: 800, y: 40 },
        passThrough: false
      }
    ]
  }
});
