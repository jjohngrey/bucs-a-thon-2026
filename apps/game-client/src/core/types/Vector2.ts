export interface Vector2 {
  x: number;
  y: number;
}

export const ZERO_VECTOR: Vector2 = { x: 0, y: 0 };

export function cloneVector2(vector: Vector2): Vector2 {
  return { x: vector.x, y: vector.y };
}
