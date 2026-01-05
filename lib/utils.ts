import { Direction, Vector2D } from '@/lib/definitions';

export function randomColor(): string {
  const r = Math.random() * 256;
  const g = Math.random() * 256;
  const b = Math.random() * 256;
  const randomColor = `rgb(${r}, ${g}, ${b})`;
  return randomColor;
}

export function randomDirection(exclude?: Direction | Direction[]): Direction {
  const directions: Direction[] = ['up', 'down', 'left', 'right'];
  const excludes = Array.isArray(exclude) ? exclude : exclude ? [exclude] : [];
  const filteredDirections = directions.filter(dir => !excludes.includes(dir));
  if (filteredDirections.length === 0) {
    return 'none';
  }
  const index = Math.floor(Math.random() * filteredDirections.length);
  return filteredDirections[index];
}

export const directionPoints: Record<Direction, Vector2D> = {
  up: { x: 0.5, y: 0.0 },
  down: { x: 0.5, y: 1.0 },
  left: { x: 0.0, y: 0.5 },
  right: { x: 1.0, y: 0.5 },
  none: { x: 0.5, y: 0.5 },
};

export const pairings: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
  none: 'none',
};

export const neighboringOffsets: Record<Direction, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
  none: [0, 0],
};

export function bezierPoint(t: number, p0: Vector2D, p1: Vector2D, p2: Vector2D): Vector2D {
  const x = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x;
  const y = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y;
  return { x, y };
}

export function lerpPoint(p0: Vector2D, p1: Vector2D, t: number): Vector2D {
  const x = p0.x + (p1.x - p0.x) * t;
  const y = p0.y + (p1.y - p0.y) * t;
  return { x, y };
}
