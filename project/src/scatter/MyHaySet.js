import { CGFobject } from "../../../lib/CGF.js";
import { MyHayBaleRound } from "../entities/MyHayBaleRound.js";

export class MyHaySet extends CGFobject {
  constructor(scene, amount, terrain, rockSet = null, treeSet = null) {
    super(scene);
    this.terrain = terrain;
    this.rocks = rockSet ? (rockSet.rocks || []) : [];
    this.trees = treeSet ? (treeSet.trees || []) : [];
    this.hay = [];
    this.pathClearance = 8; // avoid path and barn (terrain.isPointForbidden handles barn and paths)
    this.domeRadius = 200; // Constrain hay generation to dome radius with margin

    const positions = [];
    const minSpacing = 4; // minimum spacing between hay bales (smaller objects)
    const minDistanceToRockOrTree = 10; // user requirement
    const maxAttempts = 80;

    for (let i = 0; i < amount; i++) {
      let x, z;
      let attempts = 0;
      do {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * this.domeRadius;
        x = Math.cos(angle) * radius;
        z = Math.sin(angle) * radius;
        attempts++;
        if (attempts > maxAttempts) break;
      } while (
        positions.some(p => {
          const dx = p.x - x;
          const dz = p.z - z;
          return dx*dx + dz*dz < minSpacing*minSpacing;
        }) ||
        (this.terrain?.isPointForbidden && this.terrain.isPointForbidden(x, z, this.pathClearance)) ||
        this._isTooCloseToRocksOrTrees(x, z, minDistanceToRockOrTree)
      );

      positions.push({ x, z });

      // Fixed scale for consistent hay bales
      const scale = 8.0;

      this.hay.push({
        bale: new MyHayBaleRound(this.scene, scale),
        x,
        y: 0,
        z,
        scale,
        collected: false,
      });
    }
  }

  _isTooCloseToRocksOrTrees(x, z, minDist) {
    const minDistSq = minDist * minDist;
    for (const r of this.rocks) {
      const dx = r.x - x;
      const dz = r.z - z;
      if (dx*dx + dz*dz < minDistSq) return true;
    }
    for (const t of this.trees) {
      const dx = t.x - x;
      const dz = t.z - z;
      if (dx*dx + dz*dz < minDistSq) return true;
    }
    return false;
  }

  display() {
    for (let i = 0; i < this.hay.length; i++) {
      const h = this.hay[i];

      if (h.collected) {
        continue;
      }

      // If the bale manages its own physics and position, let it render itself
      if (h.bale && typeof h.bale.display === 'function') {
        // Ensure model ready before rendering
        if (!h.bale.model || !h.bale.model.inited) continue;
        h.bale.display();
      }
    }
  }
}
