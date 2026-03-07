import type { StageDefinition } from "../types/Stage.js";

export const STAGES: Record<string, StageDefinition> = {
  rooftop: {
    id: "rooftop",
    floorY: 0,
    blastZone: {
      minX: -200,
      maxX: 1400,
      minY: -400,
      maxY: 900,
    },
    spawnPoints: [
      { x: 0, y: 0 },
      { x: 160, y: 0 },
      { x: 320, y: 0 },
      { x: 480, y: 0 },
    ],
  },
};

export const DEFAULT_STAGE = STAGES.rooftop;
