import { CGFobject, CGFappearance } from "../../../lib/CGF.js";
import { MyCilinder } from "../primitives/MyCilinder.js";
import { MyCone } from "../primitives/MyCone.js";
import { SimplexNoise } from "../utils/SimplexNoise.js";

export class MyPineTree extends CGFobject {
  constructor(scene, trunkHeight = 8, trunkRadius = 2, foliageRadius = 10, foliageHeight = 11) {
    super(scene);

    this.trunkHeight = trunkHeight;
    this.trunkRadius = trunkRadius;
    this.foliageRadius = foliageRadius;
    this.foliageHeight = foliageHeight;

    this.trunk = new MyCilinder(scene, 20, 1, 1, 1);
    this.lowerCrown = new MyCone(scene, 20, 1, 1, 1);
    this.upperCrown = new MyCone(scene, 20, 1, 1, 1);
    this.noise = new SimplexNoise(Math.floor(Math.random() * 0xffffffff));
    this.noiseOffset = Math.random() * 1000;

    this.distortCrown(this.lowerCrown, 2.6, 0.14, 0.05, this.noiseOffset + 13.7);
    this.distortCrown(this.upperCrown, 3.1, 0.18, 0.06, this.noiseOffset + 47.2);

    this.trunkAppearance = new CGFappearance(this.scene);
    this.trunkAppearance.setAmbient(0.35, 0.2, 0.08, 1.0);
    this.trunkAppearance.setDiffuse(0.45, 0.28, 0.12, 1.0);
    this.trunkAppearance.setSpecular(0.05, 0.05, 0.05, 1.0);
    this.trunkAppearance.setShininess(5.0);

    this.foliageAppearance = new CGFappearance(this.scene);
    this.foliageAppearance.setAmbient(0.12, 0.28, 0.12, 1.0);
    this.foliageAppearance.setDiffuse(0.18, 0.42, 0.18, 1.0);
    this.foliageAppearance.setSpecular(0.05, 0.05, 0.05, 1.0);
    this.foliageAppearance.setShininess(5.0);
  }

  distortCrown(cone, frequency, radialAmplitude, heightAmplitude, noiseOffset) {
    const slices = cone.slices;
    const stacks = cone.stacks;
    const stride = slices + 1;

    for (let i = 0; i <= stacks; i++) {
      if (i === 0 || i === stacks) {
        continue;
      }

      const layerBias = i / stacks;

      for (let j = 0; j < stride; j++) {
        const wrappedJ = j === slices ? 0 : j;
        const vertexIndex = (i * stride + j) * 3;
        const u = wrappedJ / slices;
        const v = i / stacks;
        const noiseValue = this.noise.fbm2D(
          u * frequency + noiseOffset,
          v * frequency + noiseOffset,
          4
        );

        const radialScale = 1 + radialAmplitude * noiseValue * layerBias;
        const heightShift = heightAmplitude * noiseValue * (1 - layerBias);

        const x = cone.vertices[vertexIndex] * radialScale;
        const y = cone.vertices[vertexIndex + 1] + heightShift;
        const z = cone.vertices[vertexIndex + 2] * radialScale;

        cone.vertices[vertexIndex] = x;
        cone.vertices[vertexIndex + 1] = y;
        cone.vertices[vertexIndex + 2] = z;

        const nxBase = x;
        const nzBase = z;
        const radialLength = Math.sqrt(nxBase * nxBase + nzBase * nzBase) || 1;
        const slope = cone.height === 0 ? 0 : cone.radius / cone.height;
        let nx = nxBase / radialLength;
        let ny = slope;
        let nz = nzBase / radialLength;
        const normalLength = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;

        cone.normals[vertexIndex] = nx / normalLength;
        cone.normals[vertexIndex + 1] = ny / normalLength;
        cone.normals[vertexIndex + 2] = nz / normalLength;
      }
    }

    cone.initGLBuffers();
  }

  display() {
    this.scene.pushMatrix();

    this.scene.scale(this.trunkRadius, this.trunkHeight, this.trunkRadius);
    this.trunkAppearance.apply();
    this.trunk.display();

    this.scene.popMatrix();

    this.scene.pushMatrix();
    this.scene.translate(0, this.trunkHeight, 0);
    this.scene.scale(this.foliageRadius, this.foliageHeight, this.foliageRadius);
    this.foliageAppearance.apply();
    this.lowerCrown.display();

    this.scene.popMatrix();

    this.scene.pushMatrix();
    this.scene.translate(0, this.trunkHeight + this.foliageHeight * 0.92, 0);
    this.scene.scale(this.foliageRadius * 0.72, this.foliageHeight * 0.72, this.foliageRadius * 0.72);
    this.foliageAppearance.apply();
    this.upperCrown.display();

    this.scene.popMatrix();
  }
}