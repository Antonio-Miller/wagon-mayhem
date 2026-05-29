/**
 * ObjectPool - Generic object pooling utility for memory-efficient reuse
 * Reduces GC pressure by pre-allocating and reusing objects in tight loops
 */

export class ObjectPool {
  constructor(factory, resetFn = null, initialSize = 512) {
    this.factory = factory;
    this.resetFn = resetFn;
    this.available = [];
    this.inUse = new Set();

    // Pre-allocate pool
    for (let i = 0; i < initialSize; i++) {
      this.available.push(this.factory());
    }
  }

  acquire() {
    let obj;
    if (this.available.length > 0) {
      obj = this.available.pop();
    } else {
      obj = this.factory();
    }
    this.inUse.add(obj);
    return obj;
  }

  release(obj) {
    if (this.inUse.has(obj)) {
      this.inUse.delete(obj);
      if (this.resetFn) this.resetFn(obj);
      this.available.push(obj);
    }
  }

  releaseAll() {
    for (const obj of this.inUse) {
      if (this.resetFn) this.resetFn(obj);
      this.available.push(obj);
    }
    this.inUse.clear();
  }

  getStats() {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      total: this.available.length + this.inUse.size,
    };
  }
}

/**
 * Float32Array pool for vector operations (3D positions, colors, etc)
 */
export class Vec3Pool {
  constructor(initialSize = 1024) {
    this.pool = new ObjectPool(
      () => new Float32Array(3),
      (v) => v.fill(0),
      initialSize
    );
  }

  acquire() {
    return this.pool.acquire();
  }

  release(vec) {
    this.pool.release(vec);
  }

  releaseAll() {
    this.pool.releaseAll();
  }

  getStats() {
    return this.pool.getStats();
  }
}

/**
 * Mat4-like pool (16-element arrays for 4x4 matrices)
 */
export class Mat4Pool {
  constructor(initialSize = 256) {
    this.pool = new ObjectPool(
      () => {
        const m = new Float32Array(16);
        // identity matrix
        m[0] = m[5] = m[10] = m[15] = 1;
        return m;
      },
      (m) => {
        m.fill(0);
        m[0] = m[5] = m[10] = m[15] = 1;
      },
      initialSize
    );
  }

  acquire() {
    return this.pool.acquire();
  }

  release(mat) {
    this.pool.release(mat);
  }

  releaseAll() {
    this.pool.releaseAll();
  }

  getStats() {
    return this.pool.getStats();
  }
}

/**
 * Array pool for temporary work buffers
 */
export class ArrayPool {
  constructor(initialSize = 256) {
    this.pool = new ObjectPool(
      () => [],
      (arr) => arr.length = 0,
      initialSize
    );
  }

  acquire() {
    return this.pool.acquire();
  }

  release(arr) {
    this.pool.release(arr);
  }

  releaseAll() {
    this.pool.releaseAll();
  }

  getStats() {
    return this.pool.getStats();
  }
}

/**
 * Lightweight distance-check result object pool
 */
export class DistanceCheckPool {
  constructor(initialSize = 512) {
    this.pool = new ObjectPool(
      () => ({ x: 0, z: 0, distSq: 0, passed: false }),
      (obj) => {
        obj.x = 0;
        obj.z = 0;
        obj.distSq = 0;
        obj.passed = false;
      },
      initialSize
    );
  }

  acquire() {
    return this.pool.acquire();
  }

  release(obj) {
    this.pool.release(obj);
  }

  releaseAll() {
    this.pool.releaseAll();
  }

  getStats() {
    return this.pool.getStats();
  }
}

/**
 * Global pool instances (lazy-initialized on first use)
 */
let _vec3Pool = null;
let _mat4Pool = null;
let _arrayPool = null;
let _distanceCheckPool = null;

export function getVec3Pool() {
  if (!_vec3Pool) _vec3Pool = new Vec3Pool();
  return _vec3Pool;
}

export function getMat4Pool() {
  if (!_mat4Pool) _mat4Pool = new Mat4Pool();
  return _mat4Pool;
}

export function getArrayPool() {
  if (!_arrayPool) _arrayPool = new ArrayPool();
  return _arrayPool;
}

export function getDistanceCheckPool() {
  if (!_distanceCheckPool) _distanceCheckPool = new DistanceCheckPool();
  return _distanceCheckPool;
}
