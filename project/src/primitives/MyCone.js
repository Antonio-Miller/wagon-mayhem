import { CGFobject } from "../../../lib/CGF.js";

export class MyCone extends CGFobject {
  constructor(scene, slices = 32, stacks = 1, radius = 1, height = 1) {
    super(scene);
    this.slices = slices;
    this.stacks = stacks;
    this.radius = radius;
    this.height = height;
    this.initBuffers();
  }

  initBuffers() {
    this.vertices = [];
    this.indices = [];
    this.normals = [];
    this.texCoords = [];

    const alpha = (2 * Math.PI) / this.slices;
    const stride = this.slices + 1;
    const slope = this.height === 0 ? 0 : this.radius / this.height;

    for (let i = 0; i <= this.stacks; i++) {
      const v = i / this.stacks;
      const y = v * this.height;
      const currentRadius = this.radius * (1 - v);

      for (let j = 0; j <= this.slices; j++) {
        const u = j / this.slices;
        const angle = j * alpha;
        const cosAngle = Math.cos(angle);
        const sinAngle = Math.sin(angle);

        this.vertices.push(currentRadius * cosAngle, y, currentRadius * sinAngle);

        const normalLength = Math.sqrt(cosAngle * cosAngle + slope * slope + sinAngle * sinAngle);
        this.normals.push(cosAngle / normalLength, slope / normalLength, sinAngle / normalLength);
        this.texCoords.push(u, v);
      }
    }

    const baseCenterIndex = this.vertices.length / 3;
    this.vertices.push(0, 0, 0);
    this.normals.push(0, -1, 0);
    this.texCoords.push(0.5, 0.5);

    for (let j = 0; j < this.slices; j++) {
      const next = (j + 1) % this.slices;
      this.indices.push(baseCenterIndex, j, next);
    }

    for (let i = 0; i < this.stacks; i++) {
      for (let j = 0; j < this.slices; j++) {
        const first = i * stride + j;
        const second = first + stride;

        this.indices.push(first, second, first + 1);
        this.indices.push(second, second + 1, first + 1);
      }
    }

    this.primitiveType = this.scene.gl.TRIANGLES;
    this.initGLBuffers();
  }
}