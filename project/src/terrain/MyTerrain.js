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
      uPathBlendMap: 2,
      uMaxHeight: this.maxHeight,
      uTerrainStep: this.size / this.divisions,
      uTexelStep: 1.0 / this.divisions,
      uTileScale: 1.0,
      uPathColor: [0.72, 0.54, 0.36],
      uPathBlend: 0.92,
    });

    this.pathCorners = null;
    this.pathHalfWidth = 0.0;
    this.pathRadius = 200.0;
    this.pathCenterX = 0.0;
    this.pathCenterZ = 0.0;
    this.pathEnabled = false;
    this.circularAreaEnabled = false;
    this.circularAreaRadius = 0.0;
    this.circularAreaEdgeSoftness = 8.0;
    this.pathColor = [0.72, 0.54, 0.36];
    this.pathBlend = 0.92;
    this.pathBlendMap = null;
  }

  worldToBlendMap(x, z, size) {
    const px = ((x + this.halfSize) / this.size) * size;
    const py = ((this.halfSize - z) / this.size) * size;
    return [px, py];
  }

  generateCircularAreaBlendMap(centerX, centerZ, radius, edgeSoftness = 8.0) {
    const canvas = document.createElement('canvas');
    const size = 512;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, size, size);

    const worldToPixels = size / this.size;
    const [centerPx, centerPy] = this.worldToBlendMap(centerX, centerZ, size);
    const radiusPixels = Math.max(0, radius * worldToPixels);
    const softnessPixels = Math.max(0, edgeSoftness * worldToPixels);
    const innerRadius = Math.max(0, radiusPixels - softnessPixels);
    const outerRadius = radiusPixels + softnessPixels;

    const gradient = ctx.createRadialGradient(
      centerPx,
      centerPy,
      innerRadius,
      centerPx,
      centerPy,
      outerRadius
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerPx, centerPy, outerRadius, 0, Math.PI * 2);
    ctx.fill();

    return new CGFtexture(this.scene, canvas.toDataURL());
  }

  rebuildPathBlendMap() {
    const canvas = document.createElement('canvas');
    const size = 512;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, size, size);

    const worldToPixels = size / this.size;

    if (this.pathEnabled) {
      const centerX = size / 2;
      const centerY = size / 2;
      const ringRadiusPixels = this.pathRadius * worldToPixels;
      const ringWidthPixels = (this.pathHalfWidth * 2) * worldToPixels;

      ctx.strokeStyle = 'white';
      ctx.lineWidth = ringWidthPixels;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.arc(centerX, centerY, ringRadiusPixels, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (this.circularAreaEnabled) {
      const [centerPx, centerPy] = this.worldToBlendMap(this.pathCenterX, this.pathCenterZ, size);
      const radiusPixels = Math.max(0, this.circularAreaRadius * worldToPixels);
      const softnessPixels = Math.max(0, this.circularAreaEdgeSoftness * worldToPixels);
      const innerRadius = Math.max(0, radiusPixels - softnessPixels);
      const outerRadius = radiusPixels + softnessPixels;

      const gradient = ctx.createRadialGradient(
        centerPx,
        centerPy,
        innerRadius,
        centerPx,
        centerPy,
        outerRadius
      );
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerPx, centerPy, outerRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    this.pathBlendMap = new CGFtexture(this.scene, canvas.toDataURL());
  }

  generatePathBlendMap(corners, halfWidth) {
    const canvas = document.createElement('canvas');
    const size = 512;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Background: black (no path)
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, size, size);

    // Center of terrain in canvas space
    const centerX = size / 2;
    const centerY = size / 2;

    // Convert world units to canvas pixels.
    const worldToPixels = size / this.size;
    const ringRadiusPixels = this.pathRadius * worldToPixels;
    const ringWidthPixels = (halfWidth * 2) * worldToPixels;

    // Draw circular path as a white stroke
    ctx.strokeStyle = 'white';
    ctx.lineWidth = ringWidthPixels;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.arc(centerX, centerY, ringRadiusPixels, 0, Math.PI * 2);
    ctx.stroke();

    // Optional: Apply slight blur for softer edges
    ctx.filter = 'blur(2px)';
    ctx.drawImage(canvas, 0, 0);

    // Create texture from canvas
    const texture = new CGFtexture(this.scene, canvas.toDataURL());
    return texture;
  }

  setPathUniforms(corners, halfWidth, color, blend) {
    this.pathCorners = corners ? new Float32Array(corners) : null;
    this.pathHalfWidth = halfWidth;
    this.pathColor = color ?? this.pathColor;
    this.pathBlend = blend ?? this.pathBlend;
    this.pathEnabled = true;

    if (!this.pathCorners || this.pathCorners.length !== 8) {
      return;
    }

    // Rebuild blend map combining all enabled path/area masks.
    this.rebuildPathBlendMap();

    // Update shader uniforms
    this.shader.setUniformsValues({
      uPathColor: this.pathColor,
      uPathBlend: this.pathBlend,
    });
  }

  setCircularArea(centerX, centerZ, radius, color, blend, edgeSoftness = 8.0) {
    this.pathCenterX = centerX;
    this.pathCenterZ = centerZ;
    this.circularAreaRadius = radius;
    this.circularAreaEdgeSoftness = edgeSoftness;
    this.circularAreaEnabled = true;
    this.pathColor = color ?? this.pathColor;
    this.pathBlend = blend ?? this.pathBlend;

    this.rebuildPathBlendMap();

    this.shader.setUniformsValues({
      uPathColor: this.pathColor,
      uPathBlend: this.pathBlend,
    });
  }

  isPointOnPath(worldX, worldZ, margin = 0) {
    if (this.pathEnabled && this.pathCorners && this.pathCorners.length >= 8) {
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;

      for (let i = 0; i < this.pathCorners.length; i += 2) {
        const x = this.pathCorners[i];
        const z = this.pathCorners[i + 1];
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
      }

      if (
        worldX >= minX - margin &&
        worldX <= maxX + margin &&
        worldZ >= minZ - margin &&
        worldZ <= maxZ + margin
      ) {
        return true;
      }
    }

    if (this.circularAreaEnabled) {
      const dx = worldX - this.pathCenterX;
      const dz = worldZ - this.pathCenterZ;
      const radius = this.circularAreaRadius + margin;

      if (dx * dx + dz * dz <= radius * radius) {
        return true;
      }
    }

    return false;
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
      uPathBlendMap: 2,
      uMaxHeight: this.maxHeight,
      uTerrainStep: this.size / this.divisions,
      uTexelStep: 1.0 / this.divisions,
      uTileScale: 1.0,
      uPathColor: this.pathColor,
      uPathBlend: this.pathBlend,
    });

    this.appearance.apply();
    this.heightmap.bind(0);
    this.terrainTexture.bind(1);
    if (this.pathBlendMap) {
      this.pathBlendMap.bind(2);
    }
    this.plane.display();
    if (this.pathBlendMap) {
      this.pathBlendMap.unbind(2);
    }
    this.terrainTexture.unbind(1);
    this.heightmap.unbind(0);

    this.scene.enableTextures(previousTexturesEnabled);
    this.scene.setActiveShader(this.scene.defaultShader);
    this.scene.popMatrix();
  }
}