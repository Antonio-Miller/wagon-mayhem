import { CGFappearance, CGFshader, CGFtexture } from "../../../lib/CGF.js";
import { MyPlane } from "../primitives/MyPlane.js";

export class MyTerrain {
  constructor(
    scene,
    divisions = 100,
    size = 800,
    maxHeight = 10  ,
    heightmapPath = "/tp5/textures/terrainmap.jpg"
  ) {
    this.scene = scene;
    this.divisions = divisions;
    this.size = size;
    this.maxHeight = maxHeight;
    this.halfSize = size / 2;

    this.plane = new MyPlane(scene, divisions, size, size);
    this.heightmap = new CGFtexture(this.scene, heightmapPath);
    this.heightmapCanvas = document.createElement("canvas");
    this.heightmapContext = this.heightmapCanvas.getContext("2d", { willReadFrequently: true });
    this.heightmapPixels = null;

    this.appearance = new CGFappearance(this.scene);
    this.appearance.setAmbient(0.45, 0.55, 0.35, 1);
    this.appearance.setDiffuse(0.55, 0.7, 0.42, 1);
    this.appearance.setSpecular(0.1, 0.1, 0.1, 1);
    this.appearance.setShininess(10);

    this.shader = new CGFshader(
      this.scene.gl,
      "/project/src/shaders/terrain.vert",
      "/project/src/shaders/terrain.frag"
    );
    this.shader.setUniformsValues({
      uHeightmap: 0,
      uMaxHeight: this.maxHeight,
      uTerrainStep: this.size / this.divisions,
      uTexelStep: 1.0 / this.divisions,
    });
  }

  ensureHeightmapPixels() {
    if (this.heightmapPixels || !this.heightmap || this.heightmap.texID === -1) {
      return;
    }

    const image = this.heightmap.image;
    if (!image || !image.complete || image.width === 0 || image.height === 0) {
      return;
    }

    this.heightmapCanvas.width = image.width;
    this.heightmapCanvas.height = image.height;
    this.heightmapContext.clearRect(0, 0, image.width, image.height);
    this.heightmapContext.drawImage(image, 0, 0);
    this.heightmapPixels = this.heightmapContext.getImageData(0, 0, image.width, image.height).data;
  }

  getHeightAt(worldX, worldZ) {
    this.ensureHeightmapPixels();

    if (!this.heightmapPixels) {
      return 0;
    }

    const clampedX = Math.max(-this.halfSize, Math.min(this.halfSize, worldX));
    const clampedZ = Math.max(-this.halfSize, Math.min(this.halfSize, worldZ));
    const u = (clampedX + this.halfSize) / this.size;
    const v = (this.halfSize - clampedZ) / this.size;

    const imageWidth = this.heightmapCanvas.width;
    const imageHeight = this.heightmapCanvas.height;
    const pixelX = Math.min(imageWidth - 1, Math.max(0, Math.floor(u * imageWidth)));
    const pixelY = Math.min(imageHeight - 1, Math.max(0, Math.floor(v * imageHeight)));
    const index = (pixelY * imageWidth + pixelX) * 4;
    const heightSample = this.heightmapPixels[index] / 255;

    return heightSample * this.maxHeight;
  }

  display() {
    if (!this.heightmap || this.heightmap.texID === -1) {
      return;
    }

    this.scene.pushMatrix();

    const previousTexturesEnabled = this.scene.texturesEnabled;
    this.scene.setActiveShader(this.shader);
    this.scene.enableTextures(true);
    this.shader.setUniformsValues({
      uHeightmap: 0,
      uMaxHeight: this.maxHeight,
      uTerrainStep: this.size / this.divisions,
      uTexelStep: 1.0 / this.divisions,
    });
    this.appearance.apply();
    this.heightmap.bind(0);
    this.plane.display();
    this.heightmap.unbind(0);

    this.scene.enableTextures(previousTexturesEnabled);
    this.scene.setActiveShader(this.scene.defaultShader);
    this.scene.popMatrix();
  }
}