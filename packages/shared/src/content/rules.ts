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
  respawnTopBuffer: 360,
  respawnInvulnerabilityMs: 1200,
  respawnPlatformWidth: 170,
};
