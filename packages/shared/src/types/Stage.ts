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

export type StageDefinition = {
  id: string;
  floorY: number;
  blastZone: StageBlastZone;
  spawnPoints: StageSpawnPoint[];
};
