import { CGFappearance, CGFshader, CGFtexture } from "../../../lib/CGF.js";
import { MyPlane } from "../primitives/MyPlane.js";

export class MyTerrain {
  constructor(
    scene,
    // Note: WebGL 16-bit indices limit vertices to 65,535.
    // At divisions = 256, (256+1)^2 = 66,049 vertices, which overflows and causes
    // triangles to wrap around and stretch across the scene. 
    // divisions = 120 keeps it safely under the limit (14,641 vertices).
    divisions = 120,
    size = 800,
    maxHeight = 120,
    heightmapPath = "/project/textures/Rugged%20Terrain%20Height%20Map%20PNG.png"
  ) {
    this.scene = scene;
    this.divisions = divisions;
    this.size = size;
    this.maxHeight = maxHeight;
    this.halfSize = size / 2;

    this.plane = new MyPlane(scene, divisions, size, size);
    this.heightmap = new CGFtexture(this.scene, heightmapPath);
    this.terrainTexture = new CGFtexture(this.scene, "/project/textures/Rugged%20Terrain%20Diffuse%20PNG.png");
    this.heightmapCanvas = document.createElement("canvas");
    this.heightmapContext = this.heightmapCanvas.getContext("2d", { willReadFrequently: true });
    this.heightmapPixels = null;

    this.appearance = new CGFappearance(this.scene);
    this.appearance.setAmbient(0.85, 0.85, 0.85, 1);
    this.appearance.setDiffuse(1.0, 1.0, 1.0, 1);
    this.appearance.setSpecular(0.04, 0.04, 0.04, 1);
    this.appearance.setShininess(6);

    this.shader = new CGFshader(
      this.scene.gl,
      "/project/src/shaders/terrain.vert",
      "/project/src/shaders/terrain.frag"
    );
    this.shader.setUniformsValues({
      uHeightmap: 0,
      uTerrainTexture: 1,
      uMaxHeight: this.maxHeight,
      uTerrainStep: this.size / this.divisions,
      uTexelStep: 1.0 / this.divisions,
      uTileScale: 1.0,
    });

    this.pathCorners = null;
    this.pathHalfWidth = 0.0;
    this.pathColor = [0.72, 0.54, 0.36];
    this.pathBlend = 0.92;
  }

  setPathUniforms(corners, halfWidth, color, blend) {
    this.pathCorners = corners ? new Float32Array(corners) : null;
    this.pathHalfWidth = halfWidth;
    this.pathColor = color ?? this.pathColor;
    this.pathBlend = blend ?? this.pathBlend;

    if (!this.pathCorners || this.pathCorners.length !== 8) {
      return;
    }

    const gl = this.scene.gl;
    const program = this.shader && this.shader.program;
    if (!program) {
      return;
    }

    const prevProgram = gl.getParameter(gl.CURRENT_PROGRAM);
    gl.useProgram(program);

    const cornersLoc = gl.getUniformLocation(program, "uPathCorners");
    if (cornersLoc) {
      gl.uniform2fv(cornersLoc, this.pathCorners);
    }

    this.shader.setUniformsValues({
      uPathHalfWidth: this.pathHalfWidth,
      uPathColor: this.pathColor,
      uPathBlend: this.pathBlend,
    });

    gl.useProgram(prevProgram);
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
    
    // Once the image is available, set a more accurate texel step
    // based on the heightmap resolution so the shader samples neighbors
    // correctly when the plane is highly subdivided.
    const maxDim = Math.max(image.width, image.height);
    if (this.shader) {
      this.shader.setUniformsValues({ uTexelStep: 1.0 / maxDim });
    }
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

    const px = u * (imageWidth - 1);
    const py = v * (imageHeight - 1);
    const x0 = Math.max(0, Math.floor(px));
    const y0 = Math.max(0, Math.floor(py));
    const x1 = Math.min(imageWidth - 1, x0 + 1);
    const y1 = Math.min(imageHeight - 1, y0 + 1);
    const tx = px - x0;
    const ty = py - y0;

    const sample = (xi, yi) => this.heightmapPixels[(yi * imageWidth + xi) * 4] / 255;

    const h00 = sample(x0, y0);
    const h10 = sample(x1, y0);
    const h01 = sample(x0, y1);
    const h11 = sample(x1, y1);

    const height = (h00 * (1 - tx) + h10 * tx) * (1 - ty)
      + (h01 * (1 - tx) + h11 * tx) * ty;

    return height * this.maxHeight;
  }

  display() {
    if (!this.heightmap || this.heightmap.texID === -1 || !this.terrainTexture || this.terrainTexture.texID === -1) {
      return;
    }

    this.scene.pushMatrix();

    const previousTexturesEnabled = this.scene.texturesEnabled;
    this.scene.setActiveShader(this.shader);
    this.scene.enableTextures(true);
    this.shader.setUniformsValues({
      uHeightmap: 0,
      uTerrainTexture: 1,
      uMaxHeight: this.maxHeight,
      uTerrainStep: this.size / this.divisions,
      uTexelStep: 1.0 / this.divisions,
      uTileScale: 1.0,
    });

    if (this.pathCorners && this.pathCorners.length === 8) {
      this.shader.setUniformsValues({
        uPathHalfWidth: this.pathHalfWidth,
        uPathColor: this.pathColor,
        uPathBlend: this.pathBlend,
      });

      const gl = this.scene.gl;
      const cornersLoc = gl.getUniformLocation(this.shader.program, "uPathCorners");
      if (cornersLoc) {
        gl.uniform2fv(cornersLoc, this.pathCorners);
      }
    }

    this.appearance.apply();
    this.heightmap.bind(0);
    this.terrainTexture.bind(1);
    this.plane.display();
    this.terrainTexture.unbind(1);
    this.heightmap.unbind(0);

    this.scene.enableTextures(previousTexturesEnabled);
    this.scene.setActiveShader(this.scene.defaultShader);
    this.scene.popMatrix();
  }
}