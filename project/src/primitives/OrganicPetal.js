import { CGFobject } from "../../../lib/CGF.js";

export class OrganicPetal extends CGFobject {
  constructor(scene, width = 0.3, height = 0.9) {
    super(scene);
    this.width = width;
    this.height = height;
    this.initBuffers();
  }

  initBuffers() {
    const halfWidth = this.width * 0.5;

    this.vertices = [
      0, 0, 0,
      -halfWidth * 0.95, this.height * 0.28, 0,
      -halfWidth * 0.42, this.height * 0.74, 0,
      0, this.height, 0,
      halfWidth * 0.42, this.height * 0.74, 0,
      halfWidth * 0.95, this.height * 0.28, 0,
    ];

    this.normals = [
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
      0, 0, -1,
      0, 0, -1,
      0, 0, -1,
      0, 0, -1,
      0, 0, -1,
      0, 0, -1,
    ];

    this.indices = [
      0, 1, 2,
      0, 2, 3,
      0, 3, 4,
      0, 4, 5,
      2, 1, 0,
      3, 2, 0,
      4, 3, 0,
      5, 4, 0,
    ];

    this.texCoords = [
      0.5, 0.0,
      0.0, 0.25,
      0.28, 0.72,
      0.5, 1.0,
      0.72, 0.72,
      1.0, 0.25,
    ];

    this.primitiveType = this.scene.gl.TRIANGLES;
    this.initGLBuffers();
  }
}