import { CGFappearance } from "../../../lib/CGF.js";
import { MyUnitCube } from "../primitives/MyUnitCube.js";
import { MyCylinder } from "../primitives/MyCylinder.js";
import { MyOBJModel } from "../MyOBJModel.js";
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
  constructor(scene, gameState = null) {
    this.scene = scene;
    this.gameState = gameState; // Reference to GameState for health tracking
    this.activeCollisionContacts = new Set();

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
    this.horseOffsetZ  = this.tongueLength + 1.75;

    // ═══════════════════ Kinematic state ═══════════════════
    this.x = 0;
    this.y = 0;           // set by scene (terrain height)
    this.z = 0;
    this.heading    = 0;  // radians — 0 faces +Z
    this.speed      = 0;  // world units / s
    this.steerAngle = 0;  // radians — front-wheel turn
    this.wheelAngle = 0;  // cumulative roll
    this.terrainAlignmentMatrix = null;
    this.smoothedTerrainUp = null;
    this.smoothedTerrainForward = null;
    this.terrainAlignmentSmoothing = 8.0;
      // Wheel spin tuning
      this.wheelSpinBaseScale = 1.0; // baseline multiplier for wheel angular speed
      this.wheelSpinPerGear = 0.25;  // additional multiplier per extra gear (gear2 adds 0.25)

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

    // Horse — attached to the front assembly
    this.horseModel = new MyOBJModel(scene, '/project/models/horse.obj', 1.7);

    // Metal — axles
    this.metalMat = new CGFappearance(scene);
    this.metalMat.setAmbient(0.20, 0.20, 0.22, 1);
    this.metalMat.setDiffuse(0.40, 0.40, 0.45, 1);
    this.metalMat.setSpecular(0.55, 0.55, 0.60, 1);
    this.metalMat.setShininess(50);
    this._primitivesLoaded = true;

    // Horse physical hitch state
    this.horseHeading = this.heading; // world radians
    this.horseX = this.x;
    this.horseY = this.y;
    this.horseZ = this.z + this.horseOffsetZ; // initial place in front
    this.horseLeadDist = this.horseOffsetZ; // distance from wagon center to horse centre
    this.horseRearOffset = 1.0; // distance from horse centre to hitch point (rear of horse)
    this.horseTurnSpeed = 2.0; // responsiveness when turning (reduced for smoothness)
    this.wagonFollowSpeed = 1.8; // how quickly wagon aligns to hitch (reduced)
    this.maxHorseAngularVel = 1.2; // rad/s - cap per-frame horse rotation
    this.maxWagonAngularVel = 1.0; // rad/s - cap per-frame wagon rotation
    this.carriedHayBales = [];
  }

  setCarriedHayBales(hayBales) {
    this.carriedHayBales = Array.isArray(hayBales) ? hayBales : [];
  }

  displayCarriedHayBales() {
    if (!Array.isArray(this.carriedHayBales) || this.carriedHayBales.length === 0) {
      return;
    }

    const cargoY = this.floorY + this.floorThick + 0.75;
    const slots = [
      { x: -1.35, z: -0.75, rotationX: Math.PI / 2 },
      { x: 1.35, z: 0.75, rotationX: Math.PI / 2 },
    ];

    for (let i = 0; i < this.carriedHayBales.length && i < slots.length; i++) {
      const hay = this.carriedHayBales[i];
      if (!hay?.bale) continue;

      const slot = slots[i];
      // Keep hay at its original size (scaleMultiplier: 1.0)
      hay.bale.displayAtPosition(slot.x, cargoY, slot.z, {
        rotationX: slot.rotationX,
        scaleMultiplier: 1.0,
      });
    }
  }

  // ────────────────────────────────────────────────────────
  //  Physics / Controls
  // ────────────────────────────────────────────────────────
  update(deltaTime, keys) {
    if (this.gameState?.isGameOver()) {
      if (keys?.KeyR) {
        this.reset();
      }
      return;
    }

    const ACCEL        = 15.0;  // units/s²  (scaled to larger world)
    const DECEL        = 25.0;  // braking
    const MAX_SPEED    = 15.0;  // base top speed for gear 1
    const STEER_RATE   = 1.5;   // rad/s
    const MAX_STEER    = 0.45;  // ~25°
    const STEER_RETURN = 2.5;   // rad/s back to centre
    const FRICTION     = 5.0;   // passive slow-down
    const forwardGear = Math.max(1, keys?.wagonForwardGear ?? 1);

    // ── Acceleration / braking ──
    // S applies an immediate brake (while held) that reduces speed toward 0
    if (keys["KeyS"]) {
      if (this.speed > 0) this.speed = Math.max(this.speed - DECEL * deltaTime, 0);
      else this.speed = Math.min(this.speed + DECEL * deltaTime, 0);
    }
    // W accelerates forward; reverse driving is disabled
    else if (keys["KeyW"]) {
      this.speed = Math.min(this.speed + (ACCEL * forwardGear) * deltaTime, MAX_SPEED * forwardGear);
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

    // ── Position (wagon translates forward) ──
    this.x += Math.sin(this.heading) * this.speed * deltaTime;
    this.z += Math.cos(this.heading) * this.speed * deltaTime;

    // Helper: shortest angular difference
    const shortestAngleDiff = (a, b) => {
      let d = b - a;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      return d;
    };

    // Update horse heading: horse anticipates steering input and smoothly turns
    const desiredHorseHeading = this.heading + (this.steerAngle || 0) * 1.5;
    const horseBlend = 1 - Math.exp(-this.horseTurnSpeed * Math.max(0, deltaTime));
    const horseAngleDiff = shortestAngleDiff(this.horseHeading, desiredHorseHeading);
    const desiredHorseDelta = horseAngleDiff * horseBlend;
    const maxHorseDelta = (this.maxHorseAngularVel || 10) * Math.max(0, deltaTime);
    const appliedHorseDelta = Math.sign(desiredHorseDelta) * Math.min(Math.abs(desiredHorseDelta), maxHorseDelta);
    this.horseHeading = this.horseHeading + appliedHorseDelta;

    // Compute horse world position ahead of the wagon along the horse forward vector
    const horseFwdX = Math.sin(this.horseHeading);
    const horseFwdZ = Math.cos(this.horseHeading);
    this.horseX = this.x + horseFwdX * this.horseLeadDist;
    this.horseZ = this.z + horseFwdZ * this.horseLeadDist;
    this.horseY = this.scene && this.scene.terrain ? this.scene.terrain.getHeightAt(this.horseX, this.horseZ) : this.y;

    // Hitch point is at the rear of the horse
    const hitchX = this.horseX - horseFwdX * this.horseRearOffset;
    const hitchZ = this.horseZ - horseFwdZ * this.horseRearOffset;

    // Wagon heading should point toward the hitch point (smoothed)
    const desiredWagonHeading = Math.atan2(hitchX - this.x, hitchZ - this.z);
    // Follow speed scales with wagon speed (faster motion -> slightly quicker articulation)
    const followFactor = 1 - Math.exp(-this.wagonFollowSpeed * (1 + Math.abs(this.speed) * 0.1) * Math.max(0, deltaTime));
    const wagonAngleDiff = shortestAngleDiff(this.heading, desiredWagonHeading);
    const desiredWagonDelta = wagonAngleDiff * followFactor;
    const maxWagonDelta = (this.maxWagonAngularVel || 10) * Math.max(0, deltaTime);
    const appliedWagonDelta = Math.sign(desiredWagonDelta) * Math.min(Math.abs(desiredWagonDelta), maxWagonDelta);
    this.heading = this.heading + appliedWagonDelta;

    // ── Wheel roll ──
      // Use the standard angular-speed formula ω = v / r, but apply a small gear-based scale
      // so wheels visibly spin correctly in higher gears.
      // Determine current gear from input keys (forward or reverse depending on sign)
      const gear = (this.speed >= 0) ? (keys?.wagonForwardGear ?? 1) : (keys?.wagonReverseGear ?? 1);
      const gearExtra = Math.max(0, (gear || 1) - 1);
      const spinScale = (this.wheelSpinBaseScale || 1.0) + (this.wheelSpinPerGear || 0.25) * gearExtra;
      this.wheelAngle += (this.speed / Math.max(1e-6, this.wheelRadius)) * deltaTime * spinScale;

    // ── Instant reset (R key) ──
    if (keys["KeyR"]) {
      this.reset();
    }
  }

  /**
   * Reset wagon to starting state (also resets GameState if available).
   */
  reset() {
    this.x = 0;
    this.z = 0;
    this.y = 0;
    this.heading = 0;
    this.speed = 0;
    this.steerAngle = 0;
    this.wheelAngle = 0;
    this.terrainAlignmentMatrix = null;
    this.smoothedTerrainUp = null;
    this.smoothedTerrainForward = null;
    this.activeCollisionContacts.clear();

    // Reset GameState as well
    if (this.gameState) {
      this.gameState.reset();
    }
  }

  /**
   * Check for collisions with obstacles and apply damage via GameState.
   * Damageable: rocks, trees, flowers, fence posts
   * Safe (no damage): barn
   */
  checkCollisions(obstacles = {}, sceneData = {}) {
    if (!this.gameState) return;

    const wagonRadius = Math.max(this.bodyWidth, this.bodyLength) / 2 + 1.5;
    const collisionDamage = 10;
    const currentContacts = new Set();

    const registerContact = (contactId) => {
      currentContacts.add(contactId);
      if (!this.activeCollisionContacts.has(contactId)) {
        this.gameState.damageWagon(collisionDamage);
      }
    };

    // ════════════════════════════════════════
    // Check ROCKS
    // ════════════════════════════════════════
    if (obstacles.rocks?.rocks) {
      for (let index = 0; index < obstacles.rocks.rocks.length; index++) {
        const rockEntry = obstacles.rocks.rocks[index];
        if (rockEntry.x === undefined || rockEntry.z === undefined) continue;

        const dx = rockEntry.x - this.x;
        const dz = rockEntry.z - this.z;
        const dist = Math.hypot(dx, dz);
        
        // Use rock scale as collision radius (average of scales)
        const rockRadius = (rockEntry.scaleX + rockEntry.scaleY + rockEntry.scaleZ) / 3 * 0.85;
        const collisionThreshold = wagonRadius + rockRadius;

        if (dist < collisionThreshold) {
          registerContact(`rock-${index}`);
        }
      }
    }

    // ════════════════════════════════════════
    // Check PINE TREES
    // ════════════════════════════════════════
    if (obstacles.trees?.trees) {
      for (let index = 0; index < obstacles.trees.trees.length; index++) {
        const treeEntry = obstacles.trees.trees[index];
        if (!treeEntry.placed || treeEntry.x === undefined || treeEntry.z === undefined) continue;

        const dx = treeEntry.x - this.x;
        const dz = treeEntry.z - this.z;
        const dist = Math.hypot(dx, dz);
        
        // Use foliage radius for collision
        const treeRadius = treeEntry.foliageRadius || 6;
        const collisionThreshold = wagonRadius + treeRadius;

        if (dist < collisionThreshold) {
          registerContact(`tree-${index}`);
        }
      }
    }

    // ════════════════════════════════════════
    // Check BARN FENCE POSTS
    // ════════════════════════════════════════
    if (obstacles.barnFence?.fencePosts) {
      for (let index = 0; index < obstacles.barnFence.fencePosts.length; index++) {
        const post = obstacles.barnFence.fencePosts[index];
        if (post.x === undefined || post.z === undefined) continue;

        const dx = post.x - this.x;
        const dz = post.z - this.z;
        const dist = Math.hypot(dx, dz);
        
        // Post radius for collision
        const postRadius = obstacles.barnFence.postRadius || 0.35;
        const collisionThreshold = wagonRadius + postRadius + 0.5;

        if (dist < collisionThreshold) {
          registerContact(`fence-${index}`);
        }
      }
    }

    this.activeCollisionContacts = currentContacts;

    // ════════════════════════════════════════
    // BARN is SAFE - no damage
    // ════════════════════════════════════════
    // No damage from barn collision
  }

  updateTerrainAlignment(terrain, deltaTime = 0) {
    if (!terrain || typeof terrain.getTerrainNormalAt !== 'function') {
      this.terrainAlignmentMatrix = null;
      this.smoothedTerrainUp = null;
      this.smoothedTerrainForward = null;
      return;
    }

    const smoothingFactor = 1 - Math.exp(-this.terrainAlignmentSmoothing * Math.max(0, deltaTime));

    const sampleDistance = Math.max(2.0, this.bodyWidth * 0.5);
    const normal = terrain.getTerrainNormalAt(this.x, this.z, sampleDistance);
    const normalLength = Math.hypot(normal[0], normal[1], normal[2]) || 1;
    const targetUp = [normal[0] / normalLength, normal[1] / normalLength, normal[2] / normalLength];

    const headingForward = [Math.sin(this.heading), 0, Math.cos(this.heading)];
    const forwardProjection = headingForward[0] * targetUp[0] + headingForward[1] * targetUp[1] + headingForward[2] * targetUp[2];
    let forward = [
      headingForward[0] - targetUp[0] * forwardProjection,
      headingForward[1] - targetUp[1] * forwardProjection,
      headingForward[2] - targetUp[2] * forwardProjection,
    ];

    let forwardLength = Math.hypot(forward[0], forward[1], forward[2]);
    if (forwardLength < 1e-6) {
      forward = [0, 0, 1];
      const fallbackProjection = forward[0] * targetUp[0] + forward[1] * targetUp[1] + forward[2] * targetUp[2];
      forward = [
        forward[0] - targetUp[0] * fallbackProjection,
        forward[1] - targetUp[1] * fallbackProjection,
        forward[2] - targetUp[2] * fallbackProjection,
      ];
      forwardLength = Math.hypot(forward[0], forward[1], forward[2]);
    }

    if (forwardLength < 1e-6) {
      this.terrainAlignmentMatrix = null;
      return;
    }

    const targetForward = [forward[0] / forwardLength, forward[1] / forwardLength, forward[2] / forwardLength];

    if (!this.smoothedTerrainUp) {
      this.smoothedTerrainUp = targetUp;
    } else {
      this.smoothedTerrainUp = [
        this.smoothedTerrainUp[0] + (targetUp[0] - this.smoothedTerrainUp[0]) * smoothingFactor,
        this.smoothedTerrainUp[1] + (targetUp[1] - this.smoothedTerrainUp[1]) * smoothingFactor,
        this.smoothedTerrainUp[2] + (targetUp[2] - this.smoothedTerrainUp[2]) * smoothingFactor,
      ];
      const smoothedUpLength = Math.hypot(this.smoothedTerrainUp[0], this.smoothedTerrainUp[1], this.smoothedTerrainUp[2]) || 1;
      this.smoothedTerrainUp = [
        this.smoothedTerrainUp[0] / smoothedUpLength,
        this.smoothedTerrainUp[1] / smoothedUpLength,
        this.smoothedTerrainUp[2] / smoothedUpLength,
      ];
    }

    const currentForward = this.smoothedTerrainForward || targetForward;
    const currentProjection = currentForward[0] * this.smoothedTerrainUp[0] + currentForward[1] * this.smoothedTerrainUp[1] + currentForward[2] * this.smoothedTerrainUp[2];
    let projectedCurrentForward = [
      currentForward[0] - this.smoothedTerrainUp[0] * currentProjection,
      currentForward[1] - this.smoothedTerrainUp[1] * currentProjection,
      currentForward[2] - this.smoothedTerrainUp[2] * currentProjection,
    ];

    const targetProjection = targetForward[0] * this.smoothedTerrainUp[0] + targetForward[1] * this.smoothedTerrainUp[1] + targetForward[2] * this.smoothedTerrainUp[2];
    const projectedTargetForward = [
      targetForward[0] - this.smoothedTerrainUp[0] * targetProjection,
      targetForward[1] - this.smoothedTerrainUp[1] * targetProjection,
      targetForward[2] - this.smoothedTerrainUp[2] * targetProjection,
    ];

    const blendedForward = [
      projectedCurrentForward[0] + (projectedTargetForward[0] - projectedCurrentForward[0]) * smoothingFactor,
      projectedCurrentForward[1] + (projectedTargetForward[1] - projectedCurrentForward[1]) * smoothingFactor,
      projectedCurrentForward[2] + (projectedTargetForward[2] - projectedCurrentForward[2]) * smoothingFactor,
    ];

    let blendedForwardLength = Math.hypot(blendedForward[0], blendedForward[1], blendedForward[2]);
    if (blendedForwardLength < 1e-6) {
      this.terrainAlignmentMatrix = null;
      return;
    }

    this.smoothedTerrainForward = [
      blendedForward[0] / blendedForwardLength,
      blendedForward[1] / blendedForwardLength,
      blendedForward[2] / blendedForwardLength,
    ];

    let right = [
      this.smoothedTerrainForward[1] * this.smoothedTerrainUp[2] - this.smoothedTerrainForward[2] * this.smoothedTerrainUp[1],
      this.smoothedTerrainForward[2] * this.smoothedTerrainUp[0] - this.smoothedTerrainForward[0] * this.smoothedTerrainUp[2],
      this.smoothedTerrainForward[0] * this.smoothedTerrainUp[1] - this.smoothedTerrainForward[1] * this.smoothedTerrainUp[0],
    ];
    const rightLength = Math.hypot(right[0], right[1], right[2]);
    if (rightLength < 1e-6) {
      this.terrainAlignmentMatrix = null;
      return;
    }

    right = [right[0] / rightLength, right[1] / rightLength, right[2] / rightLength];

    forward = [
      this.smoothedTerrainUp[1] * right[2] - this.smoothedTerrainUp[2] * right[1],
      this.smoothedTerrainUp[2] * right[0] - this.smoothedTerrainUp[0] * right[2],
      this.smoothedTerrainUp[0] * right[1] - this.smoothedTerrainUp[1] * right[0],
    ];

    const forwardOutputLength = Math.hypot(forward[0], forward[1], forward[2]) || 1;
    forward = [forward[0] / forwardOutputLength, forward[1] / forwardOutputLength, forward[2] / forwardOutputLength];

    this.terrainAlignmentMatrix = new Float32Array([
      right[0], right[1], right[2], 0,
      this.smoothedTerrainUp[0], this.smoothedTerrainUp[1], this.smoothedTerrainUp[2], 0,
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
    if (steerable) this.scene.rotate(-this.steerAngle, 0, 1, 0);

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
    this.displayCarriedHayBales();

    this.scene.popMatrix();

    // Render horse in world-space so it can have independent heading and articulation
    if (this.horseModel) {
      this.scene.pushMatrix();
      this.scene.translate(this.horseX, this.horseY, this.horseZ);
      // rotate so model's forward aligns with heading convention (0 -> +Z)
      this.scene.rotate(this.horseHeading, 0, 1, 0);
      const s = this.horseModel.scale || 1.0;
      this.scene.scale(s, s, s);
      this.horseModel.display();
      this.scene.popMatrix();
    }
  }

  unloadModel() {
    // null heavy primitives and mark unloaded
    this.cube = null;
    this.axle = null;
    this.wheel = null;
    this.cover = null;
    this.woodMat = null;
    this.darkWoodMat = null;
    this.horseModel = null;
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

    this.horseModel = new MyOBJModel(this.scene, '/project/models/horse.obj', 1.7);

    this.metalMat = new CGFappearance(this.scene);
    this.metalMat.setAmbient(0.20, 0.20, 0.22, 1);
    this.metalMat.setDiffuse(0.40, 0.40, 0.45, 1);
    this.metalMat.setSpecular(0.55, 0.55, 0.60, 1);
    this.metalMat.setShininess(50);

    this._primitivesLoaded = true;
  }
}
