import { CGFobject } from "../../../lib/CGF.js";
import { MySphere } from "../primitives/MySphere.js";

export class MyRock extends CGFobject {
  constructor(scene) {
    super(scene);
    
    // Choose a very low number of slices and stacks to give that angular, low-poly look
    const slices = Math.floor(Math.random() * 5) + 5; // 5 to 9 slices
    const stacks = Math.floor(Math.random() * 4) + 4; // 4 to 7 stacks
    
    this.sphere = new MySphere(scene, slices, stacks, 1.0, false);
    
    // Jitter each vertex position slightly so it stops looking like a perfect sphere
    // and looks more like a jagged piece of rock.
    // Ensure that the poles and the seams (where slice 0 and slice N meet) 
    // get the same offset to prevent gaps in the mesh.
    const slicesCount = this.sphere.slices;
    const stacksCount = this.sphere.stacks;

    for (let i = 0; i <= stacksCount; i++) {
      // For the poles, we want a single uniform offset for all vertices at that pole
      let poleOffset = 0.8 + Math.random() * 0.4;
      
      // Generate offsets for the slices
      let sliceOffsets = [];
      for (let j = 0; j < slicesCount; j++) {
        sliceOffsets.push(0.8 + Math.random() * 0.4);
      }
      // The last slice wraps around and must match the first slice's offset
      sliceOffsets.push(sliceOffsets[0]);

      for (let j = 0; j <= slicesCount; j++) {
        let offset = sliceOffsets[j];
        
        // If it's a pole, override the offset
        if (i === 0 || (i === stacksCount && !this.sphere.hemisphere)) {
           offset = poleOffset;
        }

        let vertexIndex = (i * (slicesCount + 1) + j) * 3;
        this.sphere.vertices[vertexIndex] *= offset;
        this.sphere.vertices[vertexIndex + 1] *= offset;
        this.sphere.vertices[vertexIndex + 2] *= offset;
      }
    }
    
    // Send the updated jagged vertices back to the GPU
    this.sphere.initGLBuffers();
  }

  display() {
    this.sphere.display();
  }
}
