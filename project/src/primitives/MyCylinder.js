import { CGFobject } from "../../../lib/CGF.js";

/**
 * MyCylinder
 * Cylinder (or truncated cone) along the Y-axis, from y = 0 to y = height.
 *
 * @param {CGFscene} scene
 * @param {number}  slices        Radial divisions
 * @param {number}  height        Extent along Y
 * @param {number}  radiusBottom  Radius at y = 0
 * @param {number}  radiusTop     Radius at y = height (defaults to radiusBottom)
 * @param {boolean} caps          Draw top / bottom disc caps
 */
export class MyCylinder extends CGFobject {
  constructor(scene, slices = 16, height = 1, radiusBottom = 1, radiusTop = undefined, caps = true) {
    super(scene);
    this.slices = slices;
    this.height = height;
    this.radiusBottom = radiusBottom;
    this.radiusTop = radiusTop !== undefined ? radiusTop : radiusBottom;
    this.caps = caps;
    this.initBuffers();
  }

  initBuffers() {
    this.vertices = [];
    this.indices = [];
    this.normals = [];
    this.texCoords = [];

    const ang = (2 * Math.PI) / this.slices;

    // ── Side surface ──────────────────────────────────────────
    for (let i = 0; i <= this.slices; i++) {
      const a = i * ang;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const u = i / this.slices;

      // Bottom ring vertex
      this.vertices.push(this.radiusBottom * ca, 0, this.radiusBottom * sa);
      // Top ring vertex
      this.vertices.push(this.radiusTop * ca, this.height, this.radiusTop * sa);

      // Normal — accounts for cone slope
      const dr = this.radiusBottom - this.radiusTop;
      const len = Math.sqrt(dr * dr + this.height * this.height) || 1;
      const nx = (this.height / len) * ca;
      const ny = dr / len;
      const nz = (this.height / len) * sa;
      this.normals.push(nx, ny, nz);
      this.normals.push(nx, ny, nz);

      this.texCoords.push(u, 1); // bottom
      this.texCoords.push(u, 0); // top
    }

    for (let i = 0; i < this.slices; i++) {
      const b = i * 2;
      this.indices.push(b, b + 2, b + 1);
      this.indices.push(b + 1, b + 2, b + 3);
    }

    // ── Caps ──────────────────────────────────────────────────
    if (this.caps) {
      // Bottom disc (y = 0, normal → -Y)
      const bBase = this.vertices.length / 3;
      this.vertices.push(0, 0, 0);
      this.normals.push(0, -1, 0);
      this.texCoords.push(0.5, 0.5);
      for (let i = 0; i < this.slices; i++) {
        const a = i * ang;
        this.vertices.push(this.radiusBottom * Math.cos(a), 0, this.radiusBottom * Math.sin(a));
        this.normals.push(0, -1, 0);
        this.texCoords.push(0.5 + 0.5 * Math.cos(a), 0.5 - 0.5 * Math.sin(a));
      }
      for (let i = 0; i < this.slices; i++) {
        this.indices.push(bBase, bBase + 1 + ((i + 1) % this.slices), bBase + 1 + i);
      }

      // Top disc (y = height, normal → +Y)
      const tBase = this.vertices.length / 3;
      this.vertices.push(0, this.height, 0);
      this.normals.push(0, 1, 0);
      this.texCoords.push(0.5, 0.5);
      for (let i = 0; i < this.slices; i++) {
        const a = i * ang;
        this.vertices.push(this.radiusTop * Math.cos(a), this.height, this.radiusTop * Math.sin(a));
        this.normals.push(0, 1, 0);
        this.texCoords.push(0.5 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.sin(a));
      }
      for (let i = 0; i < this.slices; i++) {
        this.indices.push(tBase, tBase + 1 + i, tBase + 1 + ((i + 1) % this.slices));
      }
    }

    this.primitiveType = this.scene.gl.TRIANGLES;
    this.initGLBuffers();
  }
}
