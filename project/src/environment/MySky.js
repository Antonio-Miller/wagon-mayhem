import { CGFobject, CGFtexture, CGFappearance } from "../../../lib/CGF.js";
import { MySphere } from "../primitives/MySphere.js";

export class MySky extends CGFobject {
  constructor(scene) {
    super(scene);
    
    // Create half-sphere with radius 200 and inward-facing normals
    this.sphere = new MySphere(scene, 16, 32, 300, true, true);
    
    // Load sky texture
    this.skyTexture = new CGFtexture(this.scene, '/project/textures/sky.jpg');
    
    // Create emissive material so the texture is unlit (doesn't respond to lights)
    this.skyAppearance = new CGFappearance(this.scene);
    this.skyAppearance.setAmbient(1, 1, 1, 1);
    this.skyAppearance.setDiffuse(0, 0, 0, 1);
    this.skyAppearance.setSpecular(0, 0, 0, 1);
    this.skyAppearance.setEmission(1, 1, 1, 1);
    this.skyAppearance.setShininess(1);
    this.skyAppearance.setTexture(this.skyTexture);
  }

  display() {
    // Skip rendering until texture is loaded
    if (!this.skyTexture || this.skyTexture.texID === -1) {
      return;
    }

    this.scene.pushMatrix();

    // Enable textures and set appearance
    this.scene.setActiveShader(this.scene.defaultShader);
    this.scene.enableTextures(true);
    this.skyAppearance.apply();
    
    this.sphere.display();


    this.scene.popMatrix();
  }
}
