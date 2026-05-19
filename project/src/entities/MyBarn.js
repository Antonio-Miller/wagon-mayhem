import { CGFobject, CGFappearance } from "../../../lib/CGF.js";
import { MyParallelpiped } from "../primitives/MyParallelpiped.js";
import { MyIsosceleTriangularPrism } from "../primitives/MyIsosceleTriangularPrism.js";

export class MyBarn extends CGFobject {
  constructor(scene, terrain, positionX = 0, positionZ = 0, width = 20, bodyHeight = 15, roofHeight = 10, depth = 30) {
    super(scene);

    this.terrain = terrain;
    this.positionX = positionX;
    this.positionZ = positionZ;
    this.width = width;
    this.bodyHeight = bodyHeight;
    this.roofHeight = roofHeight;
    this.depth = depth;
    this.groundSink = 7;

    // Create barn body (parallelpiped)
    this.body = new MyParallelpiped(scene, width, bodyHeight, depth);

    // Create barn roof (isosceles triangular prism)
    this.roof = new MyIsosceleTriangularPrism(scene, width, roofHeight, depth);

    // Create appearance for barn body (red)
    this.bodyAppearance = new CGFappearance(this.scene);
    this.bodyAppearance.setAmbient(0.45, 0.05, 0.05, 1.0);
    this.bodyAppearance.setDiffuse(0.8, 0.1, 0.1, 1.0);
    this.bodyAppearance.setSpecular(0.1, 0.1, 0.1, 1.0);
    this.bodyAppearance.setShininess(8.0);

    // Create appearance for barn roof (white)
    this.roofAppearance = new CGFappearance(this.scene);
    this.roofAppearance.setAmbient(0.9, 0.9, 0.9, 1.0);
    this.roofAppearance.setDiffuse(1.0, 1.0, 1.0, 1.0);
    this.roofAppearance.setSpecular(0.1, 0.1, 0.1, 1.0);
    this.roofAppearance.setShininess(8.0);
  }

  display() {
    const positionY = this.terrain ? this.terrain.getHeightAt(this.positionX, this.positionZ) : 0;

    this.scene.pushMatrix();
    this.scene.translate(this.positionX, positionY + this.bodyHeight / 2 - this.groundSink, this.positionZ);

    // Display barn body
    this.bodyAppearance.apply();
    this.body.display();

    // Display barn roof (positioned on top of body)
    this.scene.translate(0, this.bodyHeight / 2, 0);
    this.roofAppearance.apply();
    this.roof.display();
    this.scene.popMatrix();
  }
}
