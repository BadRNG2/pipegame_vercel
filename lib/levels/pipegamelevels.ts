// Procedural, deterministic level generator for the pipe game.
// Produces varied, solvable levels for easy/normal/hard difficulties.

type Dir = 'left' | 'right' | 'up' | 'down';
const LEFT = 8,
  RIGHT = 4,
  UP = 2,
  DOWN = 1;

function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    // xorshift32-ish
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s >>>= 0;
    s ^= s << 5;
    s >>>= 0;
    return (s >>> 0) / 0x100000000;
  };
}

function shuffle<T>(arr: T[], rnd: () => number) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

function inBounds(x: number, y: number, gx: number, gy: number) {
  return x >= 0 && x < gx && y >= 0 && y < gy;
}

function neighbors(x: number, y: number, gx: number, gy: number) {
  const out: [number, number, Dir][] = [];
  if (x > 0) out.push([x - 1, y, 'left']);
  if (x < gx - 1) out.push([x + 1, y, 'right']);
  if (y > 0) out.push([x, y - 1, 'up']);
  if (y < gy - 1) out.push([x, y + 1, 'down']);
  return out;
}

function dirOpp(d: Dir): Dir {
  return d === 'left' ? 'right' : d === 'right' ? 'left' : d === 'up' ? 'down' : 'up';
}

function dirBit(d: Dir) {
  if (d === 'left') return LEFT;
  if (d === 'right') return RIGHT;
  if (d === 'up') return UP;
  return DOWN;
}

function coordsToKey(x: number, y: number) {
  return `${x},${y}`;
}

// Build a simple shortest path (BFS) then insert detour loops to reach desired length
function buildPath(
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  gx: number,
  gy: number,
  minLen: number,
  maxLen: number,
  rnd: () => number
) {
  // BFS shortest path
  const q: [number, number][] = [[sx, sy]];
  const prev = new Map<string, string>();
  prev.set(coordsToKey(sx, sy), '');
  let found = false;
  while (q.length && !found) {
    const [cx, cy] = q.shift()!;
    for (const [nx, ny] of neighbors(cx, cy, gx, gy)) {
      const k = coordsToKey(nx, ny);
      if (prev.has(k)) continue;
      prev.set(k, coordsToKey(cx, cy));
      if (nx === ex && ny === ey) {
        found = true;
        break;
      }
      q.push([nx, ny]);
    }
  }
  if (!prev.has(coordsToKey(ex, ey))) return null;
  const path: [number, number][] = [];
  let cur = coordsToKey(ex, ey);
  while (cur) {
    const [cx, cy] = cur.split(',').map(Number);
    path.push([cx, cy]);
    cur = prev.get(cur)!;
  }
  path.reverse();
  // now extend path with simple detours until length >= minLen (or <= maxLen)
  let attempts = 0;
  while (path.length < minLen && attempts < 200) {
    attempts++;
    // pick an index in path (not start or end) to expand
    if (path.length <= 2) break;
    const idx = 1 + Math.floor(rnd() * (path.length - 2));
    const [px, py] = path[idx];
    // find neighbor not in path
    const neigh = neighbors(px, py, gx, gy).filter(
      ([nx, ny]) => !path.some(([ax, ay]) => ax === nx && ay === ny)
    );
    if (neigh.length === 0) continue;
    const [nx, ny] = neigh[Math.floor(rnd() * neigh.length)];
    // insert nx,ny after idx
    path.splice(idx + 1, 0, [nx, ny]);
  }
  // if path too long, trim from middle
  if (path.length > maxLen) path.splice(maxLen);
  return path;
}

