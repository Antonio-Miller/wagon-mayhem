import { CGFobject, CGFshader } from "../../../lib/CGF.js";
import { getVec3Pool, getArrayPool } from "../utils/ObjectPool.js";

class GrassPatch extends CGFobject {
  constructor(scene, bladeSpecs) {
    super(scene);
    this.bladeSpecs = bladeSpecs;
    this.initBuffers();
  }

  initBuffers() {
    this.vertices = [];
    this.indices = [];
    this.normals = [];
    this.texCoords = [];

    for (const blade of this.bladeSpecs) {
      const baseIndex = this.vertices.length / 3;
      const halfBottom = blade.width * 0.5;
      const halfTop = blade.width * 0.18;

      const localPoints = [
        [-halfBottom, 0, 0, 0, 0],
        [halfBottom, 0, 0, 1, 0],
        [-halfTop, blade.height, 0, 0, 1],
        [halfTop, blade.height, 0, 1, 1],
      ];

      const cosYaw = Math.cos(blade.yaw);
      const sinYaw = Math.sin(blade.yaw);
      const cosTilt = Math.cos(blade.tilt);
      const sinTilt = Math.sin(blade.tilt);

      for (const [x, y, z, u, v] of localPoints) {
        const tiltedY = y * cosTilt;
        const tiltedZ = y * sinTilt;

        const rotatedX = x * cosYaw - tiltedZ * sinYaw;
        const rotatedZ = x * sinYaw + tiltedZ * cosYaw;

        this.vertices.push(rotatedX + blade.offsetX, tiltedY, rotatedZ + blade.offsetZ);
        this.normals.push(0, 0, 1);
        this.texCoords.push(u, v);
      }

      this.indices.push(
        baseIndex, baseIndex + 1, baseIndex + 2,
        baseIndex + 1, baseIndex + 3, baseIndex + 2
      );
    }

    this.primitiveType = this.scene.gl.TRIANGLES;
    this.initGLBuffers();
  }
}

export class MyGrass extends CGFobject {
  constructor(scene, terrain, patchSpacing = 3.5) {
    super(scene);
    this.terrain = terrain;
    this.basePatchSpacing = patchSpacing;
    this.patchSpacing = patchSpacing;
    this.pathClearance = 4;
    this.time = 0;
    this.patches = [];
    this.meshVariants = [];
    this.meshVariantCount = 18;
    this.placementCursor = 0;
    this.placementBudgetPerFrame = 3000;
    this.densityScale = 1.0;
    this.renderRadius = 90;
    this.renderRadiusFar = 300;
    this.lodFarFactor = 4;

    this.shader = new CGFshader(
      this.scene.gl,
      "/project/src/shaders/grass.vert",
      "/project/src/shaders/grass.frag"
    );
    this.shader.setUniformsValues({
      uTime: 0,
      uGrassColor: [0.18, 0.48, 0.12, 1.0],
    });
    this.buildMeshVariants();
    this.buildPatches();
  }

  randomRange(min, max) {
    return min + Math.random() * (max - min);
  }

  createBladeSpecs() {
    const specs = [];
    const bladeCount = 6;

    for (let i = 0; i < bladeCount; i++) {
      specs.push({
        offsetX: this.randomRange(-1.0, 1.0),
        offsetZ: this.randomRange(-1.0, 1.0),
        width: this.randomRange(0.07, 0.15),
        height: this.randomRange(1.3, 2.5),
        yaw: this.randomRange(0, Math.PI * 2),
        tilt: this.randomRange(-0.12, 0.16),
      });
    }

    return specs;
  }

  buildMeshVariants() {
    for (let i = 0; i < this.meshVariantCount; i++) {
      this.meshVariants.push(new GrassPatch(this.scene, this.createBladeSpecs()));
    }
  }

