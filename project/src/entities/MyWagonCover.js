import { CGFobject, CGFappearance, CGFtexture } from "../../../lib/CGF.js";
import { MyUnitCube } from "../primitives/MyUnitCube.js";

/**
 * MyWagonCover — Half-cylinder cloth canopy with wooden support ribs.
 *
 * Geometry:
 *   • Arch cross-section in the XY-plane (semicircle from +X through +Y to -X).
 *   • Extruded along Z from -length/2 to +length/2.
 *   • Base of the arch sits at y = 0 (meant to rest on top of the wagon side-walls).
 *
 * The wooden ribs are small cubes bent along each arch and drawn slightly
 * outside the cloth surface for visual separation.
 */
export class MyWagonCover extends CGFobject {
  /**
   * @param {CGFscene} scene
   * @param {number} width           Span of the arch (= wagon body width)
   * @param {number} length          How far the cover extends along Z
   * @param {number} arcSegments     Subdivisions around the semicircle
   * @param {number} lengthSegments  Subdivisions along Z
   * @param {number} numRibs         Number of visible wooden arch ribs
   */
  constructor(scene, width = 2.0, length = 2.0, arcSegments = 16, lengthSegments = 8, numRibs = 5) {
    super(scene);
    this.width = width;
    this.length = length;
    this.arcRadius = width / 2;
    this.arcSegments = arcSegments;
    this.lengthSegments = lengthSegments;
    this.numRibs = numRibs;
    this.ribArcSegments = 10;

    this.cube = new MyUnitCube(scene);

    // Build half-cylinder mesh
    this.initBuffers();

    // ── Cloth appearance (off-white canvas) ──
    this.clothMat = new CGFappearance(scene);
    this.clothMat.setAmbient(0.85, 0.82, 0.75, 1);
    this.clothMat.setDiffuse(0.92, 0.90, 0.83, 1);
    this.clothMat.setSpecular(0.08, 0.08, 0.08, 1);
    this.clothMat.setShininess(5);

    // ── Wooden rib appearance (textured) ──
    this.woodTexture = new CGFtexture(scene, "src/shaders/Poliigon_WoodFloorAsh_4186_BaseColor.jpg");
    this.ribMat = new CGFappearance(scene);
    this.ribMat.setAmbient(0.35, 0.22, 0.08, 1);
    this.ribMat.setDiffuse(0.55, 0.35, 0.15, 1);
    this.ribMat.setSpecular(0.12, 0.08, 0.04, 1);
    this.ribMat.setShininess(8);
    this.ribMat.setTexture(this.woodTexture);
    this.ribMat.setTextureWrap("REPEAT", "REPEAT");
  }

  // ── Half-cylinder mesh ─────────────────────────────────────
  initBuffers() {
    this.vertices = [];
    this.indices = [];
    this.normals = [];
    this.texCoords = [];

    const halfLen = this.length / 2;

    for (let j = 0; j <= this.lengthSegments; j++) {
      const z = -halfLen + (j / this.lengthSegments) * this.length;
      const v = j / this.lengthSegments;

      for (let i = 0; i <= this.arcSegments; i++) {
        const angle = (i / this.arcSegments) * Math.PI; // 0 → π
        const x = this.arcRadius * Math.cos(angle);
        const y = this.arcRadius * Math.sin(angle);

        this.vertices.push(x, y, z);
        this.normals.push(Math.cos(angle), Math.sin(angle), 0);
        this.texCoords.push(i / this.arcSegments, v);
      }
    }

    const stride = this.arcSegments + 1;
    for (let j = 0; j < this.lengthSegments; j++) {
      for (let i = 0; i < this.arcSegments; i++) {
        const a = j * stride + i;
        const b = a + stride;
        this.indices.push(a, a + 1, b);
        this.indices.push(a + 1, b + 1, b);
      }
    }

    this.primitiveType = this.scene.gl.TRIANGLES;
    this.initGLBuffers();
  }

  // ── Display ────────────────────────────────────────────────
  display() {
    const gl = this.scene.gl;
    const halfLen = this.length / 2;
    const ribThick = 0.12;

    // ─ Cloth surface (render both sides so interior is visible) ─
    const wasCulling = gl.isEnabled(gl.CULL_FACE);
    gl.disable(gl.CULL_FACE);

    this.clothMat.apply();
    this.scene.pushMatrix();
    super.display();
    this.scene.popMatrix();

    if (wasCulling) gl.enable(gl.CULL_FACE);

    // ─ Wooden arch ribs ─
    this.ribMat.apply();
    for (let r = 0; r < this.numRibs; r++) {
      const z = -halfLen + (r / (this.numRibs - 1)) * this.length;
      const segLen = this.arcRadius * (Math.PI / this.ribArcSegments);

      for (let s = 0; s < this.ribArcSegments; s++) {
        const midAngle = ((s + 0.5) / this.ribArcSegments) * Math.PI;
        const ribR = this.arcRadius + ribThick * 0.6; // slightly outside cloth
        const cx = ribR * Math.cos(midAngle);
        const cy = ribR * Math.sin(midAngle);

        this.scene.pushMatrix();
        this.scene.translate(cx, cy, z);
        this.scene.rotate(midAngle, 0, 0, 1);               // align with tangent
        this.scene.scale(ribThick, segLen * 1.05, ribThick); // thin beam segment
        this.cube.display();
        this.scene.popMatrix();
      }
    }
  }
}
