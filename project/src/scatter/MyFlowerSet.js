import { CGFobject } from "../../../lib/CGF.js";
import { MyFlower } from "./MyFlower.js";

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function pickBasePetalColor() {
  const palette = [
    [0.96, 0.92, 0.76, 1.0],
    [0.96, 0.92, 0.34, 1.0],
    [0.74, 0.38, 0.86, 1.0],
    [0.90, 0.56, 0.70, 1.0],
  ];

  return palette[Math.floor(Math.random() * palette.length)];
}

export class MyFlowerSet extends CGFobject {
  constructor(scene, amount, terrain, rocks = null, trees = null) {
    super(scene);
    this.terrain = terrain;
    this.rocks = rocks;
    this.trees = trees;
    this.flowers = [];
    this.pathClearance = 6;
    this.objectClearance = 4;

    this.thresholds = {
      stemHeight: [1.25, 2.8],
      stemRadius: [0.045, 0.08],
      petalCount: [5, 9],
      leafCount: [0, 3],
      colorVariation: [0.08, 0.22],
      bloomRadius: [0.12, 0.24],
      petalLength: [0.66, 1.08],
      petalWidth: [0.20, 0.34],
    };

    this.buildFlowers(amount);
  }

  isTooCloseToPlacedObjects(x, z) {
    const clearance = this.objectClearance;

    if (this.rocks?.rocks) {
      for (const rock of this.rocks.rocks) {
        const radius = Math.max(rock.scaleX, rock.scaleY, rock.scaleZ) * 0.55 + clearance;
        const dx = x - rock.x;
        const dz = z - rock.z;

        if (dx * dx + dz * dz < radius * radius) {
          return true;
        }
      }
    }

    if (this.trees?.trees) {
      for (const tree of this.trees.trees) {
        const radius = Math.max(tree.tree.trunkRadius, tree.tree.foliageRadius) * 1.02 + clearance;
        const dx = x - tree.x;
        const dz = z - tree.z;

        if (dx * dx + dz * dz < radius * radius) {
          return true;
        }
      }
    }

    return false;
  }

  isBlockedPosition(x, z, positions, minSpacing) {
    if (positions.some(p => {
      const dx = p.x - x;
      const dz = p.z - z;
      return dx * dx + dz * dz < minSpacing * minSpacing;
    })) {
      return true;
    }

    if (this.terrain?.isPointForbidden && this.terrain.isPointForbidden(x, z, this.pathClearance)) {
      return true;
    }

    return this.isTooCloseToPlacedObjects(x, z);
  }

  buildFlowers(amount) {
    const positions = [];
    const minSpacing = 5.5;
    const maxAttemptsPerFlower = 90;
    const clusterCount = Math.max(4, Math.ceil(amount / 6));
    const flowersPerCluster = Math.max(2, Math.round(amount / clusterCount));
    const clusterRadius = 18;

    for (let clusterIndex = 0; clusterIndex < clusterCount; clusterIndex++) {
      const clusterAngle = Math.random() * Math.PI * 2;
      const clusterDistance = Math.random() * 260;
      const clusterCenter = {
        x: Math.cos(clusterAngle) * clusterDistance,
        z: Math.sin(clusterAngle) * clusterDistance,
      };

      for (let i = 0; i < flowersPerCluster && this.flowers.length < amount; i++) {
        let x = clusterCenter.x;
        let z = clusterCenter.z;
        let attempts = 0;
        let validPosition = false;

        do {
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * clusterRadius;
          x = clusterCenter.x + Math.cos(angle) * radius;
          z = clusterCenter.z + Math.sin(angle) * radius;
          attempts++;

          if (attempts > maxAttemptsPerFlower) {
            break;
          }
        } while (
          this.isBlockedPosition(x, z, positions, minSpacing)
        );

        validPosition = attempts <= maxAttemptsPerFlower && !this.isBlockedPosition(x, z, positions, minSpacing);

        if (!validPosition) {
          continue;
        }

        positions.push({ x, z });

        const stemHeight = randomRange(...this.thresholds.stemHeight);
        const stemRadius = randomRange(...this.thresholds.stemRadius);
        const petalCount = Math.floor(randomRange(this.thresholds.petalCount[0], this.thresholds.petalCount[1] + 0.999));
        const leafCount = Math.floor(randomRange(this.thresholds.leafCount[0], this.thresholds.leafCount[1] + 0.999));
        const colorVariation = randomRange(...this.thresholds.colorVariation);
        const bloomRadius = randomRange(...this.thresholds.bloomRadius);
        const petalLength = randomRange(...this.thresholds.petalLength);
        const petalWidth = randomRange(...this.thresholds.petalWidth);

        this.flowers.push({
          flower: new MyFlower(this.scene, {
            stemHeight,
            stemRadius,
            petalCount,
            leafCount,
            bloomRadius,
            petalLength,
            petalWidth,
            colorVariation,
            petalColor: pickBasePetalColor(),
          }),
          x,
          y: 0,
          z,
          placed: false,
        });
      }
    }

    while (this.flowers.length < amount) {
      let x;
      let z;
      let attempts = 0;
      do {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 260;
        x = Math.cos(angle) * radius;
        z = Math.sin(angle) * radius;
        attempts++;

        if (attempts > maxAttemptsPerFlower) {
          break;
        }
      } while (this.isBlockedPosition(x, z, positions, minSpacing));

      if (this.isBlockedPosition(x, z, positions, minSpacing)) {
        break;
      }

      positions.push({ x, z });

      this.flowers.push({
        flower: new MyFlower(this.scene, {
          stemHeight: randomRange(...this.thresholds.stemHeight),
          stemRadius: randomRange(...this.thresholds.stemRadius),
          petalCount: Math.floor(randomRange(this.thresholds.petalCount[0], this.thresholds.petalCount[1] + 0.999)),
          leafCount: Math.floor(randomRange(this.thresholds.leafCount[0], this.thresholds.leafCount[1] + 0.999)),
          bloomRadius: randomRange(...this.thresholds.bloomRadius),
          petalLength: randomRange(...this.thresholds.petalLength),
          petalWidth: randomRange(...this.thresholds.petalWidth),
          colorVariation: randomRange(...this.thresholds.colorVariation),
          petalColor: pickBasePetalColor(),
        }),
        x,
        y: 0,
        z,
        placed: false,
      });
    }
  }

  display() {
    // Get camera position for distance culling
    const cam = this.scene.camera && this.scene.camera.position ? this.scene.camera.position : [0, 0, 0];
    const flowerRenderDist = 280;  // Render flowers within 280 units of camera

    for (let i = 0; i < this.flowers.length; i++) {
      const flowerEntry = this.flowers[i];

      if (!flowerEntry.placed) {
        if (this.terrain?.heightmapPixels) {
          flowerEntry.y = this.terrain.getHeightAt(flowerEntry.x, flowerEntry.z) + 0.02;
          flowerEntry.placed = true;
        } else {
          continue;
        }
      }

      // Distance culling: skip flowers that are too far
      const dx = cam[0] - flowerEntry.x;
      const dz = cam[2] - flowerEntry.z;
      const distSq = dx * dx + dz * dz;
      if (distSq > flowerRenderDist * flowerRenderDist) {
        continue;
      }

      this.scene.pushMatrix();
      this.scene.translate(flowerEntry.x, flowerEntry.y, flowerEntry.z);
      flowerEntry.flower.display();
      this.scene.popMatrix();
    }
  }
}