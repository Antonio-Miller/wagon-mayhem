import { CGFappearance } from "../../../lib/CGF.js";
import { MyUnitCube } from "../primitives/MyUnitCube.js";
import { MyCylinder } from "../primitives/MyCylinder.js";
import { MyWheel } from "./MyWheel.js";
import { MyWagonCover } from "./MyWagonCover.js";

/**
 * MyWagon — Hierarchical covered-wagon (prairie schooner) model.
 *
 * ╔══════════════════════════════════════════════════════════╗
 * ║  Local coordinate system                                ║
 * ║    Y = up · Z = forward (default heading) · X = right   ║
 * ║    Origin at ground-level, centred under the body.      ║
 * ╠══════════════════════════════════════════════════════════╣
 * ║  Scene-graph hierarchy                                  ║
 * ║  Wagon  (world translate + heading rotation)            ║
 * ║  ├── Body  (floor + 4 side walls — open top)            ║
 * ║  ├── Cover (half-cylinder canopy, rear half)            ║
 * ║  ├── Rear axle  (fixed to body)                         ║
 * ║  │   ├── Axle cylinder                                  ║
 * ║  │   ├── Left wheel   (rolls)                           ║
 * ║  │   └── Right wheel  (rolls)                           ║
 * ║  └── Front assembly  (rotates around Y for steering)    ║
 * ║      ├── Tongue beam  (extends forward)                 ║
 * ║      ├── Cross-bar    (horse attachment)                ║
 * ║      ├── Axle cylinder                                  ║
 * ║      ├── Left wheel   (rolls)                           ║
 * ║      └── Right wheel  (rolls)                           ║
 * ╚══════════════════════════════════════════════════════════╝
 */
export class MyWagon {
  constructor(scene) {
    this.scene = scene;

    // ═══════════════════ Dimensions ═══════════════════
    // Scaled to match scene objects (rocks ≈ 2–5 u, trees ≈ 19 u tall)
    this.bodyLength = 12.0;       // Z extent
    this.bodyWidth  = 6.0;        // X extent (outer, including walls)
    this.wallHeight = 2.0;        // Y extent of side walls above the floor
    this.floorY     = 1.6;        // Y of floor bottom (sits just below axle centres)
    this.floorThick = 0.20;
    this.wallThick  = 0.22;

    this.wheelRadius   = 1.8;
    this.axleY         = this.wheelRadius;              // axle centre height
    this.rearAxleZ     = -this.bodyLength * 0.32;       // rear axle Z position
    this.frontAxleZ    =  this.bodyLength * 0.32;       // front axle Z position
    this.axleFullWidth = this.bodyWidth + 1.2;          // total visible axle span
    this.tongueLength  = 7.5;                           // tongue extends forward from front axle

    // ═══════════════════ Kinematic state ═══════════════════
    this.x = 0;
    this.y = 0;           // set by scene (terrain height)
    this.z = 0;
    this.heading    = 0;  // radians — 0 faces +Z
    this.speed      = 0;  // world units / s
    this.steerAngle = 0;  // radians — front-wheel turn
    this.wheelAngle = 0;  // cumulative roll
    this.terrainAlignmentMatrix = null;

    // ═══════════════════ Primitives ═══════════════════
    // primitives (kept in fields so they can be unloaded)
    this.cube  = new MyUnitCube(scene);
    this.axle  = new MyCylinder(scene, 10, this.axleFullWidth, 0.10, 0.10, true);
    this.wheel = new MyWheel(scene, this.wheelRadius, 0.15, 0.30, 0.40, 8);
    this.cover = new MyWagonCover(scene, this.bodyWidth, this.bodyLength / 2, 16, 8, 5);

    // ═══════════════════ Materials ═══════════════════
    // Light wood — body
    this.woodMat = new CGFappearance(scene);
    this.woodMat.setAmbient(0.40, 0.26, 0.10, 1);
    this.woodMat.setDiffuse(0.62, 0.42, 0.18, 1);
    this.woodMat.setSpecular(0.15, 0.10, 0.05, 1);
    this.woodMat.setShininess(12);

    // Dark wood — tongue / under-carriage
    this.darkWoodMat = new CGFappearance(scene);
    this.darkWoodMat.setAmbient(0.22, 0.13, 0.05, 1);
    this.darkWoodMat.setDiffuse(0.40, 0.24, 0.10, 1);
    this.darkWoodMat.setSpecular(0.10, 0.08, 0.04, 1);
    this.darkWoodMat.setShininess(8);

    // Metal — axles
    this.metalMat = new CGFappearance(scene);
    this.metalMat.setAmbient(0.20, 0.20, 0.22, 1);
    this.metalMat.setDiffuse(0.40, 0.40, 0.45, 1);
    this.metalMat.setSpecular(0.55, 0.55, 0.60, 1);
    this.metalMat.setShininess(50);
    this._primitivesLoaded = true;
  }

