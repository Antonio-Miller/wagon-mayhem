import { CGFobject, CGFappearance, CGFtexture } from "../../../lib/CGF.js";
import { MyCilinder } from "../primitives/MyCilinder.js";
import { MyCone } from "../primitives/MyCone.js";

export class MyHayBaleRound extends CGFobject {
  constructor(scene, scale = 8.0) {
    super(scene);
    // Keep the cylinder slender and longer so, once rotated, it reads as a bale.
    const radius = 1.2 * scale / 8.0;
    const height = 3.3 * scale / 8.0;
    this.model = new MyCilinder(scene, 32, 16, radius, height, true);
    this.scale = scale;
    this.modelRotationX = Math.PI / 2;
    this.body = null;
    this.carried = false;
    this.minY = 0;
    this.maxY = height;
    console.log('[MyHayBaleRound] Cylinder created:', { radius, height, scale });

    // Terrain alignment state (for tilting on slopes)
    this.terrainAlignmentMatrix = null;
    this.smoothedTerrainUp = null;
    this.smoothedTerrainForward = null;
    this.terrainAlignmentSmoothing = 12.0; // responsiveness

    const app = new CGFappearance(scene);
    app.setAmbient(0.6, 0.5, 0.4, 1.0);
    app.setDiffuse(0.8, 0.7, 0.5, 1.0);
    app.setSpecular(0.3, 0.3, 0.3, 1.0);
    app.setShininess(16);
    try {
      const tex = new CGFtexture(scene, "textures/Straw_D.tga.png");
      app.setTexture(tex);
      app.setTextureWrap("REPEAT", "REPEAT");
      console.log('[MyHayBaleRound] Texture loaded successfully');
    } catch (e) {
      console.warn('MyHayBaleRound: failed to load texture', e);
    }

    this.appearance = app;

    // Arrow indicator primitives
    this.arrowCone = new MyCone(scene, 16, 1, 0.3, 0.5); // arrowhead
    
    // Arrow appearance (bright yellow)
    const arrowApp = new CGFappearance(scene);
    arrowApp.setAmbient(1.0, 1.0, 0.0, 0.8);
    arrowApp.setDiffuse(1.0, 1.0, 0.0, 0.8);
    arrowApp.setSpecular(1.0, 1.0, 0.0, 0.8);
    arrowApp.setShininess(32);
    this.arrowAppearance = arrowApp;
  }

  display() {
    if (!this.model || !this.model.vertices) {
      console.warn('[MyHayBaleRound.display] Model is null or invalid');
      return;
    }

    if (this.carried) {
      return;
    }

    // If a physics body is attached, use its position for rendering
    if (this.body && this.body.position) {
      const pos = this.body.position;

      // Compute terrain alignment using current body state.
      if (this.scene && this.scene.terrain && typeof this.scene.terrain.getTerrainNormalAt === 'function') {
        this.updateTerrainAlignment(this.scene.terrain);
      }

      this.displayAtPosition(pos[0], pos[1], pos[2], {
        alignToTerrain: true,
      });
      this.displayArrowIndicator(pos[0], pos[1], pos[2]);
      return;
    }

    // Fallback: render model at origin (caller responsible for positioning)
    const prevTexturesEnabled = this.scene.texturesEnabled;
    this.scene.enableTextures(true);
    this.appearance.apply();
    this.model.display();
    this.scene.enableTextures(prevTexturesEnabled);
  }

  setPhysicsBody(body) {
    this.body = body;
  }

  setCarried(isCarried) {
    this.carried = isCarried;
    if (this.body) {
      this.body.active = !isCarried;
      if (isCarried) {
        this.body.velocity[0] = 0;
        this.body.velocity[1] = 0;
        this.body.velocity[2] = 0;
      }
    }
  }

  displayAtPosition(x, y, z, options = {}) {
    if (!this.model || !this.model.vertices) {
      return;
    }

    const rotationX = options.rotationX ?? this.modelRotationX ?? 0;
    const rotationY = options.rotationY ?? 0;
    const scaleMultiplier = options.scaleMultiplier ?? 1.0;
    const alignToTerrain = options.alignToTerrain ?? false;

    this.scene.pushMatrix();
    this.scene.translate(x, y, z);
    if (rotationX) {
      this.scene.rotate(rotationX, 1, 0, 0);
    }
    if (rotationY) {
      this.scene.rotate(rotationY, 0, 1, 0);
    }
    if (alignToTerrain && this.terrainAlignmentMatrix) {
      this.scene.multMatrix(this.terrainAlignmentMatrix);
    }
    if (scaleMultiplier !== 1.0) {
      this.scene.scale(scaleMultiplier, scaleMultiplier, scaleMultiplier);
    }
    const prevTexturesEnabled2 = this.scene.texturesEnabled;
    this.scene.enableTextures(true);
    this.appearance.apply();
    this.model.display();
    this.scene.enableTextures(prevTexturesEnabled2);
    this.scene.popMatrix();
  }