  buildPatches() {
    const halfSize = this.terrain?.halfSize ?? 400;
    const step = this.patchSpacing;
    const jitter = step * 0.18;

    for (let x = -halfSize; x <= halfSize; x += step) {
      for (let z = -halfSize; z <= halfSize; z += step) {
        const sampleX = x + this.randomRange(-jitter, jitter);
        const sampleZ = z + this.randomRange(-jitter, jitter);

        if (this.terrain?.isPointForbidden && this.terrain.isPointForbidden(sampleX, sampleZ, this.pathClearance)) {
          continue;
        }

        this.patches.push({
          x: sampleX,
          y: 0,
          z: sampleZ,
          placed: false,
          meshVariant: Math.floor(Math.random() * this.meshVariantCount),
        });
      }
    }
  }

  rebuildPatches() {
    this.patches = [];
    this.placementCursor = 0;
    this.buildPatches();
  }

  setGrassDensity(density) {
    const clampedDensity = Math.max(0.25, Math.min(1.0, density));

    if (Math.abs(clampedDensity - this.densityScale) < 1e-6) {
      return;
    }

    this.densityScale = clampedDensity;
    this.patchSpacing = this.basePatchSpacing / Math.sqrt(this.densityScale);
    this.rebuildPatches();
  }

  setRenderDistance(renderDistance) {
    const clampedDistance = Math.max(250, Math.min(1200, renderDistance));
    this.renderRadiusFar = clampedDistance;
    this.renderRadius = Math.max(40, clampedDistance * 0.3);
  }

  update(time) {
    this.time = time;
    this.shader.setUniformsValues({ uTime: time });
  }

  placePendingPatches() {
    if (!this.terrain.heightmapPixels || this.placementCursor >= this.patches.length) {
      return;
    }

    const end = Math.min(this.patches.length, this.placementCursor + this.placementBudgetPerFrame);

    for (let i = this.placementCursor; i < end; i++) {
      const patch = this.patches[i];
      patch.y = this.terrain.getHeightAt(patch.x, patch.z) + 0.03;
      patch.placed = true;
    }

    this.placementCursor = end;
  }

  display() {
    if (!this.patches.length) {
      return;
    }

    this.placePendingPatches();

    const gl = this.scene.gl;
    const previousTexturesEnabled = this.scene.texturesEnabled;
    const cullEnabled = gl.isEnabled(gl.CULL_FACE);
    const arrayPool = getArrayPool();

    this.scene.setActiveShader(this.shader);
    this.scene.enableTextures(false);
    if (cullEnabled) {
      gl.disable(gl.CULL_FACE);
    }

    this.shader.setUniformsValues({
      uTime: this.time,
      uGrassColor: [0.18, 0.48, 0.12, 1.0],
    });

    const cam = this.scene.camera && this.scene.camera.position ? this.scene.camera.position : [0, 0, 0];
    const renderRadiusFarSq = this.renderRadiusFar * this.renderRadiusFar;
    const renderRadiusSq = this.renderRadius * this.renderRadius;

    for (const patch of this.patches) {
      if (!patch.placed) {
        continue;
      }

      const dx = cam[0] - patch.x;
      const dz = cam[2] - patch.z;
      const dist2 = dx * dx + dz * dz;

      if (dist2 > renderRadiusFarSq) continue; // too far, skip

      if (dist2 > renderRadiusSq) {
        // Far LOD: only render a subset deterministically to reduce draw calls
        const key = Math.floor(patch.x * 7 + patch.z * 13) | 0;
        if ((key % this.lodFarFactor) !== 0) continue;
      }

      this.scene.pushMatrix();
      this.scene.translate(patch.x, patch.y, patch.z);
      this.meshVariants[patch.meshVariant].display();
      this.scene.popMatrix();
    }

    if (cullEnabled) {
      gl.enable(gl.CULL_FACE);
    }
    arrayPool.releaseAll();
    this.scene.enableTextures(previousTexturesEnabled);
    this.scene.setActiveShader(this.scene.defaultShader);
  }
}