  // ────────────────────────────────────────────────────────
  //  Physics / Controls
  // ────────────────────────────────────────────────────────
  update(deltaTime, keys) {
    const ACCEL        = 15.0;  // units/s²  (scaled to larger world)
    const DECEL        = 25.0;  // braking
    const MAX_SPEED    = 15.0;  // base top speed for gear 1
    const STEER_RATE   = 1.5;   // rad/s
    const MAX_STEER    = 0.45;  // ~25°
    const STEER_RETURN = 2.5;   // rad/s back to centre
    const FRICTION     = 5.0;   // passive slow-down
    const forwardGear = Math.max(1, keys?.wagonForwardGear ?? 1);
    const reverseGear = Math.max(1, keys?.wagonReverseGear ?? 1);

    // ── Acceleration / braking ──
    // SPACE applies an immediate brake (while held) that reduces speed toward 0
    if (keys["Space"]) {
      if (this.speed > 0) this.speed = Math.max(this.speed - DECEL * deltaTime, 0);
      else this.speed = Math.min(this.speed + DECEL * deltaTime, 0);
    }
    // W accelerates forward, S decelerates and can go into negative (reverse)
    else if (keys["KeyW"]) {
      this.speed = Math.min(this.speed + (ACCEL * forwardGear) * deltaTime, MAX_SPEED * forwardGear);
    } else if (keys["KeyS"]) {
      this.speed = Math.max(this.speed - (DECEL * reverseGear) * deltaTime, -MAX_SPEED * reverseGear);
    } else {
      // Friction: bring speed toward zero from either positive or negative
      if (this.speed > 0) this.speed = Math.max(this.speed - FRICTION * deltaTime, 0);
      else this.speed = Math.min(this.speed + FRICTION * deltaTime, 0);
    }

    // ── Steering ──
    // Note: A should steer left, D should steer right. Swap signs accordingly.
    if (keys["KeyA"])      this.steerAngle = Math.min(this.steerAngle + STEER_RATE * deltaTime,  MAX_STEER);
    else if (keys["KeyD"]) this.steerAngle = Math.max(this.steerAngle - STEER_RATE * deltaTime, -MAX_STEER);
    else {
      // auto-return
      if      (this.steerAngle > 0) this.steerAngle = Math.max(this.steerAngle - STEER_RETURN * deltaTime, 0);
      else if (this.steerAngle < 0) this.steerAngle = Math.min(this.steerAngle + STEER_RETURN * deltaTime, 0);
    }

    // ── Heading (bicycle model) ──
    const wheelBase = Math.abs(this.frontAxleZ - this.rearAxleZ);
    // Allow steering while moving forward or backward
    if (Math.abs(this.speed) > 0.001) {
      this.heading += Math.tan(this.steerAngle) * (this.speed / wheelBase) * deltaTime;
    }

    // ── Position ──
    this.x += Math.sin(this.heading) * this.speed * deltaTime;
    this.z += Math.cos(this.heading) * this.speed * deltaTime;

    // ── Wheel roll ──
    this.wheelAngle += (this.speed / this.wheelRadius) * deltaTime;

    // ── Instant reset (R key) ──
    if (keys["KeyR"]) {
      this.x = 0; this.z = 0; this.y = 0;
      this.heading = 0; this.speed = 0;
      this.steerAngle = 0; this.wheelAngle = 0;
      this.terrainAlignmentMatrix = null;
    }
  }

