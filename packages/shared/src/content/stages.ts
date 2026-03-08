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
    platforms: [
      { id: "bucs-low-left", x: 80, y: -50, width: 180, height: 16 },
      { id: "bucs-low-right", x: 940, y: -50, width: 180, height: 16 },
      { id: "bucs-mid-left", x: 280, y: -120, width: 140, height: 16 },
      { id: "bucs-mid-center", x: 510, y: -120, width: 140, height: 16 },
      { id: "bucs-mid-right", x: 740, y: -120, width: 140, height: 16 },
      { id: "bucs-top-left", x: 400, y: -200, width: 120, height: 16 },
      { id: "bucs-top-right", x: 640, y: -200, width: 120, height: 16 },
    ],
  },
  "491": {
    id: "491",
    floorY: 0,
    blastZone: {
      ...ROOFTOP_BLAST,
      minX: 120,
      maxX: 1144,
      maxY: 120,
    },
    spawnPoints: [
      { x: 400, y: 0 },
      { x: 600, y: 0 },
      { x: 800, y: 0 },
    ],
  },
  arena: {
    id: "arena",
    floorY: 0,
    blastZone: ROOFTOP_BLAST,
    spawnPoints: ROOFTOP_SPAWNS,
  },
};

export const DEFAULT_STAGE = STAGES["491"];
