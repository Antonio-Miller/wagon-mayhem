import { CGFobject } from "../../../lib/CGF.js";

export class MyCilinder extends CGFobject {
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

    for (let i = 0; i <= this.stacks; i++) {
      const v = i / this.stacks;
      const y = v * this.height;

      for (let j = 0; j <= this.slices; j++) {
        const u = j / this.slices;
        const angle = j * alpha;
        const cosAngle = Math.cos(angle);
        const sinAngle = Math.sin(angle);

        this.vertices.push(this.radius * cosAngle, y, this.radius * sinAngle);
        this.normals.push(cosAngle, 0, sinAngle);
        this.texCoords.push(u, v);
      }
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