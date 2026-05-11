import { CGFobject } from "../../../lib/CGF.js";

export class MySphere extends CGFobject {
  constructor(scene, stacks = 16, slices = 32, radius = 1, hemisphere = false) {
    super(scene);
    this.stacks = stacks;
    this.slices = slices;
    this.radius = radius;
    this.hemisphere = hemisphere;
    this.initBuffers();
  }

  initBuffers() {
    this.vertices = [];
    this.indices = [];
    this.normals = [];
    this.texCoords = [];

    const thetaMax = this.hemisphere ? Math.PI / 2 : Math.PI;
    
    for (let i = 0; i <= this.stacks; i++) {
      const theta = (i * thetaMax) / this.stacks;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      for (let j = 0; j <= this.slices; j++) {
        const phi = (j * 2 * Math.PI) / this.slices;
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);

        const x = this.radius * sinTheta * cosPhi;
        const y = this.radius * cosTheta;
        const z = this.radius * sinTheta * sinPhi;

        this.vertices.push(x, y, z);
        this.normals.push(-sinTheta * cosPhi, -cosTheta, -sinTheta * sinPhi);
        this.texCoords.push(j / this.slices, i / this.stacks);
      }
    }

    for (let i = 0; i < this.stacks; i++) {
      for (let j = 0; j < this.slices; j++) {
        const first = i * (this.slices + 1) + j;
        const second = first + this.slices + 1;

        this.indices.push(first, second, first + 1);
        this.indices.push(second, second + 1, first + 1);
      }
    }

    this.primitiveType = this.scene.gl.TRIANGLES;
    this.initGLBuffers();
  }
}
