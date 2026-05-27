import { CGFobject } from "../../../lib/CGF.js";

export class MyCilinder extends CGFobject {
  constructor(scene, slices = 32, stacks = 1, radius = 1, height = 1, hasCaps = true) {
    super(scene);
    this.slices = slices;
    this.stacks = stacks;
    this.radius = radius;
    this.height = height;
    this.hasCaps = hasCaps;
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

        this.indices.push(first, first + 1, second);
        this.indices.push(second, first + 1, second + 1);
      }
    }

    if (this.hasCaps) {
      const bottomCenterIndex = this.vertices.length / 3;
      this.vertices.push(0, 0, 0);
      this.normals.push(0, -1, 0);
      this.texCoords.push(0.5, 0.5);

      for (let j = 0; j <= this.slices; j++) {
        const u = j / this.slices;
        const angle = j * alpha;
        const x = this.radius * Math.cos(angle);
        const z = this.radius * Math.sin(angle);
        this.vertices.push(x, 0, z);
        this.normals.push(0, -1, 0);
        this.texCoords.push(0.5 + (x / (2 * this.radius)), 0.5 + (z / (2 * this.radius)));
      }

      for (let j = 0; j < this.slices; j++) {
        const first = bottomCenterIndex + j + 1;
        const second = bottomCenterIndex + j + 2;
        this.indices.push(bottomCenterIndex, second, first);
      }

      const topCenterIndex = this.vertices.length / 3;
      this.vertices.push(0, this.height, 0);
      this.normals.push(0, 1, 0);
      this.texCoords.push(0.5, 0.5);

      for (let j = 0; j <= this.slices; j++) {
        const u = j / this.slices;
        const angle = j * alpha;
        const x = this.radius * Math.cos(angle);
        const z = this.radius * Math.sin(angle);
        this.vertices.push(x, this.height, z);
        this.normals.push(0, 1, 0);
        this.texCoords.push(0.5 + (x / (2 * this.radius)), 0.5 + (z / (2 * this.radius)));
      }

      for (let j = 0; j < this.slices; j++) {
        const first = topCenterIndex + j + 1;
        const second = topCenterIndex + j + 2;
        this.indices.push(topCenterIndex, first, second);
      }
    }

    this.primitiveType = this.scene.gl.TRIANGLES;
    this.initGLBuffers();
  }
}