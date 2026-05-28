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
