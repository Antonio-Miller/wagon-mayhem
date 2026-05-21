import { CGFobject } from "../../../lib/CGF.js";

export class MyParallelpiped extends CGFobject {
  constructor(scene, width = 1, height = 1, depth = 1) {
    super(scene);
    this.width = width;
    this.height = height;
    this.depth = depth;
    this.initBuffers();
  }

  initBuffers() {
    this.vertices = [];
    this.indices = [];
    this.normals = [];
    this.texCoords = [];

    const w = this.width / 2;
    const h = this.height / 2;
    const d = this.depth / 2;

    // Front face (z = d)
    this.vertices.push(-w, -h, d, w, -h, d, w, h, d, -w, h, d);
    this.normals.push(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1);
    this.texCoords.push(0, 0, 1, 0, 1, 1, 0, 1);

    // Back face (z = -d)
    this.vertices.push(-w, -h, -d, -w, h, -d, w, h, -d, w, -h, -d);
    this.normals.push(0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1);
    this.texCoords.push(1, 0, 1, 1, 0, 1, 0, 0);

    // Top face (y = h)
    this.vertices.push(-w, h, -d, -w, h, d, w, h, d, w, h, -d);
    this.normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
    this.texCoords.push(0, 1, 0, 0, 1, 0, 1, 1);

    // Bottom face (y = -h)
    this.vertices.push(-w, -h, -d, w, -h, -d, w, -h, d, -w, -h, d);
    this.normals.push(0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0);
    this.texCoords.push(0, 0, 1, 0, 1, 1, 0, 1);

    // Right face (x = w)
    this.vertices.push(w, -h, -d, w, h, -d, w, h, d, w, -h, d);
    this.normals.push(1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0);
    this.texCoords.push(1, 0, 1, 1, 0, 1, 0, 0);

    // Left face (x = -w)
    this.vertices.push(-w, -h, -d, -w, -h, d, -w, h, d, -w, h, -d);
    this.normals.push(-1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0);
    this.texCoords.push(0, 0, 1, 0, 1, 1, 0, 1);

    // Create indices for each face (2 triangles per face)
    for (let face = 0; face < 6; face++) {
      const base = face * 4;
      this.indices.push(base, base + 1, base + 2);
      this.indices.push(base, base + 2, base + 3);
    }

    this.primitiveType = this.scene.gl.TRIANGLES;
    this.initGLBuffers();
  }
}