  updateTerrainAlignment(terrain) {
    if (!terrain || typeof terrain.getTerrainNormalAt !== 'function') {
      this.terrainAlignmentMatrix = null;
      return;
    }

    const sampleDistance = Math.max(2.0, this.bodyWidth * 0.5);
    const normal = terrain.getTerrainNormalAt(this.x, this.z, sampleDistance);
    const normalLength = Math.hypot(normal[0], normal[1], normal[2]) || 1;
    const up = [normal[0] / normalLength, normal[1] / normalLength, normal[2] / normalLength];

    const headingForward = [Math.sin(this.heading), 0, Math.cos(this.heading)];
    const forwardProjection = headingForward[0] * up[0] + headingForward[1] * up[1] + headingForward[2] * up[2];
    let forward = [
      headingForward[0] - up[0] * forwardProjection,
      headingForward[1] - up[1] * forwardProjection,
      headingForward[2] - up[2] * forwardProjection,
    ];

    let forwardLength = Math.hypot(forward[0], forward[1], forward[2]);
    if (forwardLength < 1e-6) {
      forward = [0, 0, 1];
      const fallbackProjection = forward[0] * up[0] + forward[1] * up[1] + forward[2] * up[2];
      forward = [
        forward[0] - up[0] * fallbackProjection,
        forward[1] - up[1] * fallbackProjection,
        forward[2] - up[2] * fallbackProjection,
      ];
      forwardLength = Math.hypot(forward[0], forward[1], forward[2]);
    }

    if (forwardLength < 1e-6) {
      this.terrainAlignmentMatrix = null;
      return;
    }

    forward = [forward[0] / forwardLength, forward[1] / forwardLength, forward[2] / forwardLength];

    let right = [
      up[1] * forward[2] - up[2] * forward[1],
      up[2] * forward[0] - up[0] * forward[2],
      up[0] * forward[1] - up[1] * forward[0],
    ];
    const rightLength = Math.hypot(right[0], right[1], right[2]);
    if (rightLength < 1e-6) {
      this.terrainAlignmentMatrix = null;
      return;
    }

    right = [right[0] / rightLength, right[1] / rightLength, right[2] / rightLength];

    forward = [
      right[1] * up[2] - right[2] * up[1],
      right[2] * up[0] - right[0] * up[2],
      right[0] * up[1] - right[1] * up[0],
    ];

    this.terrainAlignmentMatrix = new Float32Array([
      right[0], right[1], right[2], 0,
      up[0], up[1], up[2], 0,
      forward[0], forward[1], forward[2], 0,
      0, 0, 0, 1,
    ]);
  }

  // ────────────────────────────────────────────────────────
  //  Body — floor + 4 side walls (open top)
  // ────────────────────────────────────────────────────────
  displayBody() {
    const hw = this.bodyWidth  / 2;
    const hl = this.bodyLength / 2;
    const fy = this.floorY;
    const ft = this.floorThick;
    const wh = this.wallHeight;
    const wt = this.wallThick;

    this.woodMat.apply();

    // Floor
    this.scene.pushMatrix();
    this.scene.translate(0, fy + ft / 2, 0);
    this.scene.scale(this.bodyWidth, ft, this.bodyLength);
    this.cube.display();
    this.scene.popMatrix();

    // Left wall
    this.scene.pushMatrix();
    this.scene.translate(-(hw - wt / 2), fy + ft + wh / 2, 0);
    this.scene.scale(wt, wh, this.bodyLength);
    this.cube.display();
    this.scene.popMatrix();

    // Right wall
    this.scene.pushMatrix();
    this.scene.translate(hw - wt / 2, fy + ft + wh / 2, 0);
    this.scene.scale(wt, wh, this.bodyLength);
    this.cube.display();
    this.scene.popMatrix();

    // Back wall
    this.scene.pushMatrix();
    this.scene.translate(0, fy + ft + wh / 2, -(hl - wt / 2));
    this.scene.scale(this.bodyWidth, wh, wt);
    this.cube.display();
    this.scene.popMatrix();

    // Front wall
    this.scene.pushMatrix();
    this.scene.translate(0, fy + ft + wh / 2, hl - wt / 2);
    this.scene.scale(this.bodyWidth, wh, wt);
    this.cube.display();
    this.scene.popMatrix();
  }

  // ────────────────────────────────────────────────────────
  //  Cover — half-cylinder canopy over the rear half
  // ────────────────────────────────────────────────────────
  displayCover() {
    if (!this._primitivesLoaded || !this.cover) return;
    this.scene.pushMatrix();
    // Position at top of the rear walls
    this.scene.translate(0, this.floorY + this.floorThick + this.wallHeight, -this.bodyLength / 4);
    this.cover.display();
    this.scene.popMatrix();
  }

  // ────────────────────────────────────────────────────────
  //  Single wheel helper — stands the flat disc up
  // ────────────────────────────────────────────────────────
  displayWheel(roll, isLeft) {
    if (!this._primitivesLoaded || !this.wheel) return;
    this.scene.pushMatrix();
    // Stand the flat XZ-disc up into the YZ-plane
    // ±90° around Z mirrors the outer face to the correct side
    this.scene.rotate(isLeft ? Math.PI / 2 : -Math.PI / 2, 0, 0, 1);
    // Roll
    this.scene.rotate(roll, 0, 1, 0);
    this.wheel.display();
    this.scene.popMatrix();
  }

