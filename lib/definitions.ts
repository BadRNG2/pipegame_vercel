export type Direction = 'up' | 'down' | 'left' | 'right' | 'none';
export type Vector2D = { x: number; y: number };
export type GridPiece = {
  i: number;
  j: number;
  value: number;
};
