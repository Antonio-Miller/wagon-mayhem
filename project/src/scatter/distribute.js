// Poisson-disc sampling (Bridson) for 2D circle region
export function poissonDiskSamples(radius, minDist, k = 30) {
  const cellSize = minDist / Math.SQRT2;
  const gridW = Math.ceil((radius * 2) / cellSize);
  const gridH = gridW;
  const grid = new Array(gridW * gridH).fill(null);

  const samples = [];
  const active = [];

  function toGridCoords(x, y) {
    const gx = Math.floor((x + radius) / cellSize);
    const gy = Math.floor((y + radius) / cellSize);
    return [gx, gy];
  }

  // start with a random initial point inside circle
  const angle0 = Math.random() * Math.PI * 2;
  const r0 = Math.sqrt(Math.random()) * radius;
  const x0 = Math.cos(angle0) * r0;
  const y0 = Math.sin(angle0) * r0;
  samples.push([x0, y0]);
  active.push([x0, y0]);
  const [g0x, g0y] = toGridCoords(x0, y0);
  grid[g0y * gridW + g0x] = 0;

  while (active.length) {
    const idx = Math.floor(Math.random() * active.length);
    const [ax, ay] = active[idx];
    let found = false;
    for (let i = 0; i < k; i++) {
      const a = Math.random() * Math.PI * 2;
      const m = minDist * (1 + Math.random());
      const sx = ax + Math.cos(a) * m;
      const sy = ay + Math.sin(a) * m;
      if (sx * sx + sy * sy > radius * radius) continue;

      const [sgx, sgy] = toGridCoords(sx, sy);
      let ok = true;
      const startX = Math.max(0, sgx - 2);
      const endX = Math.min(gridW - 1, sgx + 2);
      const startY = Math.max(0, sgy - 2);
      const endY = Math.min(gridH - 1, sgy + 2);
      for (let gy = startY; gy <= endY && ok; gy++) {
        for (let gx = startX; gx <= endX; gx++) {
          const gidx = gy * gridW + gx;
          const sidx = grid[gidx];
          if (sidx === null) continue;
          const [px, py] = samples[sidx];
          const dx = px - sx;
          const dy = py - sy;
          if (dx * dx + dy * dy < minDist * minDist) {
            ok = false; break;
          }
        }
      }

      if (ok) {
        const sIndex = samples.length;
        samples.push([sx, sy]);
        active.push([sx, sy]);
        grid[sgy * gridW + sgx] = sIndex;
        found = true;
        break;
      }
    }
    if (!found) active.splice(idx, 1);
  }

  return samples;
}

function hasNearbyPosition(positions, x, z, minDist) {
  const minDistSq = minDist * minDist;
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    const dx = p.x - x;
    const dz = p.z - z;
    if (dx * dx + dz * dz < minDistSq) return true;
  }
  return false;
}

function shuffleInPlace(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = array[i];
    array[i] = array[j];
    array[j] = tmp;
  }
}

function buildPlacementOrder(treeCount, rockCount) {
  const order = [];
  let remainingTrees = treeCount;
  let remainingRocks = rockCount;

  while (remainingTrees > 0 || remainingRocks > 0) {
    const chooseTree = remainingTrees > 0 && (
      remainingRocks === 0 || remainingTrees >= remainingRocks
    );
    if (chooseTree) {
      order.push("tree");
      remainingTrees--;
    } else {
      order.push("rock");
      remainingRocks--;
    }
  }

  return order;
}

export function distributeMixedRocksAndTrees({
  radius,
  treeCount,
  rockCount,
  treeMinDist = 32,
  rockMinDist = 12,
  crossMinDist = 18,
  baseMinDist = 10,
  k = 30,
  forbiddenFn = null,
}) {
  const trees = [];
  const rocks = [];
  const order = buildPlacementOrder(treeCount, rockCount);
  const relaxation = [1.0, 0.92, 0.85, 0.78];

  for (let pass = 0; pass < relaxation.length; pass++) {
    if (trees.length >= treeCount && rocks.length >= rockCount) break;

    const factor = relaxation[pass];
    const passTreeMinDist = treeMinDist * factor;
    const passRockMinDist = rockMinDist * factor;
    const passCrossMinDist = crossMinDist * factor;
    const passBaseMinDist = Math.max(2, baseMinDist * factor);

    const candidatesRaw = poissonDiskSamples(radius, passBaseMinDist, k);
    const candidates = candidatesRaw.map(([x, z]) => ({ x, z }));
    shuffleInPlace(candidates);

    const used = new Set();
    for (let oi = 0; oi < order.length; oi++) {
      const kind = order[oi];

      if (kind === "tree" && trees.length >= treeCount) continue;
      if (kind === "rock" && rocks.length >= rockCount) continue;

      for (let ci = 0; ci < candidates.length; ci++) {
        if (used.has(ci)) continue;
        const c = candidates[ci];
        if (typeof forbiddenFn === "function" && forbiddenFn(c.x, c.z, kind)) continue;

        if (kind === "tree") {
          if (hasNearbyPosition(trees, c.x, c.z, passTreeMinDist)) continue;
          if (hasNearbyPosition(rocks, c.x, c.z, passCrossMinDist)) continue;
          trees.push({ x: c.x, z: c.z });
          used.add(ci);
          break;
        }

        if (hasNearbyPosition(rocks, c.x, c.z, passRockMinDist)) continue;
        if (hasNearbyPosition(trees, c.x, c.z, passCrossMinDist)) continue;
        rocks.push({ x: c.x, z: c.z });
        used.add(ci);
        break;
      }

      if (trees.length >= treeCount && rocks.length >= rockCount) break;
    }
  }

  return {
    treePositions: trees.slice(0, treeCount),
    rockPositions: rocks.slice(0, rockCount),
  };
}
