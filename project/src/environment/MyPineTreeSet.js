import { CGFobject } from "../../../lib/CGF.js";
import { MyPineTree } from "./MyPineTree.js";

export class MyPineTreeSet extends CGFobject {
  constructor(scene, amount, terrain) {
    super(scene);
    this.terrain = terrain;
    this.trees = [];

    // generate scattered positions with minimum spacing to avoid clustering
    const positions = [];
    const minSpacing = 32; // trees need more spacing
    const maxAttempts = 60;

    for (let i = 0; i < amount; i++) {
      let x, z;
      let attempts = 0;
      do {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 290;
        x = Math.cos(angle) * radius;
        z = Math.sin(angle) * radius;
        attempts++;
        if (attempts > maxAttempts) break;
      } while (positions.some(p => {
        const dx = p.x - x;
        const dz = p.z - z;
        return dx*dx + dz*dz < minSpacing*minSpacing;
      }));

      positions.push({x,z});

      const trunkHeight = 4 + Math.floor(Math.random() * 8); // 4..11
      const trunkRadius = 1 + Math.floor(Math.random() * 3); // 1..3

      const foliageRadiusMin = Math.max(4, trunkHeight + 1);
      const foliageRadius = foliageRadiusMin + Math.floor(Math.random() * (12 - foliageRadiusMin + 1));
      const foliageHeight = foliageRadius + 1 + Math.floor(Math.random() * 2);

      this.trees.push({
        tree: new MyPineTree(this.scene, trunkHeight, trunkRadius, foliageRadius, foliageHeight),
        x,
        y: 0,
        z,
        placed: false,
      });
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

      this.scene.pushMatrix();
      this.scene.translate(t.x, t.y, t.z);
      t.tree.display();
      this.scene.popMatrix();
    }
  }
}