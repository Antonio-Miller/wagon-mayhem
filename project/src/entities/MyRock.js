import { CGFobject } from "../../../lib/CGF.js";
import { MySphere } from "../primitives/MySphere.js";
import { SimplexNoise } from "../utils/SimplexNoise.js";

export class MyRock extends CGFobject {
  constructor(scene) {
    super(scene);
    
    // Choose a very low number of slices and stacks to give that angular, low-poly look
    const slices = Math.floor(Math.random() * 5) + 5; // 5 to 9 slices
    const stacks = Math.floor(Math.random() * 4) + 4; // 4 to 7 stacks
    
    this.sphere = new MySphere(scene, slices, stacks, 1.0, false);
    this.noise = new SimplexNoise(Math.floor(Math.random() * 0xffffffff));
    this.noiseOffset = Math.random() * 1000;
    
    const slicesCount = this.sphere.slices;
    const stacksCount = this.sphere.stacks;

    for (let i = 0; i <= stacksCount; i++) {
      for (let j = 0; j <= slicesCount; j++) {
        const wrappedJ = j === slicesCount ? 0 : j;
        const vertexIndex = (i * (slicesCount + 1) + j) * 3;
        const x = this.sphere.vertices[vertexIndex];
        const y = this.sphere.vertices[vertexIndex + 1];
        const z = this.sphere.vertices[vertexIndex + 2];

        const u = wrappedJ / slicesCount;
        const v = i / stacksCount;
        const noiseValue = this.noise.fbm2D(
          u * 3.5 + this.noiseOffset,
          v * 3.5 + this.noiseOffset,
          4
        );
        const equatorBias = Math.sin(v * Math.PI);
        const displacement = 1 + 0.18 * noiseValue * (0.35 + 0.65 * equatorBias);

        const nx = x * displacement;
        const ny = y * displacement;
        const nz = z * displacement;
        const length = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;

        this.sphere.vertices[vertexIndex] = nx;
        this.sphere.vertices[vertexIndex + 1] = ny;
        this.sphere.vertices[vertexIndex + 2] = nz;
        this.sphere.normals[vertexIndex] = nx / length;
        this.sphere.normals[vertexIndex + 1] = ny / length;
        this.sphere.normals[vertexIndex + 2] = nz / length;
      }
    }
    
    // Send the updated jagged vertices back to the GPU
    this.sphere.initGLBuffers();
  }

  display() {
    this.sphere.display();
  }
}