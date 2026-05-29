import { CGFobject, CGFappearance } from "../../../lib/CGF.js";
import { MyCilinder } from "../primitives/MyCilinder.js";
import { MySphere } from "../primitives/MySphere.js";
import { OrganicPetal } from "../primitives/OrganicPetal.js";

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function mixColor(baseColor, variation, randomSign = Math.random() * 2 - 1) {
  return [
    clamp01(baseColor[0] + baseColor[0] * variation * randomSign),
    clamp01(baseColor[1] + baseColor[1] * variation * randomSign),
    clamp01(baseColor[2] + baseColor[2] * variation * randomSign),
    1.0,
  ];
}

export class MyFlower extends CGFobject {
  constructor(scene, options = {}) {
    super(scene);

    this.stemHeight = options.stemHeight ?? 1.9;
    this.stemRadius = options.stemRadius ?? 0.06;
    this.petalCount = options.petalCount ?? 7;
    this.leafCount = options.leafCount ?? 2;
    this.petalLength = options.petalLength ?? 0.86;
    this.petalWidth = options.petalWidth ?? 0.28;
    this.bloomRadius = options.bloomRadius ?? 0.14;
    this.petalAngleOffset = options.petalAngleOffset ?? Math.random() * Math.PI * 2;
    this.headLift = options.headLift ?? 0.06;

    const petalBase = options.petalColor ?? [0.92, 0.86, 0.28, 1.0];
    const centerBase = options.centerColor ?? [0.72, 0.55, 0.12, 1.0];
    const leafBase = options.leafColor ?? [0.28, 0.60, 0.18, 1.0];
    const stemBase = options.stemColor ?? [0.34, 0.62, 0.18, 1.0];

    const colorVariation = options.colorVariation ?? 0.14;

    this.stem = new MyCilinder(scene, 14, 1, 1, 1);
    this.center = new MySphere(scene, 8, 12, 1, false);
    this.petalMesh = new OrganicPetal(scene, 0.36, 0.96);
    this.leafMesh = new OrganicPetal(scene, 0.28, 0.88);

    this.stemAppearance = new CGFappearance(this.scene);
    this.stemAppearance.setAmbient(...mixColor(stemBase, colorVariation * 0.55));
    this.stemAppearance.setDiffuse(...mixColor(stemBase, colorVariation));
    this.stemAppearance.setSpecular(0.05, 0.05, 0.05, 1.0);
    this.stemAppearance.setShininess(4.0);

    this.petalAppearance = new CGFappearance(this.scene);
    this.petalAppearance.setAmbient(...mixColor(petalBase, colorVariation * 0.65));
    this.petalAppearance.setDiffuse(...mixColor(petalBase, colorVariation));
    this.petalAppearance.setSpecular(0.15, 0.15, 0.15, 1.0);
    this.petalAppearance.setShininess(10.0);

    this.centerAppearance = new CGFappearance(this.scene);
    this.centerAppearance.setAmbient(...mixColor(centerBase, colorVariation * 0.4));
    this.centerAppearance.setDiffuse(...mixColor(centerBase, colorVariation * 0.85));
    this.centerAppearance.setSpecular(0.08, 0.08, 0.08, 1.0);
    this.centerAppearance.setShininess(6.0);

    this.leafAppearance = new CGFappearance(this.scene);
    this.leafAppearance.setAmbient(...mixColor(leafBase, colorVariation * 0.45));
    this.leafAppearance.setDiffuse(...mixColor(leafBase, colorVariation * 0.8));
    this.leafAppearance.setSpecular(0.04, 0.04, 0.04, 1.0);
    this.leafAppearance.setShininess(4.0);

    this.leafPlacements = [];
    for (let i = 0; i < this.leafCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      this.leafPlacements.push({
        height: 0.48 + i * 0.22 + Math.random() * 0.12,
        angle: Math.random() * Math.PI * 2,
        tilt: 0.48 + Math.random() * 0.22,
        side,
      });
    }
  }

  display() {
    this.scene.pushMatrix();

    this.scene.pushMatrix();
    this.scene.scale(this.stemRadius, this.stemHeight, this.stemRadius);
    this.stemAppearance.apply();
    this.stem.display();
    this.scene.popMatrix();

    for (let i = 0; i < this.leafPlacements.length; i++) {
      const leaf = this.leafPlacements[i];

      this.scene.pushMatrix();
      this.scene.translate(0, this.stemHeight * leaf.height, 0);
      this.scene.rotate(leaf.angle, 0, 1, 0);
      this.scene.rotate(leaf.side * leaf.tilt, 0, 0, 1);
      this.scene.translate(0.08 * leaf.side, 0, 0.01 * leaf.side);
      this.scene.scale(0.24, 0.66, 0.22);
      this.leafAppearance.apply();
      this.leafMesh.display();
      this.scene.popMatrix();
    }

    this.scene.pushMatrix();
    this.scene.translate(0, this.stemHeight + this.headLift, 0);

    for (let i = 0; i < this.petalCount; i++) {
      const angle = this.petalAngleOffset + (i * Math.PI * 2) / this.petalCount;
      const tilt = 0.3 + 0.12 * Math.sin(i * 1.7 + this.petalAngleOffset);
      const spread = 0.0 + 0.008 * Math.cos(i * 2.1 + this.petalAngleOffset);

      this.scene.pushMatrix();
      this.scene.rotate(angle, 0, 1, 0);
      this.scene.rotate(-(Math.PI / 2 - tilt), 1, 0, 0);
      this.scene.translate(0.0, 0.0, spread);
      this.scene.scale(this.petalWidth * 1.8, this.petalLength * 1.25, this.petalWidth * 1.35);
      this.petalAppearance.apply();
      this.petalMesh.display();
      this.scene.popMatrix();
    }

    this.scene.scale(this.bloomRadius * 0.62, this.bloomRadius * 0.62, this.bloomRadius * 0.62);
    this.centerAppearance.apply();
    this.center.display();
    this.scene.popMatrix();

    this.scene.popMatrix();
  }
}