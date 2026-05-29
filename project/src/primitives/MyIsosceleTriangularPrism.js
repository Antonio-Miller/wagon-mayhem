import { CGFobject } from "../../../lib/CGF.js";

export class MyIsosceleTriangularPrism extends CGFobject {
  constructor(scene, baseWidth = 1, height = 1, depth = 1) {
    super(scene);
    this.baseWidth = baseWidth;
    this.height = height;
    this.depth = depth;
    this.initBuffers();
  }

  initBuffers() {
    this.vertices = [];
    this.indices = [];
    this.normals = [];
    this.texCoords = [];

    const bw = this.baseWidth / 2;
    const d = this.depth / 2;

    // Front triangular face (z = d)
    // Bottom left, bottom right, top
    this.vertices.push(-bw, 0, d, bw, 0, d, 0, this.height, d);
    this.normals.push(0, 0, 1, 0, 0, 1, 0, 0, 1);
    this.texCoords.push(0, 0, 1, 0, 0.5, 1);

    // Back triangular face (z = -d)
    // Bottom left, top, bottom right (reversed winding)
    this.vertices.push(-bw, 0, -d, 0, this.height, -d, bw, 0, -d);
    this.normals.push(0, 0, -1, 0, 0, -1, 0, 0, -1);
    this.texCoords.push(1, 0, 0.5, 1, 0, 0);

    // Bottom rectangular face (y = 0)
    this.vertices.push(-bw, 0, -d, bw, 0, -d, bw, 0, d, -bw, 0, d);
    this.normals.push(0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0);
    this.texCoords.push(0, 0, 1, 0, 1, 1, 0, 1);

    // Left rectangular face (from bottom left to top)
    // Calculate normal for the slanted face
    const leftNormalY = this.baseWidth / Math.sqrt(this.baseWidth * this.baseWidth + 4 * this.height * this.height);
    const leftNormalZ = 2 * this.height / Math.sqrt(this.baseWidth * this.baseWidth + 4 * this.height * this.height);
    
    this.vertices.push(-bw, 0, -d, -bw, 0, d, 0, this.height, d, 0, this.height, -d);
    this.normals.push(-leftNormalY, leftNormalZ, 0, -leftNormalY, leftNormalZ, 0, -leftNormalY, leftNormalZ, 0, -leftNormalY, leftNormalZ, 0);
    this.texCoords.push(0, 0, 1, 0, 1, 1, 0, 1);

    // Right rectangular face (from bottom right to top)
    const rightNormalY = -this.baseWidth / Math.sqrt(this.baseWidth * this.baseWidth + 4 * this.height * this.height);
    const rightNormalZ = 2 * this.height / Math.sqrt(this.baseWidth * this.baseWidth + 4 * this.height * this.height);
    
    this.vertices.push(bw, 0, -d, 0, this.height, -d, 0, this.height, d, bw, 0, d);
    this.normals.push(-rightNormalY, rightNormalZ, 0, -rightNormalY, rightNormalZ, 0, -rightNormalY, rightNormalZ, 0, -rightNormalY, rightNormalZ, 0);
    this.texCoords.push(0, 0, 1, 0, 1, 1, 0, 1);

    // Create indices for each face
    // Front triangle
    this.indices.push(0, 1, 2);

    // Back triangle
    this.indices.push(3, 4, 5);

    // Bottom rectangle
    const base = 6;
    this.indices.push(base, base + 1, base + 2);
    this.indices.push(base, base + 2, base + 3);

    // Left rectangle
    const left = 10;
    this.indices.push(left, left + 1, left + 2);
    this.indices.push(left, left + 2, left + 3);

    // Right rectangle
    const right = 14;
    this.indices.push(right, right + 1, right + 2);
    this.indices.push(right, right + 2, right + 3);

    this.primitiveType = this.scene.gl.TRIANGLES;
    this.initGLBuffers();
  }
}