function buildLevelString(
  gx: number,
  gy: number,
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  path: [number, number][],
  rnd: () => number
) {
  const total = gx * gy;
  // initialize tokens with empty marker (we'll set exactly one 0)
  const tokens = new Array(total).fill(0);
  const setBits = (x: number, y: number, bit: number) => {
    const idx = y * gx + x;
    tokens[idx] |= bit;
  };
  // set path connections
  for (let p = 0; p < path.length; p++) {
    const [x, y] = path[p];
    if (p > 0) {
      const [px, py] = path[p - 1];
      // set connection between (px,py) and (x,y)
      if (px === x - 1) {
        setBits(px, py, RIGHT);
        setBits(x, y, LEFT);
      } else if (px === x + 1) {
        setBits(px, py, LEFT);
        setBits(x, y, RIGHT);
      } else if (py === y - 1) {
        setBits(px, py, DOWN);
        setBits(x, y, UP);
      } else if (py === y + 1) {
        setBits(px, py, UP);
        setBits(x, y, DOWN);
      }
    }
  }
  // fill other cells with random multi-connection tiles (no single-arm). Try to make interesting shapes.
  for (let y = 0; y < gy; y++) {
    for (let x = 0; x < gx; x++) {
      const idx = y * gx + x;
      if (path.some(([px, py]) => px === x && py === y)) continue; // path already set
      // pick 2-3 connections randomly among available neighbors
      const neigh = neighbors(x, y, gx, gy);
      const choices: Dir[] = neigh.map(n => n[2]);
      shuffle(choices, rnd);
      const take = Math.max(2, Math.min(choices.length, 2 + Math.floor(rnd() * 2)));
      let mask = 0;
      for (let t = 0; t < take; t++) {
        const d = choices[t];
        mask |= dirBit(d);
      }
      tokens[idx] = mask;
    }
  }
  // ensure tokens on path are non-zero (if any path cell ended up zero because only single return)
  for (const [x, y] of path) {
    const idx = y * gx + x;
    if (tokens[idx] === 0) {
      // prefer connect to next or previous
      const pidx = path.findIndex(([ax, ay]) => ax === x && ay === y);
      let mask = 0;
      if (pidx > 0) {
        const [nx, ny] = path[pidx - 1];
        if (nx === x - 1) mask |= LEFT;
        if (nx === x + 1) mask |= RIGHT;
        if (ny === y - 1) mask |= UP;
        if (ny === y + 1) mask |= DOWN;
      }
      if (pidx < path.length - 1) {
        const [nx, ny] = path[pidx + 1];
        if (nx === x - 1) mask |= LEFT;
        if (nx === x + 1) mask |= RIGHT;
        if (ny === y - 1) mask |= UP;
        if (ny === y + 1) mask |= DOWN;
      }
      // if still zero, add a random neighbor
      if (mask === 0) {
        const neigh = neighbors(x, y, gx, gy);
        if (neigh.length) mask |= dirBit(neigh[0][2]);
      }
      tokens[idx] = mask;
    }
  }
  // pick a single empty cell not on path
  const freeCells: [number, number][] = [];
  for (let y = 0; y < gy; y++)
    for (let x = 0; x < gx; x++)
      if (!path.some(([px, py]) => px === x && py === y)) freeCells.push([x, y]);
  if (freeCells.length === 0) {
    // if none free, remove last non-start/end path node to be empty
    if (path.length > 2) {
      const [rx, ry] = path[path.length - 2];
      tokens[ry * gx + rx] = 0;
    }
  } else {
    const r = Math.floor(rnd() * freeCells.length);
    const [zx, zy] = freeCells[r];
    tokens[zy * gx + zx] = 0;
  }

  // ensure no single-arm tiles remain: if any token is single-bit, add one extra connection to make it valid
  for (let y = 0; y < gy; y++)
    for (let x = 0; x < gx; x++) {
      const idx = y * gx + x;
      const val = tokens[idx];
      if (val === 0) continue;
      if (val && (val & (val - 1)) === 0) {
        // pick a neighbor to connect
        const neigh = neighbors(x, y, gx, gy);
        for (const [nx, ny, d] of neigh) {
          const nidx = ny * gx + nx;
          // connect both ways
          tokens[idx] |= dirBit(d);
          tokens[nidx] |= dirBit(dirOpp(d));
          break;
        }
      }
    }

  // convert tokens to hex tokens
  const hexTokens = tokens.map(v => v.toString(16).toUpperCase());
  // format: gx gy fX fY endX endY data...
  const parts = [
    String(gx),
    String(gy),
    String(sx),
    String(sy),
    String(ex),
    String(ey),
    ...hexTokens,
  ];
  return parts.join(' ');
}

function generateBatch(count: number, difficulty: 'easy' | 'normal' | 'hard', seed: number) {
  const rnd = makeRng(seed);
  const out: string[] = [];
  for (let n = 0; n < count; n++) {
    let gx = 3,
      gy = 3;
    if (difficulty === 'easy') {
      gx = 3;
      gy = 3;
    } else if (difficulty === 'normal') {
      gx = rnd() < 0.5 ? 4 : 4;
      gy = rnd() < 0.5 ? 4 : 3;
    } else {
      gx = 5;
      gy = 5;
    }

    // pick faucet and goal on different edges
    const edges: ((gx: number, gy: number) => [number, number])[] = [
      (gx, gy) => [0, Math.floor(rnd() * gy)],
      (gx, gy) => [gx - 1, Math.floor(rnd() * gy)],
      (gx, gy) => [Math.floor(rnd() * gx), 0],
      (gx, gy) => [Math.floor(rnd() * gx), gy - 1],
    ];
    let fidx = Math.floor(rnd() * edges.length);
    let gidx = (fidx + 1 + Math.floor(rnd() * (edges.length - 1))) % edges.length;
    const [sx, sy] = edges[fidx](gx, gy);
    let [ex, ey] = edges[gidx](gx, gy);

    // choose desired path length ranges per difficulty
    const total = gx * gy;
    let minL = difficulty === 'easy' ? 3 : difficulty === 'normal' ? 5 : 8;
    let maxL =
      difficulty === 'easy'
        ? Math.min(total - 2, 5)
        : difficulty === 'normal'
          ? Math.min(total - 2, 10)
          : Math.min(total - 2, 14);
    if (minL > maxL) minL = Math.max(2, maxL - 1);

    // ensure start/end not same
    if (sx === ex && sy === ey) {
      // nudge end
      if (ex < gx - 1) ex++;
      else ex = Math.max(0, ex - 1);
    }

    const path = buildPath(sx, sy, ex, ey, gx, gy, minL, maxL, rnd) || [
      [sx, sy],
      [ex, ey],
    ];
    const s = buildLevelString(gx, gy, sx, sy, ex, ey, path, rnd);
    out.push(s);
  }
  return out;
}

export const easyLevels = generateBatch(16, 'easy', 12345);
export const normalLevels = generateBatch(16, 'normal', 23456);
export const hardLevels = generateBatch(16, 'hard', 34567);
