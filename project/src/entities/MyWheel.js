import { CGFappearance, CGFtexture } from "../../../lib/CGF.js";
import { MyTorus } from "../primitives/MyTorus.js";
import { MyCylinder } from "../primitives/MyCylinder.js";

/**
 * MyWheel — Wagon wheel assembled from primitives.
 *
 * Built **flat in the XZ-plane** (like a disc lying on a table).
 * The parent transform should:
 *   1. rotate ±90° around Z to stand the wheel up  (disc → YZ-plane)
 *   2. rotate around Y for rolling
 *   3. translate to the correct position on the wagon
 *
 * Components:
 *   • Torus rim  — outer ring
 *   • Cylinder hub — central boss
 *   • Cylinder spokes — radial connecting rods
 */
export class MyWheel {
  /**
   * @param {CGFscene} scene
   * @param {number} radius        Outer rim ring radius
   * @param {number} rimThickness  Tube radius of the torus rim
   * @param {number} hubRadius     Radius of the central hub
   * @param {number} hubWidth      Axial thickness of the hub (along the axle)
   * @param {number} numSpokes     Number of radial spokes
   */
  constructor(scene, radius = 0.6, rimThickness = 0.05, hubRadius = 0.10, hubWidth = 0.14, numSpokes = 8) {
    this.scene = scene;
    this.radius = radius;
    this.hubRadius = hubRadius;
    this.hubWidth = hubWidth;
    this.numSpokes = numSpokes;

    // ── Sub-primitives ──
    this.rim = new MyTorus(scene, radius, rimThickness, 24, 8);
    this.hub = new MyCylinder(scene, 12, hubWidth, hubRadius, hubRadius, true);

    const spokeLen = radius - hubRadius - rimThickness;
    this.spoke = new MyCylinder(scene, 6, spokeLen, 0.07, 0.05, false);

    // ── Dark wood appearance (textured) ──
    this.woodTexture = new CGFtexture(scene, "/project/src/shaders/Poliigon_WoodFloorAsh_4186_BaseColor.jpg");
    this.material = new CGFappearance(scene);
    this.material.setAmbient(0.25, 0.15, 0.06, 1);
    this.material.setDiffuse(0.50, 0.30, 0.12, 1);
    this.material.setSpecular(0.15, 0.10, 0.05, 1);
    this.material.setShininess(10);
    this.material.setTexture(this.woodTexture);
    this.material.setTextureWrap("REPEAT", "REPEAT");
  }

  display() {
    this.material.apply();

    // ── Rim ──
    this.scene.pushMatrix();
    this.rim.display();
    this.scene.popMatrix();

    // ── Hub ── (cylinder along Y, centred on the XZ-plane)
    this.scene.pushMatrix();
    this.scene.translate(0, -this.hubWidth / 2, 0);
    this.hub.display();
    this.scene.popMatrix();

    // ── Spokes ── (radiate outward from hub edge in the XZ-plane)
    const spokeStep = (2 * Math.PI) / this.numSpokes;
    for (let i = 0; i < this.numSpokes; i++) {
      this.scene.pushMatrix();
      this.scene.rotate(i * spokeStep, 0, 1, 0);   // orient radially
      this.scene.translate(this.hubRadius, 0, 0);    // start at hub edge
      this.scene.rotate(-Math.PI / 2, 0, 0, 1);     // lay cylinder along +X
      this.spoke.display();
      this.scene.popMatrix();
    }
  }
}
