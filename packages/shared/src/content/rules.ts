export type MatchRulesDefinition = {
  startingStocks: number;
  respawnDurationMs: number;
  respawnTopBuffer: number;
  respawnInvulnerabilityMs: number;
  respawnPlatformWidth: number;
};

export const DEFAULT_MATCH_RULES: MatchRulesDefinition = {
  startingStocks: 3,
  respawnDurationMs: 2000,
<<<<<<< HEAD
  respawnTopBuffer: 100,
=======
  respawnTopBuffer: 480,
>>>>>>> 49df34a (renames and remove map selection)
  respawnInvulnerabilityMs: 1200,
  respawnPlatformWidth: 170,
};
