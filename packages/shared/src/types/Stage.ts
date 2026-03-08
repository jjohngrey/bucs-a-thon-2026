export type StageBlastZone = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type StageSpawnPoint = {
  x: number;
  y: number;
};

/** Platform top-left (x, y) and size (width, height). Top surface is at y; in world coords lower y = higher. */
export type StagePlatform = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type StageDefinition = {
  id: string;
  floorY: number;
  blastZone: StageBlastZone;
  spawnPoints: StageSpawnPoint[];
  /** Optional platforms (e.g. floating at different heights). When present, grounding uses them + main floor. */
  platforms?: StagePlatform[];
};
