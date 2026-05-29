import { CGFobject } from "../../../lib/CGF.js";

/**
 * MyTorus
 * Torus (doughnut) lying in the XZ-plane.
 * Ring-centre circle is in XZ; tube cross-section sweeps vertically (Y).
 *
 * @param {CGFscene} scene
 * @param {number} R             Ring radius  (centre of tube → centre of torus)
 * @param {number} r             Tube radius
 * @param {number} segments      Divisions around the ring
 * @param {number} tubeSegments  Divisions around the tube cross-section
 */
export class MyTorus extends CGFobject {
  constructor(scene, R = 1, r = 0.2, segments = 24, tubeSegments = 12) {
    super(scene);
    this.R = R;
    this.r = r;
    this.segments = segments;
    this.tubeSegments = tubeSegments;
    this.initBuffers();
  }

  initBuffers() {
    this.vertices = [];
    this.indices = [];
    this.normals = [];
    this.texCoords = [];

    for (let i = 0; i <= this.segments; i++) {
      const phi = (i / this.segments) * 2 * Math.PI;
      const cp = Math.cos(phi);
      const sp = Math.sin(phi);

      for (let j = 0; j <= this.tubeSegments; j++) {
        const theta = (j / this.tubeSegments) * 2 * Math.PI;
        const ct = Math.cos(theta);
        const st = Math.sin(theta);

        // Position on the torus surface
        const x = (this.R + this.r * ct) * cp;
        const y = this.r * st;
        const z = (this.R + this.r * ct) * sp;
        this.vertices.push(x, y, z);

        // Outward-pointing normal
        this.normals.push(ct * cp, st, ct * sp);

        this.texCoords.push(i / this.segments, j / this.tubeSegments);
      }
    }

    const stride = this.tubeSegments + 1;
    for (let i = 0; i < this.segments; i++) {
      for (let j = 0; j < this.tubeSegments; j++) {
        const a = i * stride + j;
        const b = a + stride;
        this.indices.push(a, b, a + 1);
        this.indices.push(b, b + 1, a + 1);
      }
    }

    this.primitiveType = this.scene.gl.TRIANGLES;
    this.initGLBuffers();
  }
}
