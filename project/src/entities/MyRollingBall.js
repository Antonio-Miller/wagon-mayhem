import { CGFappearance, CGFobject } from "../../../lib/CGF.js";
import { MySphere } from "../primitives/MySphere.js";

export class MyRollingBall extends CGFobject {
  constructor(scene, radius = 1.4) {
    super(scene);
    this.radius = radius;
    this.sphere = new MySphere(scene, 18, 32, radius, false);
    this.body = null;
    this.spinX = 0;
    this.spinZ = 0;

    this.appearance = new CGFappearance(this.scene);
    this.appearance.setAmbient(0.55, 0.05, 0.05, 1.0);
    this.appearance.setDiffuse(0.9, 0.08, 0.08, 1.0);
    this.appearance.setSpecular(0.35, 0.12, 0.12, 1.0);
    this.appearance.setShininess(35.0);
  }

  setPhysicsBody(body) {
    this.body = body;
  }

  applyRollingFromDelta(deltaX, deltaZ) {
    if (!this.radius) {
      return;
    }

    this.spinX += deltaZ / this.radius;
    this.spinZ -= deltaX / this.radius;
  }

  display() {
    if (!this.body) {
      return;
    }

    const position = this.body.position;

    this.scene.pushMatrix();
    this.scene.translate(position[0], position[1], position[2]);
    this.scene.rotate(this.spinX, 1, 0, 0);
    this.scene.rotate(this.spinZ, 0, 0, 1);
    this.appearance.apply();
    if (this.sphere) this.sphere.display();
    this.scene.popMatrix();
  }

  unloadModel() {
    this.sphere = null;
    this.appearance = null;
  }

  loadModel() {
    if (!this.sphere) this.sphere = new MySphere(this.scene, 18, 32, this.radius, false);
    if (!this.appearance) {
      this.appearance = new CGFappearance(this.scene);
      this.appearance.setAmbient(0.55, 0.05, 0.05, 1.0);
      this.appearance.setDiffuse(0.9, 0.08, 0.08, 1.0);
      this.appearance.setSpecular(0.35, 0.12, 0.12, 1.0);
      this.appearance.setShininess(35.0);
    }
  }
}