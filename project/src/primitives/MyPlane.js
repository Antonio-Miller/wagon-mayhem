import { CGFobject } from "../../../lib/CGF.js";

export class MyPlane extends CGFobject {
  constructor(scene, divisions = 1, width = 1, depth = width) {
    super(scene);
    this.divisions = divisions;
    this.width = width;
    this.depth = depth;
    this.initBuffers();
  }

  initBuffers() {
    this.vertices = [];
    this.indices = [];
    this.normals = [];
    this.texCoords = [];

    const halfWidth = this.width / 2;
    const halfDepth = this.depth / 2;
    const stepX = this.width / this.divisions;
    const stepZ = this.depth / this.divisions;

    for (let row = 0; row <= this.divisions; row++) {
      const z = halfDepth - row * stepZ;
      const v = row / this.divisions;

      for (let column = 0; column <= this.divisions; column++) {
        const x = -halfWidth + column * stepX;
        const u = column / this.divisions;

        this.vertices.push(x, 0, z);
        this.normals.push(0, 1, 0);
        this.texCoords.push(u, v);
      }
    }

    const stride = this.divisions + 1;
    for (let row = 0; row < this.divisions; row++) {
      for (let column = 0; column < this.divisions; column++) {
        const topLeft = row * stride + column;
        const topRight = topLeft + 1;
        const bottomLeft = topLeft + stride;
        const bottomRight = bottomLeft + 1;

        this.indices.push(topLeft, topRight, bottomLeft);
        this.indices.push(topRight, bottomRight, bottomLeft);
      }
    }

    this.primitiveType = this.scene.gl.TRIANGLES;
    this.initGLBuffers();
  }
}