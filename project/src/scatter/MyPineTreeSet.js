import { CGFobject } from "../../../lib/CGF.js";
import { MyPineTree } from "../entities/MyPineTree.js";
import { getArrayPool } from "../utils/ObjectPool.js";

export class MyPineTreeSet extends CGFobject {
  constructor(scene, amount, terrain, predefinedPositions = null) {
    super(scene);
    this.terrain = terrain;
    this.trees = [];
    this.pathClearance = 20; // trees need larger clearance from path and barn

    const positionsToUse = Array.isArray(predefinedPositions) ? predefinedPositions : null;
    let placedCount = 0;
    if (positionsToUse) {
      for (let i = 0; i < positionsToUse.length && placedCount < amount; i++) {
        const p = positionsToUse[i];
        const sx = p.x, sz = p.z;
        if (this.terrain?.isPointForbidden && this.terrain.isPointForbidden(sx, sz, this.pathClearance)) continue;

        const trunkHeight = 4 + Math.floor(Math.random() * 8); // 4..11
        const trunkRadius = 1 + Math.floor(Math.random() * 3); // 1..3

        const foliageRadiusMin = Math.max(4, trunkHeight + 1);
        const foliageRadius = foliageRadiusMin + Math.floor(Math.random() * (12 - foliageRadiusMin + 1));
        const foliageHeight = foliageRadius + 1 + Math.floor(Math.random() * 2);

        this.trees.push({
          tree: new MyPineTree(this.scene, trunkHeight, trunkRadius, foliageRadius, foliageHeight),
          x: sx,
          y: 0,
          z: sz,
          placed: false,
        });
        placedCount++;
      }
    }

  }

  constrainCamera(cameraPosition) {
    for (let i = 0; i < this.trees.length; i++) {
      const tree = this.trees[i];

      if (!tree.placed) {
        continue;
      }

      const trunkHeight = tree.tree.trunkHeight;
      const foliageHeight = tree.tree.foliageHeight;
      const collisionTop = tree.y + trunkHeight + foliageHeight * 1.92;
      const collisionRadius = Math.max(tree.tree.trunkRadius, tree.tree.foliageRadius) * 1.02;

      if (cameraPosition[1] < tree.y || cameraPosition[1] > collisionTop) {
        continue;
      }

      const dx = cameraPosition[0] - tree.x;
      const dz = cameraPosition[2] - tree.z;
      const distanceSquared = dx * dx + dz * dz;

      if (distanceSquared > 0 && distanceSquared < collisionRadius * collisionRadius) {
        const distance = Math.sqrt(distanceSquared);
        const scale = collisionRadius / distance;
        cameraPosition[0] = tree.x + dx * scale;
        cameraPosition[2] = tree.z + dz * scale;
      }
    }
  }

  display() {
    const cam = this.scene.camera && this.scene.camera.position ? this.scene.camera.position : [0, 0, 0];
    const treeRenderDist = 380;  // Render trees within 380 units of camera
    const arrayPool = getArrayPool();

    for (let i = 0; i < this.trees.length; i++) {
      const t = this.trees[i];

      if (!t.placed) {
        if (this.terrain.heightmapPixels) {
          const targetHeight = this.terrain.getHeightAt(t.x, t.z);
          t.y = targetHeight;
          t.placed = true;
        } else {
          continue;
        }
      }

      // Distance culling: skip trees that are too far
      const dx = cam[0] - t.x;
      const dz = cam[2] - t.z;
      const distSq = dx * dx + dz * dz;
      if (distSq > treeRenderDist * treeRenderDist) {
        continue;
      }

      this.scene.pushMatrix();
      this.scene.translate(t.x, t.y, t.z);
      t.tree.display();
      this.scene.popMatrix();
    }
    arrayPool.releaseAll();
  }
}