import { CGFobject } from "../../../lib/CGF.js";

/**
 * MyUnitCube
 * Axis-aligned cube from (-0.5, -0.5, -0.5) to (0.5, 0.5, 0.5).
 * Each face has its own vertex normals for correct flat shading.
 */
export class MyUnitCube extends CGFobject {
  constructor(scene) {
    super(scene);
    this.initBuffers();
  }

  initBuffers() {
    this.vertices = [
      // Front face  (z = +0.5)
      -0.5, -0.5,  0.5,   0.5, -0.5,  0.5,   0.5,  0.5,  0.5,  -0.5,  0.5,  0.5,
      // Back face   (z = -0.5)
       0.5, -0.5, -0.5,  -0.5, -0.5, -0.5,  -0.5,  0.5, -0.5,   0.5,  0.5, -0.5,
      // Top face    (y = +0.5)
      -0.5,  0.5,  0.5,   0.5,  0.5,  0.5,   0.5,  0.5, -0.5,  -0.5,  0.5, -0.5,
      // Bottom face (y = -0.5)
      -0.5, -0.5, -0.5,   0.5, -0.5, -0.5,   0.5, -0.5,  0.5,  -0.5, -0.5,  0.5,
      // Right face  (x = +0.5)
       0.5, -0.5,  0.5,   0.5, -0.5, -0.5,   0.5,  0.5, -0.5,   0.5,  0.5,  0.5,
      // Left face   (x = -0.5)
      -0.5, -0.5, -0.5,  -0.5, -0.5,  0.5,  -0.5,  0.5,  0.5,  -0.5,  0.5, -0.5,
    ];

    this.normals = [
       0, 0, 1,   0, 0, 1,   0, 0, 1,   0, 0, 1,   // Front
       0, 0,-1,   0, 0,-1,   0, 0,-1,   0, 0,-1,   // Back
       0, 1, 0,   0, 1, 0,   0, 1, 0,   0, 1, 0,   // Top
       0,-1, 0,   0,-1, 0,   0,-1, 0,   0,-1, 0,   // Bottom
       1, 0, 0,   1, 0, 0,   1, 0, 0,   1, 0, 0,   // Right
      -1, 0, 0,  -1, 0, 0,  -1, 0, 0,  -1, 0, 0,   // Left
    ];

    this.texCoords = [
      0, 1,  1, 1,  1, 0,  0, 0,   // Front
      0, 1,  1, 1,  1, 0,  0, 0,   // Back
      0, 1,  1, 1,  1, 0,  0, 0,   // Top
      0, 1,  1, 1,  1, 0,  0, 0,   // Bottom
      0, 1,  1, 1,  1, 0,  0, 0,   // Right
      0, 1,  1, 1,  1, 0,  0, 0,   // Left
    ];

    this.indices = [];
    for (let f = 0; f < 6; f++) {
      const b = f * 4;
      this.indices.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }

    this.primitiveType = this.scene.gl.TRIANGLES;
    this.initGLBuffers();
  }
}
