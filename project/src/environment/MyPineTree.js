import { CGFobject, CGFappearance } from "../../../lib/CGF.js";
import { MyCilinder } from "../primitives/MyCilinder.js";
import { MyCone } from "../primitives/MyCone.js";

export class MyPineTree extends CGFobject {
  constructor(scene, trunkHeight = 8, trunkRadius = 2, foliageRadius = 10, foliageHeight = 11) {
    super(scene);

    this.trunkHeight = trunkHeight;
    this.trunkRadius = trunkRadius;
    this.foliageRadius = foliageRadius;
    this.foliageHeight = foliageHeight;

    this.trunk = new MyCilinder(scene, 20, 1, 1, 1);
    this.lowerCrown = new MyCone(scene, 20, 1, 1, 1);
    this.upperCrown = new MyCone(scene, 20, 1, 1, 1);

    this.trunkAppearance = new CGFappearance(this.scene);
    this.trunkAppearance.setAmbient(0.35, 0.2, 0.08, 1.0);
    this.trunkAppearance.setDiffuse(0.45, 0.28, 0.12, 1.0);
    this.trunkAppearance.setSpecular(0.05, 0.05, 0.05, 1.0);
    this.trunkAppearance.setShininess(5.0);

    this.foliageAppearance = new CGFappearance(this.scene);
    this.foliageAppearance.setAmbient(0.12, 0.28, 0.12, 1.0);
    this.foliageAppearance.setDiffuse(0.18, 0.42, 0.18, 1.0);
    this.foliageAppearance.setSpecular(0.05, 0.05, 0.05, 1.0);
    this.foliageAppearance.setShininess(5.0);
  }

  display() {
    this.scene.pushMatrix();

    this.scene.scale(this.trunkRadius, this.trunkHeight, this.trunkRadius);
    this.trunkAppearance.apply();
    this.trunk.display();

    this.scene.popMatrix();

    this.scene.pushMatrix();
    this.scene.translate(0, this.trunkHeight, 0);
    this.scene.scale(this.foliageRadius, this.foliageHeight, this.foliageRadius);
    this.foliageAppearance.apply();
    this.lowerCrown.display();

    this.scene.popMatrix();

    this.scene.pushMatrix();
    this.scene.translate(0, this.trunkHeight + this.foliageHeight * 0.92, 0);
    this.scene.scale(this.foliageRadius * 0.72, this.foliageHeight * 0.72, this.foliageRadius * 0.72);
    this.foliageAppearance.apply();
    this.upperCrown.display();

    this.scene.popMatrix();
  }
}