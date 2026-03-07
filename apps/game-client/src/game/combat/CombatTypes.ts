export interface ActiveHitbox {
  ownerPlayerId: string;
  attackId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DamageHitEvent {
  attackerPlayerId: string;
  targetPlayerId: string;
  attackId: string;
}