  updateTerrainAlignment(terrain) {
    if (!terrain || typeof terrain.getTerrainNormalAt !== 'function') {
      this.terrainAlignmentMatrix = null;
      this.smoothedTerrainUp = null;
      this.smoothedTerrainForward = null;
      return;
    }

    // sample normal using a small sample distance appropriate for a bale
    const sampleDistance = 1.0;
    const pos = (this.body && this.body.position) ? this.body.position : [0, 0, 0];
    const normal = terrain.getTerrainNormalAt(pos[0], pos[2], sampleDistance);
    const nlen = Math.hypot(normal[0], normal[1], normal[2]) || 1;
    const targetUp = [normal[0] / nlen, normal[1] / nlen, normal[2] / nlen];

    // Use horizontal component of body velocity as forward direction when available
    let headingForward = [0, 0, 1];
    if (this.body && this.body.velocity) {
      const vx = this.body.velocity[0] || 0;
      const vz = this.body.velocity[2] || 0;
      const vlen = Math.hypot(vx, vz);
      if (vlen > 1e-3) headingForward = [vx / vlen, 0, vz / vlen];
    }

    // Project headingForward onto plane orthogonal to targetUp
    const forwardProjection = headingForward[0] * targetUp[0] + headingForward[1] * targetUp[1] + headingForward[2] * targetUp[2];
    let forward = [
      headingForward[0] - targetUp[0] * forwardProjection,
      headingForward[1] - targetUp[1] * forwardProjection,
      headingForward[2] - targetUp[2] * forwardProjection,
    ];

    let fLen = Math.hypot(forward[0], forward[1], forward[2]);
    if (fLen < 1e-6) {
      forward = [0, 0, 1];
      fLen = 1;
    }
    const targetForward = [forward[0] / fLen, forward[1] / fLen, forward[2] / fLen];

    // Smooth up and forward to avoid jitter
    const smoothT = 1 - Math.exp(-this.terrainAlignmentSmoothing * 0.016);
    if (!this.smoothedTerrainUp) this.smoothedTerrainUp = targetUp.slice();
    else {
      this.smoothedTerrainUp = [
        this.smoothedTerrainUp[0] + (targetUp[0] - this.smoothedTerrainUp[0]) * smoothT,
        this.smoothedTerrainUp[1] + (targetUp[1] - this.smoothedTerrainUp[1]) * smoothT,
        this.smoothedTerrainUp[2] + (targetUp[2] - this.smoothedTerrainUp[2]) * smoothT,
      ];
      const suLen = Math.hypot(this.smoothedTerrainUp[0], this.smoothedTerrainUp[1], this.smoothedTerrainUp[2]) || 1;
      this.smoothedTerrainUp = [this.smoothedTerrainUp[0] / suLen, this.smoothedTerrainUp[1] / suLen, this.smoothedTerrainUp[2] / suLen];
    }

    if (!this.smoothedTerrainForward) this.smoothedTerrainForward = targetForward.slice();
    else {
      this.smoothedTerrainForward = [
        this.smoothedTerrainForward[0] + (targetForward[0] - this.smoothedTerrainForward[0]) * smoothT,
        this.smoothedTerrainForward[1] + (targetForward[1] - this.smoothedTerrainForward[1]) * smoothT,
        this.smoothedTerrainForward[2] + (targetForward[2] - this.smoothedTerrainForward[2]) * smoothT,
      ];
      const sfLen = Math.hypot(this.smoothedTerrainForward[0], this.smoothedTerrainForward[1], this.smoothedTerrainForward[2]) || 1;
      this.smoothedTerrainForward = [this.smoothedTerrainForward[0] / sfLen, this.smoothedTerrainForward[1] / sfLen, this.smoothedTerrainForward[2] / sfLen];
    }

    // Build right vector
    let right = [
      this.smoothedTerrainForward[1] * this.smoothedTerrainUp[2] - this.smoothedTerrainForward[2] * this.smoothedTerrainUp[1],
      this.smoothedTerrainForward[2] * this.smoothedTerrainUp[0] - this.smoothedTerrainForward[0] * this.smoothedTerrainUp[2],
      this.smoothedTerrainForward[0] * this.smoothedTerrainUp[1] - this.smoothedTerrainForward[1] * this.smoothedTerrainUp[0],
    ];
    const rlen = Math.hypot(right[0], right[1], right[2]) || 1;
    right = [right[0] / rlen, right[1] / rlen, right[2] / rlen];

    // Recompute forward to ensure orthonormal basis
    const forwardOut = [
      this.smoothedTerrainUp[1] * right[2] - this.smoothedTerrainUp[2] * right[1],
      this.smoothedTerrainUp[2] * right[0] - this.smoothedTerrainUp[0] * right[2],
      this.smoothedTerrainUp[0] * right[1] - this.smoothedTerrainUp[1] * right[0],
    ];
    const foLen = Math.hypot(forwardOut[0], forwardOut[1], forwardOut[2]) || 1;
    const forwardNorm = [forwardOut[0] / foLen, forwardOut[1] / foLen, forwardOut[2] / foLen];

    this.terrainAlignmentMatrix = new Float32Array([
      right[0], right[1], right[2], 0,
      this.smoothedTerrainUp[0], this.smoothedTerrainUp[1], this.smoothedTerrainUp[2], 0,
      forwardNorm[0], forwardNorm[1], forwardNorm[2], 0,
      0, 0, 0, 1,
    ]);
  }

  displayArrowIndicator(x, y, z) {
    const prevTexturesEnabled = this.scene.texturesEnabled;
    this.scene.enableTextures(false);

    this.scene.pushMatrix();
    this.scene.translate(x, y + this.maxY + 0.5, z);
    this.scene.rotate(Math.PI, 1, 0, 0); // flip cone to point up
    this.scene.scale(1.5, 1.5, 1.5); // make it bigger
    this.arrowAppearance.apply();
    this.arrowCone.display();
    this.scene.popMatrix();
    
    this.scene.enableTextures(prevTexturesEnabled);
  }
}
