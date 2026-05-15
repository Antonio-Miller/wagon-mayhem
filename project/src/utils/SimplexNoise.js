function createRng(seed) {
  let state = seed >>> 0;
  if (state === 0) {
    state = 1;
  }

  return function nextRandom() {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SimplexNoise {
  constructor(seed = Math.floor(Math.random() * 0xffffffff)) {
    this.perm = new Uint8Array(512);

    const source = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      source[i] = i;
    }

    const random = createRng(seed);
    for (let i = 255; i >= 0; i--) {
      const r = Math.floor(random() * (i + 1));
      const value = source[r];
      source[r] = source[i];
      source[i] = value;
    }

    for (let i = 0; i < 512; i++) {
      this.perm[i] = source[i & 255];
    }
  }

  noise2D(xin, yin) {
    const F2 = 0.3660254037844386;
    const G2 = 0.21132486540518713;
    const grad3 = [
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
      [1, 0],
      [-1, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [0, 1],
      [0, -1],
    ];

    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;

    let i1;
    let j1;
    if (x0 > y0) {
      i1 = 1;
      j1 = 0;
    } else {
      i1 = 0;
      j1 = 1;
    }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;

    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.perm[ii + this.perm[jj]] % 12;
    const gi1 = this.perm[ii + i1 + this.perm[jj + j1]] % 12;
    const gi2 = this.perm[ii + 1 + this.perm[jj + 1]] % 12;

    let n0 = 0;
    let n1 = 0;
    let n2 = 0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      t0 *= t0;
      n0 = t0 * t0 * (grad3[gi0][0] * x0 + grad3[gi0][1] * y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      t1 *= t1;
      n1 = t1 * t1 * (grad3[gi1][0] * x1 + grad3[gi1][1] * y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
      t2 *= t2;
      n2 = t2 * t2 * (grad3[gi2][0] * x2 + grad3[gi2][1] * y2);
    }

    return 70 * (n0 + n1 + n2);
  }

  fbm2D(x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
    let amplitude = 0.5;
    let frequency = 1;
    let value = 0;

    for (let i = 0; i < octaves; i++) {
      value += amplitude * this.noise2D(x * frequency, y * frequency);
      frequency *= lacunarity;
      amplitude *= gain;
    }

    return value;
  }
}