import { CGFobject, CGFtexture, CGFappearance } from "../../../lib/CGF.js";
import { MySphere } from "../primitives/MySphere.js";

export class MySky extends CGFobject {
  constructor(scene) {
    super(scene);
    
    // Create half-sphere with inward-facing normals
    this.sphere = new MySphere(scene, 16, 32, 300, true, true);
    
    // Create a plain sky dome colored from time of day
    this.skyAppearance = new CGFappearance(this.scene);
    this.skyAppearance.setAmbient(0.72, 0.8, 0.9, 1);
    this.skyAppearance.setDiffuse(0.72, 0.8, 0.9, 1);
    this.skyAppearance.setSpecular(0, 0, 0, 1);
    this.skyAppearance.setEmission(0, 0, 0, 1);
    this.skyAppearance.setShininess(1);
  }

  display() {
    this.scene.pushMatrix();

    const skyProps = this.scene.computeSkyFromTime ? this.scene.computeSkyFromTime() : { ambient: [0.72, 0.8, 0.9, 1.0] };
    this.skyAppearance.setAmbient(skyProps.ambient[0], skyProps.ambient[1], skyProps.ambient[2], 1);
    this.skyAppearance.setDiffuse(skyProps.ambient[0], skyProps.ambient[1], skyProps.ambient[2], 1);

    this.scene.setActiveShader(this.scene.defaultShader);
    this.scene.enableTextures(false);
    this.skyAppearance.apply();
    
    this.sphere.display();

    this.scene.popMatrix();
  }
}
