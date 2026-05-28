import { CGFobject, CGFappearance } from "../../../lib/CGF.js";
import { MyRock } from "../entities/MyRock.js";
import { poissonDiskSamples } from "./distribute.js";

export class MyRockSet extends CGFobject {
  constructor(scene, amount, terrain, predefinedPositions = null) {
    super(scene);
    this.terrain = terrain;
    this.rocks = [];
    this.pathClearance = 15; // rocks need clearance from path and barn

    // Setup an appearance for the rocks (greyish dry stone)
    this.rockMaterial = new CGFappearance(this.scene);
    this.rockMaterial.setAmbient(0.3, 0.35, 0.3, 1);
    this.rockMaterial.setDiffuse(0.4, 0.45, 0.4, 1);
    this.rockMaterial.setSpecular(0.1, 0.1, 0.1, 1);
    this.rockMaterial.setShininess(10);
    
    // Pre-generate the rock transforms and geometry
    const positionsToUse = Array.isArray(predefinedPositions) ? predefinedPositions : null;
    let placedCount = 0;
    if (positionsToUse) {
      for (let i = 0; i < positionsToUse.length && placedCount < amount; i++) {
        const p = positionsToUse[i];
        const sx = p.x, sz = p.z;
        if (this.terrain?.isPointForbidden && this.terrain.isPointForbidden(sx, sz, this.pathClearance)) continue;

        let scaleX = 1.8 + Math.random() * 3.2;
        let scaleY = 1.8 + Math.random() * 3.2;
        let scaleZ = 1.8 + Math.random() * 3.2;
        let rotX = Math.random() * Math.PI;
        let rotY = Math.random() * Math.PI;
        let rotZ = Math.random() * Math.PI;

        this.rocks.push({
          rock: new MyRock(this.scene),
          x: sx,
          y: 0,
          z: sz,
          scaleX: scaleX,
          scaleY: scaleY,
          scaleZ: scaleZ,
          rotX: rotX,
          rotY: rotY,
          rotZ: rotZ,
          placed: false
        });
        placedCount++;
      }
    }

    // If we still need more, fall back to random sampling with spacing checks
    const maxAttempts = 200;
    const minSpacing = 12;
    while (placedCount < amount) {
      let attempts = 0;
      let x, z;
      do {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 290;
        x = Math.cos(angle) * radius;
        z = Math.sin(angle) * radius;
        attempts++;
        if (attempts > maxAttempts) break;
      } while (
        this.rocks.some(p => {
          const dx = p.x - x;
          const dz = p.z - z;
          return dx*dx + dz*dz < minSpacing*minSpacing;
        }) ||
        (this.terrain?.isPointForbidden && this.terrain.isPointForbidden(x, z, this.pathClearance))
      );

      if (attempts > maxAttempts) break;

      let scaleX = 1.8 + Math.random() * 3.2;
      let scaleY = 1.8 + Math.random() * 3.2;
      let scaleZ = 1.8 + Math.random() * 3.2;
      let rotX = Math.random() * Math.PI;
      let rotY = Math.random() * Math.PI;
      let rotZ = Math.random() * Math.PI;

      this.rocks.push({
        rock: new MyRock(this.scene),
        x: x,
        y: 0,
        z: z,
        scaleX: scaleX,
        scaleY: scaleY,
        scaleZ: scaleZ,
        rotX: rotX,
        rotY: rotY,
        rotZ: rotZ,
        placed: false
      });
      placedCount++;
    }
  }

  constrainCamera(cameraPosition) {
    for (let i = 0; i < this.rocks.length; i++) {
      const rock = this.rocks[i];

      if (!rock.placed) {
        continue;
      }

      const dx = cameraPosition[0] - rock.x;
      const dz = cameraPosition[2] - rock.z;
      const dy = cameraPosition[1] - rock.y;
      const radius = Math.max(rock.scaleX, rock.scaleY, rock.scaleZ) * 0.55;
      const distanceSquared = dx * dx + dy * dy + dz * dz;

      if (distanceSquared > 0 && distanceSquared < radius * radius) {
        const distance = Math.sqrt(distanceSquared);
        const scale = radius / distance;
        cameraPosition[0] = rock.x + dx * scale;
        cameraPosition[1] = rock.y + dy * scale;
        cameraPosition[2] = rock.z + dz * scale;
      }
    }
  }

  display() {
    this.rockMaterial.apply();

    // Since the heightmap image runs asynchronously, we check its height 
    // dynamically right before displaying. Once we get a valid heightmap,
    // we officially "place" the rocks onto the terrain so they don't recalculate.
    for (let i = 0; i < this.rocks.length; i++) {
      let r = this.rocks[i];

      if (!r.placed) {
        if (this.terrain.heightmapPixels) {
          // Find exactly how high this piece of terrain is
          let targetHeight = this.terrain.getHeightAt(r.x, r.z);
          // Sink the rock slightly into the ground so it feels rooted in the dirt
          r.y = targetHeight - (r.scaleY * 0.4);
          r.placed = true;
        } else {
          // Image map not ready yet! Skip drawing to hide it from flashing under the ground.
          continue; 
        }
      }

      this.scene.pushMatrix();
      this.scene.translate(r.x, r.y, r.z);
      this.scene.rotate(r.rotX, 1, 0, 0);
      this.scene.rotate(r.rotY, 0, 1, 0);
      this.scene.rotate(r.rotZ, 0, 0, 1);
      this.scene.scale(r.scaleX, r.scaleY, r.scaleZ);
      r.rock.display();
      this.scene.popMatrix();
    }
  }
}