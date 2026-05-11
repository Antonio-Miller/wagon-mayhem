import { CGFobject, CGFappearance, CGFtexture } from "../../../lib/CGF.js";
import { MySphere } from "../primitives/MySphere.js";

export class MyClouds extends CGFobject {
  constructor(scene) {
    super(scene);
    this.radius = 190;
    this.cloudSpeed = 0.02;
    this.textureOffset = 0;
    this.repeatU = 4;
    this.repeatV = 2;

    this.dome = new MySphere(scene, 20, 40, this.radius, true);
    this.baseTexCoords = Array.from(this.dome.texCoords);

    this.cloudTexture = new CGFtexture(this.scene, "/project/textures/clouds.png");
    this.cloudAppearance = new CGFappearance(this.scene);
    this.cloudAppearance.setAmbient(1, 1, 1, 0.65);
    this.cloudAppearance.setDiffuse(1, 1, 1, 0.65);
    this.cloudAppearance.setSpecular(0, 0, 0, 1);
    this.cloudAppearance.setEmission(0.7, 0.7, 0.7, 1);
    this.cloudAppearance.setShininess(1);
    this.cloudAppearance.setTexture(this.cloudTexture);
    this.cloudAppearance.setTextureWrap("REPEAT", "REPEAT");
  }

  update(deltaTime) {
    // Texture matrix style animation: U offset += cloudSpeed * deltaTime
    this.textureOffset += this.cloudSpeed * deltaTime;
    this.textureOffset %= 1.0;

    for (let i = 0; i < this.baseTexCoords.length; i += 2) {
      const baseU = this.baseTexCoords[i];
      const baseV = this.baseTexCoords[i + 1];
      this.dome.texCoords[i] = baseU * this.repeatU + this.textureOffset;
      this.dome.texCoords[i + 1] = baseV * this.repeatV;
    }
    this.dome.updateTexCoordsGLBuffers();
  }

  display() {
    if (!this.cloudTexture || this.cloudTexture.texID === -1) return;

    this.scene.pushMatrix();

    const gl = this.scene.gl;
    const prevDepthMask = gl.getParameter(gl.DEPTH_WRITEMASK);
    const blendEnabled = gl.isEnabled(gl.BLEND);
    const cullEnabled = gl.isEnabled(gl.CULL_FACE);
    const prevTexturesEnabled = this.scene.texturesEnabled;

    gl.depthMask(false);
    if (!blendEnabled) gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    if (cullEnabled) gl.disable(gl.CULL_FACE);
    this.scene.enableTextures(true);

    this.scene.translate(0, 5, 0);
    this.cloudAppearance.apply();
    this.dome.display();

    this.scene.enableTextures(prevTexturesEnabled);
    if (cullEnabled) gl.enable(gl.CULL_FACE);
    if (!blendEnabled) gl.disable(gl.BLEND);
    gl.depthMask(prevDepthMask);
    this.scene.popMatrix();
  }
}
