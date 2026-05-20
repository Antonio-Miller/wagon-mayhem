import { CGFobject } from "../../../lib/CGF.js";

export class MyTrapezoidalPrism extends CGFobject {
  constructor(scene, bottomWidth = 1, topWidth = 0.8, height = 1, depth = 1) {
    super(scene);
    this.bottomWidth = bottomWidth;
    this.topWidth = topWidth;
    this.height = height;
    this.depth = depth;
    this.initBuffers();
  }

  initBuffers() {
    this.vertices = [];
    this.indices = [];
    this.normals = [];
    this.texCoords = [];

    const bottomHalfWidth = this.bottomWidth / 2;
    const topHalfWidth = this.topWidth / 2;
    const depthHalf = this.depth / 2;
    const sideDelta = this.bottomWidth - this.topWidth;
    const sideNormalLength = Math.sqrt(this.height * this.height + sideDelta * sideDelta) || 1;

    // Front face (z = +depth/2)
    this.vertices.push(
      -bottomHalfWidth, 0, depthHalf,
      bottomHalfWidth, 0, depthHalf,
      topHalfWidth, this.height, depthHalf,
      -topHalfWidth, this.height, depthHalf
    );
    this.normals.push(
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
      0, 0, 1
    );
    this.texCoords.push(0, 0, 1, 0, 0.75, 1, 0.25, 1);

    // Back face (z = -depth/2)
    this.vertices.push(
      -bottomHalfWidth, 0, -depthHalf,
      -topHalfWidth, this.height, -depthHalf,
      topHalfWidth, this.height, -depthHalf,
      bottomHalfWidth, 0, -depthHalf
    );
    this.normals.push(
      0, 0, -1,
      0, 0, -1,
      0, 0, -1,
      0, 0, -1
    );
    this.texCoords.push(0, 0, 0.25, 1, 0.75, 1, 1, 0);

    // Top face (y = height)
    this.vertices.push(
      -topHalfWidth, this.height, -depthHalf,
      -topHalfWidth, this.height, depthHalf,
      topHalfWidth, this.height, depthHalf,
      topHalfWidth, this.height, -depthHalf
    );
    this.normals.push(
      0, 1, 0,
      0, 1, 0,
      0, 1, 0,
      0, 1, 0
    );
    this.texCoords.push(0, 1, 0, 0, 1, 0, 1, 1);

    // Bottom face (y = 0)
    this.vertices.push(
      -bottomHalfWidth, 0, -depthHalf,
      bottomHalfWidth, 0, -depthHalf,
      bottomHalfWidth, 0, depthHalf,
      -bottomHalfWidth, 0, depthHalf
    );
    this.normals.push(
      0, -1, 0,
      0, -1, 0,
      0, -1, 0,
      0, -1, 0
    );
    this.texCoords.push(0, 0, 1, 0, 1, 1, 0, 1);

    // Left face
    this.vertices.push(
      -bottomHalfWidth, 0, depthHalf,
      -topHalfWidth, this.height, depthHalf,
      -topHalfWidth, this.height, -depthHalf,
      -bottomHalfWidth, 0, -depthHalf
    );
    this.normals.push(
      -this.height / sideNormalLength, sideDelta / sideNormalLength, 0,
      -this.height / sideNormalLength, sideDelta / sideNormalLength, 0,
      -this.height / sideNormalLength, sideDelta / sideNormalLength, 0,
      -this.height / sideNormalLength, sideDelta / sideNormalLength, 0
    );
    this.texCoords.push(0, 0, 1, 0, 1, 1, 0, 1);

    // Right face
    this.vertices.push(
      bottomHalfWidth, 0, depthHalf,
      bottomHalfWidth, 0, -depthHalf,
      topHalfWidth, this.height, -depthHalf,
      topHalfWidth, this.height, depthHalf
    );
    this.normals.push(
      this.height / sideNormalLength, sideDelta / sideNormalLength, 0,
      this.height / sideNormalLength, sideDelta / sideNormalLength, 0,
      this.height / sideNormalLength, sideDelta / sideNormalLength, 0,
      this.height / sideNormalLength, sideDelta / sideNormalLength, 0
    );
    this.texCoords.push(0, 0, 1, 0, 1, 1, 0, 1);

    for (let face = 0; face < 6; face++) {
      const base = face * 4;
      this.indices.push(base, base + 1, base + 2);
      this.indices.push(base, base + 2, base + 3);
    }

    this.primitiveType = this.scene.gl.TRIANGLES;
    this.initGLBuffers();
  }
}