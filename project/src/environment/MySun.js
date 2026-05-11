import { CGFlight } from "../../../lib/CGF.js";

export class MySun extends CGFlight {
  constructor(scene, lightIndex = 0) {
    super(scene);
    this.lightIndex = lightIndex;
    
    // Configure as a directional light with warm color
    // Position: high angle, warm colour (0.9, 0.85, 0.7)
    this.setPosition(150, 200, 100, 0); // 0 = directional (infinite distance)
    this.setDiffuse(0.9, 0.85, 0.7, 1.0);
    this.setSpecular(0.9, 0.85, 0.7, 1.0);
    this.setAmbient(0.3, 0.3, 0.3, 1.0);
    
    this.enable();
  }

  update() {
    // Can add time-based rotation of sun direction here if needed
    // For now, static positioning
  }

  display() {
    this.update();
  }
}
