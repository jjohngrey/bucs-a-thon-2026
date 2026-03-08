import type { StageDefinition } from "../types/Stage.js";

const ROOFTOP_BLAST = {
  minX: -200,
  maxX: 1400,
  minY: -400,
  maxY: 900,
};
const ROOFTOP_SPAWNS = [
  { x: 0, y: 0 },
  { x: 160, y: 0 },
  { x: 320, y: 0 },
  { x: 480, y: 0 },
];

export const STAGES: Record<string, StageDefinition> = {
  rooftop: {
    id: "rooftop",
    floorY: 0,
    blastZone: {
      minX: -200,
      maxX: 1400,
      minY: -304,
      maxY: 56,
    },
    spawnPoints: [
      { x: 0, y: 0 },
      { x: 160, y: 0 },
      { x: 320, y: 0 },
      { x: 480, y: 0 },
    ],
  },
  bucs: {
    id: "bucs",
    floorY: 0,
    blastZone: ROOFTOP_BLAST,
    spawnPoints: ROOFTOP_SPAWNS,
  },
  "491": {
    id: "491",
    floorY: 0,
    blastZone: ROOFTOP_BLAST,
    spawnPoints: ROOFTOP_SPAWNS,
  },
  arena: {
    id: "arena",
    floorY: 0,
    blastZone: ROOFTOP_BLAST,
    spawnPoints: ROOFTOP_SPAWNS,
  },
};

export const DEFAULT_STAGE = STAGES.rooftop;
