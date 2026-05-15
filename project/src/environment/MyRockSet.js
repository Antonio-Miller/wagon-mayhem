import { CGFobject, CGFappearance } from "../../../lib/CGF.js";
import { MyRock } from "./MyRock.js";

export class MyRockSet extends CGFobject {
  constructor(scene, amount, terrain) {
    super(scene);
    this.terrain = terrain;
    this.rocks = [];

    // Setup an appearance for the rocks (greyish dry stone)
    this.rockMaterial = new CGFappearance(this.scene);
    this.rockMaterial.setAmbient(0.3, 0.35, 0.3, 1);
    this.rockMaterial.setDiffuse(0.4, 0.45, 0.4, 1);
    this.rockMaterial.setSpecular(0.1, 0.1, 0.1, 1);
    this.rockMaterial.setShininess(10);
    
    // Pre-generate the rock transforms and geometry
    for (let i = 0; i < amount; i++) {
        // Random angle and distance keeping them inside the dome (radius <= 290)
        let angle = Math.random() * Math.PI * 2;
        let radius = Math.random() * 290;
        
        let x = Math.cos(angle) * radius;
        let z = Math.sin(angle) * radius;
        
        // Randomize sizes to make them larger and more irregular
        let scaleX = 1.8 + Math.random() * 3.2;
        let scaleY = 1.8 + Math.random() * 3.2;
        let scaleZ = 1.8 + Math.random() * 3.2;
        
        // Random orientation
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
            placed: false // We cannot set their Y properly until the terrain's heightmap image has finished loading!
        });
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