  // ────────────────────────────────────────────────────────
  //  Axle + two wheels (optionally steerable)
  // ────────────────────────────────────────────────────────
  displayAxle(z, steerable) {
    const halfW = this.axleFullWidth / 2;

    if (!this._primitivesLoaded || !this.axle) return;

    this.scene.pushMatrix();
    this.scene.translate(0, this.axleY, z);

    // Steering rotation (front axle only)
    if (steerable) this.scene.rotate(this.steerAngle, 0, 1, 0);

    // ── Axle bar ── (cylinder along Y, rotated to lie along X)
    this.metalMat.apply();
    this.scene.pushMatrix();
    this.scene.translate(-halfW, 0, 0);
    this.scene.rotate(-Math.PI / 2, 0, 0, 1);
    this.axle.display();
    this.scene.popMatrix();

    // ── Left wheel ──
    this.scene.pushMatrix();
    this.scene.translate(-(halfW + 0.25), 0, 0);
    this.displayWheel(this.wheelAngle, true);
    this.scene.popMatrix();

    // ── Right wheel ──
    this.scene.pushMatrix();
    this.scene.translate(halfW + 0.25, 0, 0);
    this.displayWheel(this.wheelAngle, false);
    this.scene.popMatrix();

    // ── Tongue (front assembly only) ──
    if (steerable) {
      this.darkWoodMat.apply();

      // Main beam — extends forward with a slight downward slope
      const slopeAngle = Math.atan2(1.0, this.tongueLength);
      this.scene.pushMatrix();
      this.scene.translate(0, 0, this.tongueLength / 2);
      this.scene.rotate(-slopeAngle, 1, 0, 0);
      this.scene.scale(0.30, 0.22, this.tongueLength);
      this.cube.display();
      this.scene.popMatrix();

      // Cross-bar at the tongue tip (for horse attachment)
      this.scene.pushMatrix();
      this.scene.translate(0, -0.6, this.tongueLength);
      this.scene.scale(3.0, 0.22, 0.22);
      this.cube.display();
      this.scene.popMatrix();
    }

    this.scene.popMatrix();
  }

  // ────────────────────────────────────────────────────────
  //  Display — root of the wagon scene graph
  // ────────────────────────────────────────────────────────
  display() {
    if (!this._primitivesLoaded) return;

    this.scene.pushMatrix();

    // World position + heading
    this.scene.translate(this.x, this.y, this.z);
    if (this.terrainAlignmentMatrix) {
      this.scene.multMatrix(this.terrainAlignmentMatrix);
    } else {
      this.scene.rotate(this.heading, 0, 1, 0);
    }

    this.displayBody();
    this.displayCover();
    this.displayAxle(this.rearAxleZ,  false);   // rear  — fixed
    this.displayAxle(this.frontAxleZ, true);     // front — steerable

    this.scene.popMatrix();
  }

  unloadModel() {
    // null heavy primitives and mark unloaded
    this.cube = null;
    this.axle = null;
    this.wheel = null;
    this.cover = null;
    this.woodMat = null;
    this.darkWoodMat = null;
    this.metalMat = null;
    this._primitivesLoaded = false;
  }

  loadModel() {
    if (this._primitivesLoaded) return;
    // recreate primitives and materials
    this.cube  = new MyUnitCube(this.scene);
    this.axle  = new MyCylinder(this.scene, 10, this.axleFullWidth, 0.10, 0.10, true);
    this.wheel = new MyWheel(this.scene, this.wheelRadius, 0.15, 0.30, 0.40, 8);
    this.cover = new MyWagonCover(this.scene, this.bodyWidth, this.bodyLength / 2, 16, 8, 5);

    this.woodMat = new CGFappearance(this.scene);
    this.woodMat.setAmbient(0.40, 0.26, 0.10, 1);
    this.woodMat.setDiffuse(0.62, 0.42, 0.18, 1);
    this.woodMat.setSpecular(0.15, 0.10, 0.05, 1);
    this.woodMat.setShininess(12);

    this.darkWoodMat = new CGFappearance(this.scene);
    this.darkWoodMat.setAmbient(0.22, 0.13, 0.05, 1);
    this.darkWoodMat.setDiffuse(0.40, 0.24, 0.10, 1);
    this.darkWoodMat.setSpecular(0.10, 0.08, 0.04, 1);
    this.darkWoodMat.setShininess(8);

    this.metalMat = new CGFappearance(this.scene);
    this.metalMat.setAmbient(0.20, 0.20, 0.22, 1);
    this.metalMat.setDiffuse(0.40, 0.40, 0.45, 1);
    this.metalMat.setSpecular(0.55, 0.55, 0.60, 1);
    this.metalMat.setShininess(50);

    this._primitivesLoaded = true;
  }
}
