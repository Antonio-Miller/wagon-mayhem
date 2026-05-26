import { CGFscene, CGFcamera, CGFaxis } from "../../lib/CGF.js";
import { MyThirdPersonCamera } from "./MyThirdPersonCamera.js";
import { MySky } from "./environment/MySky.js";
import { MyClouds } from "./environment/MyClouds.js";
import { MyTerrain } from "./terrain/MyTerrain.js";
import { MyRockSet } from "./scatter/MyRockSet.js";
import { MyHayBaleRound } from "./entities/MyHayBaleRound.js";
import { MyHaySet } from "./scatter/MyHaySet.js";
import { MyPineTreeSet } from "./scatter/MyPineTreeSet.js";
import { MyGrass } from "./entities/MyGrass.js";
import { MyFlowerSet } from "./scatter/MyFlowerSet.js";
import { MyBarn } from "./entities/MyBarn.js";
import { MyBarnFence } from "./entities/MyBarnFence.js";
import { MyRollingBall } from "./entities/MyRollingBall.js";
import { MyPhysicsEngine } from "./physics/MyPhysicsEngine.js";
import { MyWagon } from "./entities/MyWagon.js";
import { GameState } from "./GameState.js";

/**
 * MyScene
 * @constructor
 */
export class MyScene extends CGFscene {
  constructor() {
    super();
    this.timeOfDay = 12;
    this.playerInput = {
      w: false,
      a: false,
      s: false,
      d: false,
      space: false,
    };
    this.wagonDoubleTapWindowMs = 300;
    this.wagonDriveState = {
      w: { pressed: false, lastReleaseTime: -Infinity, gear: 1 },
      s: { pressed: false, lastReleaseTime: -Infinity, gear: 1 },
    };
    // Active actor choice: 'Ball' or 'Wagon' (default: Wagon)
    this.actorChoice = 'Wagon';
    this._lastActorChoice = this.actorChoice;
    
    // Game state manager
    this.gameState = new GameState();
  }

  _switchActiveActor(prev, next) {
    if (prev === next) return;

    // Switching TO Ball: place ball at wagon's position
    if (next === 'Ball') {
      if (this.wagon && this.ballBody) {
        const x = this.wagon.x;
        const z = this.wagon.z;
        const y = this.terrain ? this.terrain.getHeightAt(x, z) + (this.ball?.radius || 0) : (this.ball?.radius || 0);
        this.ballBody.position[0] = x;
        this.ballBody.position[1] = y;
        this.ballBody.position[2] = z;
        this.ballBody.velocity[0] = 0;
        this.ballBody.velocity[1] = 0;
        this.ballBody.velocity[2] = 0;
        this.ballBody.active = true;
        this.ballBody.settled = true;
        this.ballLastPosition = vec3.clone(this.ballBody.position);
        // copy heading so camera aligns
        this.ballHeading = this.wagon.heading || 0;
      }
    }

    // Switching TO Wagon: place wagon at ball's position
    if (next === 'Wagon') {
      if (this.wagon && this.ballBody) {
        const x = this.ballBody.position[0];
        const z = this.ballBody.position[2];
        const y = this.terrain ? this.terrain.getHeightAt(x, z) : 0;
        this.wagon.x = x;
        this.wagon.z = z;
        this.wagon.y = y;
        this.wagon.heading = this.ballHeading || 0;
        // disable ball physics so it doesn't fall while wagon is active
        this.ballBody.velocity[0] = 0;
        this.ballBody.velocity[1] = 0;
        this.ballBody.velocity[2] = 0;
        this.ballBody.active = false;
        this.ballBody.settled = true;
      }
      if (this.keys) {
        this.keys.wagonForwardGear = 1;
        this.keys.wagonReverseGear = 1;
      }
      if (this.wagonDriveState) {
        this.wagonDriveState.w.gear = 1;
        this.wagonDriveState.s.gear = 1;
        this.wagonDriveState.w.pressed = false;
        this.wagonDriveState.s.pressed = false;
      }
    }
  }
  init(application) {
    super.init(application);
    
    this.initCameras();
    this.initLights();

    //Background color
    this.gl.clearColor(0.0, 0.0, 0.0, 1.0);

    this.gl.clearDepth(100.0);
    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.enable(this.gl.CULL_FACE);
    this.gl.depthFunc(this.gl.LEQUAL);

    //Initialize scene objects
    this.axis = new CGFaxis(this);
    this.sky = new MySky(this);
    this.clouds = new MyClouds(this);
    this.terrain = new MyTerrain(this);

    const halfW = 110;
    const halfD = 70;
    const pathWidth = 30;
    const pathCorners = [
      -halfW, -halfD,
      halfW, -halfD,
      halfW, halfD,
      -halfW, halfD,
    ];
    this.terrain.setPathUniforms(pathCorners, pathWidth / 2, [0.72, 0.54, 0.36], 0.92);

    this.barnAreaCenterX = 112.65;
    this.barnAreaCenterZ = -220.85;
    const barnAreaRadius = 90;
    const barnFenceRadius = 75;
    this.terrain.setCircularArea(
      this.barnAreaCenterX,
      this.barnAreaCenterZ,
      barnAreaRadius,
      [0.72, 0.54, 0.36],
      0.92,
      10.0
    );

    this.barn = new MyBarn(this, this.terrain, this.barnAreaCenterX, this.barnAreaCenterZ, 50, 52, 28, 50);

    // Create barn fence - fully closed
    const fenceOpenings = [];
    this.barnFence = new MyBarnFence(
      this,
      this.terrain,
      this.barnAreaCenterX,
      this.barnAreaCenterZ,
      barnFenceRadius,
      0.35, // post radius (thinner)
      4.2,  // post height
      6.5,  // post spacing
      fenceOpenings
    );

    this.grass = new MyGrass(this, this.terrain);
    this.rocks = new MyRockSet(this, 20, this.terrain);
    this.pineTrees = new MyPineTreeSet(this, 20, this.terrain);
    this.flowers = new MyFlowerSet(this, 80, this.terrain, this.rocks, this.pineTrees);
    this.physics = new MyPhysicsEngine(this, {
      gravity: -24.0,
      terminalVelocity: -90.0,
    });
    this.registerPhysicsBodies();
    this.initPlayerBall();
    this.wagon = new MyWagon(this, this.gameState);
    // Ensure wagon initially spawns at the ball coords
    if (this.ballBody && this.wagon) {
      this.wagon.x = this.ballBody.position[0];
      this.wagon.z = this.ballBody.position[2];
      this.wagon.y = this.terrain ? this.terrain.getHeightAt(this.wagon.x, this.wagon.z) : 0;
    }
    // If default actor is Wagon, ensure ball physics is disabled so wagon is the active one
    if (this.actorChoice === 'Wagon' && this.ballBody) {
      this._switchActiveActor('Ball', 'Wagon');
      this._lastActorChoice = this.actorChoice;
    }
    this.lastUpdateTime = 0;
    this.cameraDebugEnabled = false;
    this.cameraDebugIntervalMs = 500;
    this.lastCameraDebugLogTime = 0;

    this.setUpdatePeriod(16);

    // Load OBJ hay entities and position them near the terrain center
    try {
      this.circleHayModel = new MyHayBaleRound(this, 8.0);
      // create a scattered set of 8 hay bales, avoiding rocks and trees
      this.haySet = new MyHaySet(this, 8, this.terrain, this.rocks, this.pineTrees);
      // Register hay physics bodies now that haySet exists (avoid re-registering other bodies)
      if (this.physics && Array.isArray(this.haySet?.hay)) {
        for (const hay of this.haySet.hay) {
          const body = this.physics.registerBody({
            position: vec3.fromValues(hay.x, 100 + Math.random() * 50, hay.z),
            velocity: vec3.fromValues(0, 0, 0),
            gravityScale: 1,
            groundHeightFn: () => {
              if (this.terrain?.getHeightAt) {
                const terrainY = this.terrain.getHeightAt(hay.x, hay.z);
                return terrainY + 1.0;
              }
              return 0;
            },
            onStep: (body) => {
              hay.y = body.position[1];
            },
          });

          if (hay.bale && typeof hay.bale.setPhysicsBody === 'function') {
            hay.bale.setPhysicsBody(body);
          }
        }
      }
    } catch (e) {
      console.warn('MyScene: failed to load hay entities', e);
      this.haySet = null;
    }

    // Keyboard state — written by MyInterface, read by wagon.update()
    this.keys = {};

    // Objects connected to MyInterface
    this.displayAxis = true;
    this.sunEnabled = true;
    // Active actor shown via `actorChoice` (GUI added in MyInterface)
    this.actorChoice = this.actorChoice || 'Wagon';
  }
  computeSkyFromTime() {
    const t = this.timeOfDay % 24;
    let ambient = [0.72, 0.8, 0.9, 1.0];
    let clear = [0.72, 0.8, 0.9, 1.0];

    if (t >= 6 && t < 9) {
      const phase = (t - 6) / 3;
      ambient = [0.22 * (1 - phase) + 0.72 * phase, 0.2 * (1 - phase) + 0.8 * phase, 0.28 * (1 - phase) + 0.9 * phase, 1.0];
      clear = [0.2 * (1 - phase) + 0.72 * phase, 0.16 * (1 - phase) + 0.8 * phase, 0.24 * (1 - phase) + 0.9 * phase, 1.0];
    } else if (t >= 9 && t < 17) {
      // Daytime now ends at 17:00 so sunset starts at 17:00
      ambient = [0.72, 0.8, 0.9, 1.0];
      clear = [0.72, 0.8, 0.9, 1.0];
    } else if (t >= 17 && t < 21) {
      // Sunset spans 17:00 - 21:00 (4-hour transition)
      const phase = (t - 17) / 4;
      ambient = [0.72 * (1 - phase) + 0.9 * phase, 0.8 * (1 - phase) + 0.5 * phase, 0.9 * (1 - phase) + 0.25 * phase, 1.0];
      clear = [0.72 * (1 - phase) + 0.9 * phase, 0.8 * (1 - phase) + 0.5 * phase, 0.9 * (1 - phase) + 0.25 * phase, 1.0];
    } else {
      ambient = [0.05, 0.05, 0.1, 1.0];
      clear = [0.05, 0.05, 0.1, 1.0];
    }

    return { ambient, clear };
  }
  initLights() {
    // Sun light: directional (w=0), warm color, high-angle direction
    this.lights[0].setPosition(40, 80, 20, 0);
    this.lights[0].setAmbient(0.05, 0.045, 0.035, 1.0);
    this.lights[0].setDiffuse(0.9, 0.85, 0.7, 1.0);
    this.lights[0].setSpecular(0.9, 0.85, 0.7, 1.0);
    this.lights[0].setVisible(false);
    this.lights[0].enable();
    this.lights[0].update();
  }
  initCameras() {
    this.camera = new MyThirdPersonCamera(
      0.4,
      0.1,
      1000,
      vec3.fromValues(0, 10, -18),
      vec3.fromValues(0, 0, 0)
    );
    this.domeRadius = 295; // Keep camera within dome (radius 200 with margin)
    this.terrainMinHeight = 25; // Keep camera above terrain peaks
  }

  cycleCameraMode() {
    if (!this.cameraModes || !Array.isArray(this.cameraModes)) return;
    this.cameraModeIndex = (this.cameraModeIndex + 1) % this.cameraModes.length;
    this.setCameraMode(this.cameraModes[this.cameraModeIndex]);
  }

  setCameraMode(mode) {
    this.cameraMode = mode;
    // Apply immediate camera parameter changes for non-first modes
    if (mode === 'third') {
      this.camera.followDistance = 18;
      this.camera.followHeight = 6;
      this.camera.lookHeight = 2.5;
      this.camera.smoothing = 0.18;
    } else if (mode === 'far') {
      this.camera.followDistance = 32;
      this.camera.followHeight = 8;
      this.camera.lookHeight = 3.0;
      this.camera.smoothing = 0.14;
    } else if (mode === 'first') {
      // first-person will be handled by the scene every frame (lock to ball)
      this.camera.smoothing = 1.0;
    }
  }
  setDefaultAppearance() {
    // Keep scene material mostly neutral so sun color tint is visible.
    this.setAmbient(0.5, 0.5, 0.5, 1.0);
    this.setDiffuse(0.7, 0.7, 0.7, 1.0);
    this.setSpecular(0.15, 0.15, 0.15, 1.0);
    this.setShininess(10.0);
  }
  
  constrainCameraToDome() {

    // Constrain camera position to stay within dome radius
    const pos = this.camera.position;
    const dist = Math.sqrt(pos[0] * pos[0] + pos[1] * pos[1] + pos[2] * pos[2]);
    
    if (dist > this.domeRadius) {
      const scale = this.domeRadius / dist;
      pos[0] *= scale;
      pos[1] *= scale;
      pos[2] *= scale;
    }
  }

  constrainCameraAboveTerrain() {
    // Keep the camera above the terrain so it never moves underground.
    const pos = this.camera.position;
    
    // Sample the exact terrain height at the camera's XZ position, and add a small padding (h+5)
    let minH = this.terrain ? this.terrain.getHeightAt(pos[0], pos[2]) + 5 : this.terrainMinHeight;

    if (pos[1] < minH) {
      pos[1] = minH;
    }
  }

  getCameraGroundHeight() {
    if (this.terrain) {
      return this.terrain.getHeightAt(this.camera.position[0], this.camera.position[2]) + 5;
    }

    return this.terrainMinHeight;
  }

  registerPhysicsBodies() {
    if (!this.physics) {
      return;
    }

    const registerSet = (entries, getGroundHeight, syncY) => {
      if (!Array.isArray(entries)) {
        return;
      }

      for (const entry of entries) {
        const body = this.physics.registerBody({
          position: vec3.fromValues(entry.x, entry.y, entry.z),
          velocity: vec3.fromValues(0, 0, 0),
          gravityScale: 1,
          groundHeightFn: () => getGroundHeight(entry),
          beforeStep: () => {
            if (entry.placed && typeof entry.y === 'number') {
              body.position[1] = entry.y;
            }
          },
          onStep: () => {
            syncY(entry, body.position[1]);
          },
        });

        syncY(entry, body.position[1]);
      }
    };

    registerSet(
      this.rocks?.rocks,
      (rock) => {
        if (this.terrain?.getHeightAt) {
          return this.terrain.getHeightAt(rock.x, rock.z) - (rock.scaleY * 0.4);
        }

        return rock.y;
      },
      (rock, y) => {
        rock.y = y;
      }
    );

    registerSet(
      this.pineTrees?.trees,
      (tree) => {
        if (this.terrain?.getHeightAt) {
          return this.terrain.getHeightAt(tree.x, tree.z);
        }

        return tree.y;
      },
      (tree, y) => {
        tree.y = y;
      }
    );

    registerSet(
      this.flowers?.flowers,
      (flower) => {
        if (this.terrain?.getHeightAt) {
          return this.terrain.getHeightAt(flower.x, flower.z) + 0.02;
        }

        return flower.y;
      },
      (flower, y) => {
        flower.y = y;
      }
    );

      // Register hay bales with special handling: allow gravity to work without position locking
      if (Array.isArray(this.haySet?.hay)) {
        for (const hay of this.haySet.hay) {
          const body = this.physics.registerBody({
            position: vec3.fromValues(hay.x, 100 + Math.random() * 50, hay.z), // Start above terrain so gravity brings them down
            velocity: vec3.fromValues(0, 0, 0),
            gravityScale: 1,
            groundHeightFn: () => {
              if (this.terrain?.getHeightAt) {
                const terrainY = this.terrain.getHeightAt(hay.x, hay.z);
                return terrainY + 1.0;
              }
              return 0;
            },
            onStep: (body) => {
              hay.y = body.position[1];
            },
          });

          // Attach the physics body to the bale model so the model handles rendering/collision
          if (hay.bale && typeof hay.bale.setPhysicsBody === 'function') {
            hay.bale.setPhysicsBody(body);
          }
        }
      }
    if (this.barn) {
      this.physics.registerBody({
        name: 'barn',
        position: vec3.fromValues(this.barn.positionX, this.barn.positionY ?? 0, this.barn.positionZ),
        velocity: vec3.fromValues(0, 0, 0),
        gravityScale: 1,
        groundHeightFn: () => {
          if (this.terrain?.getHeightAt) {
            return this.terrain.getHeightAt(this.barn.positionX, this.barn.positionZ) - this.barn.groundSink - 10;
          }

          return this.barn.positionY ?? 0;
        },
        onStep: (body) => {
          this.barn.positionY = body.position[1];
        },
      });
    }

    if (this.barnFence?.fencePosts) {
      for (const post of this.barnFence.fencePosts) {
        const body = this.physics.registerBody({
          position: vec3.fromValues(post.x, post.y ?? 0, post.z),
          velocity: vec3.fromValues(0, 0, 0),
          gravityScale: 1,
          groundHeightFn: () => this.barnFence.getTerrainHeight(post.x, post.z),
          onStep: () => {
            post.y = body.position[1];
          },
        });

        post.y = body.position[1];
      }
    }
  }

  initPlayerBall() {
    this.ball = new MyRollingBall(this, 1.4);
    const startX = 116.22;
    const startY = 54.88;
    const startZ = -175.48;

    this.ballBody = this.physics.registerBody({
      name: 'playerBall',
      position: vec3.fromValues(startX, startY, startZ),
      velocity: vec3.fromValues(0, 0, 0),
      gravityScale: 1,
      groundHeightFn: (position) => {
        if (this.terrain?.getHeightAt) {
          return this.terrain.getHeightAt(position[0], position[2]) + this.ball.radius;
        }

        return this.ball.radius;
      },
      onGround: (body) => {
        body.velocity[1] = 0;
      },
    });

    this.ball.setPhysicsBody(this.ballBody);
    this.ballHeading = 0;
    this.ballSpeed = 0;
    this.ballDriveCharge = 0;
    this.ballMaxSpeed = 7.5;
    this.ballMaxSprintBonus = 9.5;
    this.ballAcceleration = 18.0;
    this.ballFriction = 4.5;
    this.ballBrake = 11.0;
    this.ballTurnRate = 1.7;
    this.ballJumpImpulseMin = 9.0;
    this.ballJumpImpulseMax = 20.0;
    this.jumpChargeTime = 0;
    this.spaceWasPressed = false;
    this.ballLastPosition = vec3.clone(this.ballBody.position);
    this.ballBody.velocity[1] = 0;
    this.ballBody.settled = true;

    // Camera modes: third (default), far, first-person
    this.cameraModes = ['third', 'far', 'first'];
    this.cameraModeIndex = 0;
    this.setCameraMode(this.cameraModes[this.cameraModeIndex]);

    this.camera.follow(this.ballBody.position, this.ballHeading, { smoothing: 1.0 });
  }

  constrainBallPosition(body) {
    if (!body) return;

    let hitFenceRail = false; // flag to apply friction if hitting fence

    // Dome boundary (horizontal plane only)
    const bx = body.position[0];
    const bz = body.position[2];
    const horizDist = Math.sqrt(bx * bx + bz * bz);
    const maxHoriz = Math.max(10, this.domeRadius - (this.ball?.radius ?? 1.0));
    if (horizDist > maxHoriz) {
      const scale = maxHoriz / horizDist;
      body.position[0] = bx * scale;
      body.position[2] = bz * scale;
      body.velocity[0] = 0;
      body.velocity[2] = 0;
    }

    // Rocks collision: treat rocks as spheres (radius plus ball radius)
    if (this.rocks && Array.isArray(this.rocks.rocks)) {
      for (const rock of this.rocks.rocks) {
        if (!rock.placed) continue;
        const dx = body.position[0] - rock.x;
        const dy = body.position[1] - rock.y;
        const dz = body.position[2] - rock.z;
        const dist2 = dx * dx + dy * dy + dz * dz;
        // rock primitive is a unit sphere scaled by scaleX/Y/Z
        const rockRadius = Math.max(rock.scaleX, rock.scaleY, rock.scaleZ) * 1.0;
        const clashRadius = rockRadius;
        if (dist2 > 0 && dist2 < clashRadius * clashRadius) {
          const dist = Math.sqrt(dist2) || 0.0001;
          const push = (clashRadius - dist) / dist;
          body.position[0] += dx * push;
          body.position[1] += dy * push;
          body.position[2] += dz * push;
          body.velocity[0] = 0;
          body.velocity[2] = 0;
        }
      }
    }

    // Trees collision: check trunk and foliage separately
    if (this.pineTrees && Array.isArray(this.pineTrees.trees)) {
      for (const tree of this.pineTrees.trees) {
        if (!tree.placed) continue;
        const trunkHeight = tree.tree.trunkHeight;
        const foliageHeight = tree.tree.foliageHeight;
        const foliageTop = tree.y + trunkHeight + foliageHeight * 1.92;
        const trunkTop = tree.y + trunkHeight;

        // Check trunk collision (solid cylinder)
        if (body.position[1] >= tree.y - 0.1 && body.position[1] <= trunkTop + 0.1) {
          const dx = body.position[0] - tree.x;
          const dz = body.position[2] - tree.z;
          const dist2 = dx * dx + dz * dz;
          const trunkCollisionRadius = tree.tree.trunkRadius + (this.ball?.radius ?? 1.0);
          if (dist2 > 0 && dist2 < trunkCollisionRadius * trunkCollisionRadius) {
            const dist = Math.sqrt(dist2) || 0.0001;
            const push = (trunkCollisionRadius - dist) / dist;
            body.position[0] += dx * push;
            body.position[2] += dz * push;
            body.velocity[0] = 0;
            body.velocity[2] = 0;
            continue;
          }
        }

        // Check foliage collision (cone-based)
        if (body.position[1] < trunkTop || body.position[1] > foliageTop) continue;

        const dx = body.position[0] - tree.x;
        const dy = body.position[1] - (tree.y + trunkHeight * 0.5);
        const dz = body.position[2] - tree.z;
        const dist2 = dx * dx + dy * dy + dz * dz;
        // approximate foliage collision radius
        const collisionRadius = Math.max(tree.tree.trunkRadius, tree.tree.foliageRadius) * 1.02 + (this.ball?.radius ?? 1.0);
        if (dist2 > 0 && dist2 < collisionRadius * collisionRadius) {
          const dist = Math.sqrt(dist2) || 0.0001;
          const push = (collisionRadius - dist) / dist;
          body.position[0] += dx * push;
          body.position[1] += dy * push;
          body.position[2] += dz * push;
          body.velocity[0] = 0;
          body.velocity[2] = 0;
        }
      }
    }

    // Barn collision (axis-aligned box)
    if (this.barn) {
      const halfWidth = this.barn.width / 2 + (this.ball?.radius ?? 1.0) + Math.max(this.barn.width, this.barn.depth) * 0.02;
      const halfDepth = this.barn.depth / 2 + (this.ball?.radius ?? 1.0) + Math.max(this.barn.width, this.barn.depth) * 0.02;
      const minX = this.barn.positionX - halfWidth;
      const maxX = this.barn.positionX + halfWidth;
      const minZ = this.barn.positionZ - halfDepth;
      const maxZ = this.barn.positionZ + halfDepth;
      const baseY = this.barn.positionY ?? (this.terrain ? this.terrain.getHeightAt(this.barn.positionX, this.barn.positionZ) : 0);
      const topY = baseY + (this.barn.bodyTotalHeight ?? (this.barn.bodyHeight || 20)) + (this.barn.roofHeight || 6);

      // Only collide if ball is within vertical overlap of the barn
      if (body.position[1] >= baseY - 0.1 && body.position[1] <= topY + 0.1) {
        if (body.position[0] >= minX && body.position[0] <= maxX && body.position[2] >= minZ && body.position[2] <= maxZ) {
          // push out along nearest axis
          const distLeft = body.position[0] - minX;
          const distRight = maxX - body.position[0];
          const distFront = body.position[2] - minZ;
          const distBack = maxZ - body.position[2];
          const minDist = Math.min(distLeft, distRight, distFront, distBack);
          if (minDist === distLeft) body.position[0] = minX;
          else if (minDist === distRight) body.position[0] = maxX;
          else if (minDist === distFront) body.position[2] = minZ;
          else body.position[2] = maxZ;
          body.velocity[0] = 0;
          body.velocity[2] = 0;
        }
      }
    }

    // Barn fence posts (treat as small cylinders)
    if (this.barnFence && Array.isArray(this.barnFence.fencePosts)) {
      for (const post of this.barnFence.fencePosts) {
        const postBaseY = post.y ?? this.barnFence.getTerrainHeight(post.x, post.z);
        const postTopY = postBaseY + (this.barnFence.postHeight ?? 4.2);
        // only collide if ball is within vertical span of the post
        if (body.position[1] < postBaseY - 0.1 || body.position[1] > postTopY + 0.1) continue;

        const dx = body.position[0] - post.x;
        const dz = body.position[2] - post.z;
        const dist2 = dx * dx + dz * dz;
        const radius = (this.barnFence.postRadius ?? 0.35) + (this.ball?.radius ?? 1.0);
        if (dist2 > 0 && dist2 < radius * radius) {
          const dist = Math.sqrt(dist2) || 0.0001;
          const push = (radius - dist) / dist;
          body.position[0] += dx * push;
          body.position[2] += dz * push;
          body.velocity[0] = 0;
          body.velocity[2] = 0;
        }
      }
    }

    // Barn fence horizontal rails (connecting cylinders between posts)
    if (this.barnFence && Array.isArray(this.barnFence.fencePosts)) {
      const postCount = this.barnFence.fencePosts.length;
      if (postCount < 2) return; // need at least 2 posts for a rail

      const baseHeight = this.barnFence.baseHeight ?? 0.15;
      const postHeight = this.barnFence.postHeight ?? 4.2;
      const horizRadius = this.barnFence.horizontalRadius ?? 0.15;
      const ballRadius = this.ball?.radius ?? 1.0;
      const collisionRadiusH = horizRadius + ballRadius;

      for (let i = 0; i < postCount; i++) {
        const post = this.barnFence.fencePosts[i];
        const nextPost = this.barnFence.fencePosts[(i + 1) % postCount];

        // Check if posts are consecutive (not across an opening)
        let isConsecutive = true;
        if (this.barnFence.fullPostCount && post.index !== undefined && nextPost.index !== undefined) {
          isConsecutive = ((post.index + 1) % this.barnFence.fullPostCount) === nextPost.index;
        }
        if (!isConsecutive) continue;

        const postBaseY = post.y ?? this.barnFence.getTerrainHeight(post.x, post.z);
        const nextPostBaseY = nextPost.y ?? this.barnFence.getTerrainHeight(nextPost.x, nextPost.z);
        const avgBaseY = (postBaseY + nextPostBaseY) * 0.5;

        // Two horizontal rails at fixed positions
        const railHeights = [
          avgBaseY + baseHeight + postHeight * 0.55, // lower rail
          avgBaseY + baseHeight + postHeight * 0.86,  // upper rail
        ];

        for (const railHeight of railHeights) {
          // Skip if ball is far from the rail height
          const railDist = Math.abs(body.position[1] - railHeight);
          if (railDist > 1.5) continue;

          // Line segment from post to nextPost at railHeight
          const p1x = post.x;
          const p1z = post.z;
          const p2x = nextPost.x;
          const p2z = nextPost.z;
          const ballX = body.position[0];
          const ballY = body.position[1];
          const ballZ = body.position[2];

          const dx = p2x - p1x;
          const dz = p2z - p1z;
          const lenSq = dx * dx + dz * dz;

          if (lenSq < 0.001) continue; // degenerate segment

          // Project ball onto segment (in XZ plane)
          const toBalX = ballX - p1x;
          const toBalZ = ballZ - p1z;
          const t = Math.max(0, Math.min(1, (toBalX * dx + toBalZ * dz) / lenSq));

          // Closest point on segment
          const closestX = p1x + t * dx;
          const closestZ = p1z + t * dz;
          const closestY = railHeight; // rail is at fixed height

          // 3D distance from ball to closest point on rail
          const distX = ballX - closestX;
          const distY = ballY - closestY;
          const distZ = ballZ - closestZ;
          const dist2 = distX * distX + distY * distY + distZ * distZ;

          if (dist2 < collisionRadiusH * collisionRadiusH && dist2 > 0.001) {
            const dist = Math.sqrt(dist2);
            const push = (collisionRadiusH - dist) / dist * 1.1; // 1.1 factor to ensure separation
            body.position[0] += distX * push;
            body.position[1] += distY * push;
            body.position[2] += distZ * push;
            body.velocity[0] = 0;
            body.velocity[2] = 0;
            hitFenceRail = true; // flag collision with horizontal rail
          }
        }
      }
    }

    // Apply friction if ball hit a fence rail to prevent forcing through
    if (hitFenceRail && this.ballSpeed !== undefined) {
      this.ballSpeed = Math.max(0, this.ballSpeed * 0.5); // reduce speed by half on rail collision
    }

    // Apply friction if ball hit a fence rail to prevent forcing through
    if (hitFenceRail && this.ballSpeed !== undefined) {
      this.ballSpeed = Math.max(0, this.ballSpeed * 0.5); // reduce speed by half on rail collision
    }

    // Terrain collision: ensure ball stays above terrain surface
    if (this.terrain && typeof this.terrain.getHeightAt === 'function') {
      const terrainHeight = this.terrain.getHeightAt(body.position[0], body.position[2]);
      const minY = terrainHeight + (this.ball?.radius ?? 1.0);
      if (body.position[1] < minY) {
        body.position[1] = minY;
        body.velocity[1] = 0; // stop downward velocity when hitting terrain
      }
    }
  }

  constrainWagonPosition(wagon) {
    if (!wagon) return;

    const halfWidth = (wagon.bodyWidth ?? 6.0) * 0.5;
    const halfLength = (wagon.bodyLength ?? 12.0) * 0.5;
    const wagonRadius = Math.hypot(halfWidth, halfLength);
    const wagonBaseY = wagon.y ?? (this.terrain ? this.terrain.getHeightAt(wagon.x, wagon.z) : 0);
    const wagonHeight = (wagon.floorY ?? 1.6) + (wagon.floorThick ?? 0.2) + (wagon.wallHeight ?? 2.0) + (wagon.wheelRadius ?? 1.8) * 1.7;
    const wagonTopY = wagonBaseY + wagonHeight;

    let wx = wagon.x;
    let wz = wagon.z;

    const syncPose = () => {
      wx = wagon.x;
      wz = wagon.z;
    };

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    const moveAwayFromPoint = (centerX, centerZ, obstacleRadius) => {
      const dx = wx - centerX;
      const dz = wz - centerZ;
      const distance = Math.hypot(dx, dz);
      const minDistance = wagonRadius + obstacleRadius;

      if (distance >= minDistance) {
        return false;
      }

      if (distance < 1e-6) {
        const fallbackX = Math.abs(wx) > Math.abs(wz) ? Math.sign(wx || 1) : 0;
        const fallbackZ = fallbackX === 0 ? Math.sign(wz || 1) || 1 : 0;
        wagon.x += fallbackX * minDistance;
        wagon.z += fallbackZ * minDistance;
      } else {
        const push = (minDistance - distance) / distance;
        wagon.x += dx * push;
        wagon.z += dz * push;
      }

      wagon.speed = 0;
      syncPose();
      return true;
    };

    const moveAwayFromSegment = (x1, z1, x2, z2, obstacleRadius) => {
      const segDx = x2 - x1;
      const segDz = z2 - z1;
      const lenSq = segDx * segDx + segDz * segDz;

      if (lenSq < 1e-6) {
        return moveAwayFromPoint(x1, z1, obstacleRadius);
      }

      const t = clamp(((wx - x1) * segDx + (wz - z1) * segDz) / lenSq, 0, 1);
      const closestX = x1 + t * segDx;
      const closestZ = z1 + t * segDz;
      return moveAwayFromPoint(closestX, closestZ, obstacleRadius);
    };

    const horizDist = Math.sqrt(wx * wx + wz * wz);
    const maxHoriz = Math.max(10, this.domeRadius - wagonRadius);
    if (horizDist > maxHoriz) {
      const scale = maxHoriz / horizDist;
      wagon.x = wx * scale;
      wagon.z = wz * scale;
      wagon.speed = 0;
      syncPose();
    }

    if (this.rocks && Array.isArray(this.rocks.rocks)) {
      for (const rock of this.rocks.rocks) {
        if (!rock.placed) continue;
        const rockRadius = Math.max(rock.scaleX, rock.scaleY, rock.scaleZ) * 1.0;

        const rockBottomY = rock.y - rockRadius;
        const rockTopY = rock.y + rockRadius;
        if (wagonTopY < rockBottomY || wagonBaseY > rockTopY) continue;

        moveAwayFromPoint(rock.x, rock.z, rockRadius);
      }
    }

    if (this.pineTrees && Array.isArray(this.pineTrees.trees)) {
      for (const tree of this.pineTrees.trees) {
        if (!tree.placed) continue;

        const trunkBaseY = tree.y;
        const trunkTop = tree.y + tree.tree.trunkHeight;
        const foliageTop = tree.y + tree.tree.trunkHeight + tree.tree.foliageHeight * 1.92;
        if (wagonTopY < trunkBaseY || wagonBaseY > foliageTop) continue;

        if (wagonBaseY <= trunkTop && wagonTopY >= trunkBaseY) {
          moveAwayFromPoint(tree.x, tree.z, tree.tree.trunkRadius);
        }

        const sampleHeights = [
          wagonBaseY + wagonHeight * 0.25,
          wagonBaseY + wagonHeight * 0.55,
          wagonTopY,
        ];

        const checkCrown = (baseY, height, radius) => {
          for (const sampleY of sampleHeights) {
            const localY = sampleY - baseY;
            if (localY < 0 || localY > height) {
              continue;
            }

            const radiusAtHeight = radius * (1 - localY / height);
            if (moveAwayFromPoint(tree.x, tree.z, radiusAtHeight)) {
              return true;
            }
          }

          return false;
        };

        checkCrown(
          tree.y + tree.tree.trunkHeight,
          tree.tree.foliageHeight,
          tree.tree.foliageRadius
        );

        checkCrown(
          tree.y + tree.tree.trunkHeight + tree.tree.foliageHeight * 0.92,
          tree.tree.foliageHeight * 0.72,
          tree.tree.foliageRadius * 0.72
        );
      }
    }

    if (this.barn) {
      const halfBarnWidth = this.barn.width / 2 + halfWidth + Math.max(this.barn.width, this.barn.depth) * 0.02;
      const halfDepth = this.barn.depth / 2 + halfLength + Math.max(this.barn.width, this.barn.depth) * 0.02;
      const minX = this.barn.positionX - halfBarnWidth;
      const maxX = this.barn.positionX + halfBarnWidth;
      const minZ = this.barn.positionZ - halfDepth;
      const maxZ = this.barn.positionZ + halfDepth;
      const baseY = this.barn.positionY ?? (this.terrain ? this.terrain.getHeightAt(this.barn.positionX, this.barn.positionZ) : 0);
      const topY = baseY + (this.barn.bodyTotalHeight ?? (this.barn.bodyHeight || 20)) + (this.barn.roofHeight || 6);

      if (wagonTopY >= baseY - 1 && wagonBaseY <= topY + 1) {
        if (wagon.x >= minX && wagon.x <= maxX && wagon.z >= minZ && wagon.z <= maxZ) {
          const distLeft = wagon.x - minX;
          const distRight = maxX - wagon.x;
          const distFront = wagon.z - minZ;
          const distBack = maxZ - wagon.z;
          const minDist = Math.min(distLeft, distRight, distFront, distBack);
          if (minDist === distLeft) wagon.x = minX;
          else if (minDist === distRight) wagon.x = maxX;
          else if (minDist === distFront) wagon.z = minZ;
          else wagon.z = maxZ;
          wagon.speed = 0;
          syncPose();
        }
      }
    }

    if (this.barnFence && Array.isArray(this.barnFence.fencePosts)) {
      for (const post of this.barnFence.fencePosts) {
        const postBaseY = post.y ?? this.barnFence.getTerrainHeight(post.x, post.z);
        const postTopY = postBaseY + (this.barnFence.postHeight ?? 4.2);

        if (wagonTopY < postBaseY - 1 || wagonBaseY > postTopY + 1) continue;

        moveAwayFromPoint(post.x, post.z, this.barnFence.postRadius ?? 0.35);
      }

      const postCount = this.barnFence.fencePosts.length;
      if (postCount >= 2) {
        const horizRadius = this.barnFence.horizontalRadius ?? 0.15;

        for (let i = 0; i < postCount; i++) {
          const post = this.barnFence.fencePosts[i];
          const nextPost = this.barnFence.fencePosts[(i + 1) % postCount];

          let isConsecutive = true;
          if (this.barnFence.fullPostCount && post.index !== undefined && nextPost.index !== undefined) {
            isConsecutive = ((post.index + 1) % this.barnFence.fullPostCount) === nextPost.index;
          }
          if (!isConsecutive) continue;

          const postBaseY = post.y ?? this.barnFence.getTerrainHeight(post.x, post.z);
          const nextPostBaseY = nextPost.y ?? this.barnFence.getTerrainHeight(nextPost.x, nextPost.z);
          const avgBaseY = (postBaseY + nextPostBaseY) * 0.5;
          const railHeights = [
            avgBaseY + (this.barnFence.baseHeight ?? 0.15) + (this.barnFence.postHeight ?? 4.2) * 0.55,
            avgBaseY + (this.barnFence.baseHeight ?? 0.15) + (this.barnFence.postHeight ?? 4.2) * 0.86,
          ];

          for (const railHeight of railHeights) {
            const p1x = post.x;
            const p1z = post.z;
            const p2x = nextPost.x;
            const p2z = nextPost.z;
            if (wagonTopY < railHeight - horizRadius || wagonBaseY > railHeight + horizRadius) continue;

            const dx = p2x - p1x;
            const dz = p2z - p1z;
            const lenSq = dx * dx + dz * dz;
            if (lenSq < 0.001) continue;

            const toBalX = wx - p1x;
            const toBalZ = wz - p1z;
            const t = Math.max(0, Math.min(1, (toBalX * dx + toBalZ * dz) / lenSq));
            const closestX = p1x + t * dx;
            const closestZ = p1z + t * dz;

            moveAwayFromSegment(p1x, p1z, p2x, p2z, horizRadius);
          }
        }
      }
    }

    if (this.terrain && typeof this.terrain.getHeightAt === 'function') {
      const terrainHeight = this.terrain.getHeightAt(wagon.x, wagon.z);
      if ((wagon.y ?? 0) < terrainHeight) {
        wagon.y = terrainHeight;
      }
    }
  }

  getControlKey(event) {
    if (!event) {
      return '';
    }

    const key = event.key ? event.key.toLowerCase() : '';
    if (key === ' ' || event.code === 'Space') {
      return 'space';
    }

    if (['w', 'a', 's', 'd'].includes(key)) {
      return key;
    }

    return '';
  }

  getEventTimestamp(event) {
    if (event && Number.isFinite(event.timeStamp)) {
      return event.timeStamp;
    }

    return Date.now();
  }

  updateWagonDriveState(direction, isDown, event) {
    if (!this.wagonDriveState || !this.keys) {
      return;
    }

    const state = this.wagonDriveState[direction];
    if (!state) {
      return;
    }

    const now = this.getEventTimestamp(event);

    if (isDown) {
      if (!state.pressed) {
        state.gear = (now - state.lastReleaseTime <= this.wagonDoubleTapWindowMs) ? 2 : 1;
        state.pressed = true;
      }
    } else {
      state.pressed = false;
      state.lastReleaseTime = now;
      state.gear = 1;
    }

    if (direction === 'w') {
      this.keys.wagonForwardGear = state.gear;
    } else if (direction === 's') {
      this.keys.wagonReverseGear = state.gear;
    }
  }

  handleControlKeyDown(event) {
    const key = this.getControlKey(event);
    if (!key) {
      return;
    }

    if (key === 'w') {
      this.playerInput.w = true;
      this.updateWagonDriveState('w', true, event);
    } else if (key === 'a') {
      this.playerInput.a = true;
    } else if (key === 's') {
      this.playerInput.s = true;
      this.updateWagonDriveState('s', true, event);
    } else if (key === 'd') {
      this.playerInput.d = true;
    } else if (key === 'space') {
      this.playerInput.space = true;
      // Start charging jump (don't apply immediately)
    }
  }

  handleControlKeyUp(event) {
    const key = this.getControlKey(event);
    if (!key) {
      return;
    }

    if (key === 'w') {
      this.playerInput.w = false;
      this.updateWagonDriveState('w', false, event);
    } else if (key === 'a') {
      this.playerInput.a = false;
    } else if (key === 's') {
      this.playerInput.s = false;
      this.updateWagonDriveState('s', false, event);
    } else if (key === 'd') {
      this.playerInput.d = false;
    } else if (key === 'space') {
      this.playerInput.space = false;
      // Mark space as released; jump will be triggered in updatePlayerBallControl
    }
  }

  updatePlayerBallControl(deltaTime) {
    if (!this.ballBody) {
      return;
    }

    if (this.playerInput.w) {
      this.ballDriveCharge = Math.min(1, this.ballDriveCharge + deltaTime * 0.45);
      this.ballSpeed = Math.min(
        this.ballSpeed + this.ballAcceleration * deltaTime,
        this.ballMaxSpeed + this.ballMaxSprintBonus * this.ballDriveCharge
      );
    } else {
      this.ballDriveCharge = Math.max(0, this.ballDriveCharge - deltaTime * 0.2);
      this.ballSpeed = Math.max(0, this.ballSpeed - this.ballFriction * deltaTime);
    }

    if (this.playerInput.s) {
      this.ballSpeed = Math.max(0, this.ballSpeed - this.ballBrake * deltaTime);
    }

    const turnInput = (this.playerInput.d ? 1 : 0) - (this.playerInput.a ? 1 : 0);
    if (turnInput !== 0) {
      const speedFactor = this.ballSpeed > 0 ? Math.min(1, this.ballSpeed / Math.max(1, this.ballMaxSpeed)) : 0.15;
      this.ballHeading -= turnInput * this.ballTurnRate * deltaTime * (0.35 + 0.65 * speedFactor);
    }

    const forwardX = Math.sin(this.ballHeading);
    const forwardZ = Math.cos(this.ballHeading);
    this.ballBody.velocity[0] = forwardX * this.ballSpeed;
    this.ballBody.velocity[2] = forwardZ * this.ballSpeed;

    // Variable jump height: charge while space is held, jump on release
    if (this.playerInput.space) {
      // Space is currently pressed: accumulate charge time (only if on ground)
      if (this.ballBody.settled) {
        const maxChargeTime = 0.5; // max charge duration in seconds
        this.jumpChargeTime = Math.min(maxChargeTime, this.jumpChargeTime + deltaTime);
      }
      this.spaceWasPressed = true;
    } else if (this.spaceWasPressed) {
      // Space was just released: apply jump based on charge time
      if (this.ballBody.settled && this.jumpChargeTime > 0) {
        // Interpolate between min and max impulse based on charge percentage
        const chargePercent = Math.min(1, this.jumpChargeTime / 0.5);
        const jumpImpulse = this.ballJumpImpulseMin + (this.ballJumpImpulseMax - this.ballJumpImpulseMin) * chargePercent;
        this.ballBody.velocity[1] = jumpImpulse;
      }
      // Reset charge time and state
      this.jumpChargeTime = 0;
      this.spaceWasPressed = false;
    }
  }

  updateBallAfterPhysics() {
    if (!this.ballBody || !this.ball) {
      return;
    }

    const currentPosition = this.ballBody.position;
    const deltaX = currentPosition[0] - this.ballLastPosition[0];
    const deltaZ = currentPosition[2] - this.ballLastPosition[2];

    this.ball.applyRollingFromDelta(deltaX, deltaZ);
    this.ballLastPosition[0] = currentPosition[0];
    this.ballLastPosition[1] = currentPosition[1];
    this.ballLastPosition[2] = currentPosition[2];

    // Camera follow behavior depends on current camera mode
    if (this.cameraMode === 'first') {
      // First person: position camera at ball's eye level and look forward along heading
      const eyeOffsetY = Math.max(0.2, this.ball.radius * 0.6);
      const px = currentPosition[0];
      const py = currentPosition[1] + eyeOffsetY;
      const pz = currentPosition[2];

      // place camera slightly in front of ball to avoid clipping - move along forward vector
      const forwardX = Math.sin(this.ballHeading);
      const forwardZ = Math.cos(this.ballHeading);
      this.camera.position[0] = px + forwardX * 0.12;
      this.camera.position[1] = py + 0.12;
      this.camera.position[2] = pz + forwardZ * 0.12;

      // target a point ahead of the ball
      this.camera.target[0] = px + forwardX * 3.0;
      this.camera.target[1] = py;
      this.camera.target[2] = pz + forwardZ * 3.0;
      this.camera.direction = this.camera.calculateDirection();
    } else {
      // third / far modes: use follow logic
      this.camera.follow(currentPosition, this.ballHeading);
    }
  }

  constrainCameraToObjects() {
    const pos = this.camera.position;

    if (this.rocks) {
      this.rocks.constrainCamera(pos);
    }

    if (this.pineTrees) {
      this.pineTrees.constrainCamera(pos);
    }

    if (this.barn) {
      this.barn.constrainCamera(pos);
    }

    if (this.barnFence) {
      this.barnFence.constrainCamera(pos);
    }
  }

  update(t) {
    this.time = t / 1000;

    const deltaTime = this.lastUpdateTime === 0 ? 0 : (t - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = t;
    // Detect actor changes and switch state if needed
    if (this.actorChoice !== this._lastActorChoice) {
      this._switchActiveActor(this._lastActorChoice, this.actorChoice);
      this._lastActorChoice = this.actorChoice;
    }

    if (deltaTime > 0) {
      // Only route player input to the ball when it's the active actor
      if (this.actorChoice === 'Ball') this.updatePlayerBallControl(deltaTime);
    }

    this.physics?.step(deltaTime);
    // After physics, constrain ball against world objects before visual update
    if (this.ballBody && this.actorChoice === 'Ball') {
      this.constrainBallPosition(this.ballBody);
    }

    if (deltaTime > 0) {
      if (this.actorChoice === 'Ball') this.updateBallAfterPhysics();
    }
    this.clouds.update(deltaTime);

    if (this.grass) {
      this.grass.update(this.time);
    }

    // Wagon physics + snap to terrain (only when active)
    if (this.actorChoice === 'Wagon') {
      this.wagon.update(deltaTime, this.keys);
      if (this.terrain) {
        this.wagon.y = this.terrain.getHeightAt(this.wagon.x, this.wagon.z);
      }

      // Check damage before world constraints push the wagon out of contact
      this.wagon.checkCollisions({
        rocks: this.rocks,
        trees: this.pineTrees,
        flowers: this.flowers,
        barnFence: this.barnFence,
      });

      // constrain wagon against world geometry
      this.constrainWagonPosition(this.wagon);
      if (this.terrain) {
        this.wagon.y = this.terrain.getHeightAt(this.wagon.x, this.wagon.z);
      }
      this.wagon.updateTerrainAlignment(this.terrain, deltaTime);
      
      // Make camera follow wagon when it's active
      if (this.camera && typeof this.camera.follow === 'function') {
        const target = vec3.fromValues(this.wagon.x, this.wagon.y, this.wagon.z);
        this.camera.follow(target, this.wagon.heading || 0);
      }
    }

    if (this.cameraDebugEnabled && t - this.lastCameraDebugLogTime >= this.cameraDebugIntervalMs) {
      const pos = this.camera.position;
      console.log(
        `[Camera] x=${pos[0].toFixed(2)} y=${pos[1].toFixed(2)} z=${pos[2].toFixed(2)}`
      );
      this.lastCameraDebugLogTime = t;
    }
  }

  display() {
    // ---- BEGIN Background, camera and axis setup
    // Clear image and depth buffer everytime we update the scene
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    // Initialize Model-View matrix as identity (no transformation
    this.updateProjectionMatrix();
    this.loadIdentity();
    
    // Constrain camera to stay within dome and above terrain
    this.constrainCameraToDome();
    this.constrainCameraAboveTerrain();
    this.constrainCameraToObjects();
    
    // Apply transformations corresponding to the camera position relative to the origin
    this.applyViewMatrix();

    const skyProps = this.computeSkyFromTime();

    if (this.sunEnabled) this.lights[0].enable();
    else this.lights[0].disable();
    this.lights[0].update();

    this.gl.clearColor(skyProps.clear[0], skyProps.clear[1], skyProps.clear[2], skyProps.clear[3]);
    this.setGlobalAmbientLight(skyProps.ambient[0], skyProps.ambient[1], skyProps.ambient[2], skyProps.ambient[3]);

    this.setDefaultAppearance();

    // ---- BEGIN Primitive drawing section

    // Draw

    if (this.displayAxis) this.axis.display();

    this.rocks.display();
    this.pineTrees.display();
    // Sky dome with radius 200
    this.sky.display();
    this.clouds.display();
    this.terrain.display();
    if (this.haySet) this.haySet.display();
    // Render loaded OBJ models at terrain center (adjust vertically using model bbox)
    if (this.hayModels && this.hayModels.length) {
      for (const entry of this.hayModels) {
        const m = entry.model;
        if (!m || !m.model || !m.model.inited) continue;
        const x = entry.x;
        const z = entry.z;
        const terrainY = this.terrain ? this.terrain.getHeightAt(x, z) : 0;
        const yTrans = terrainY - (m.minY * m.scale) + 0.01;
        this.pushMatrix();
        this.translate(x, yTrans, z);
        m.display();
        this.popMatrix();
      }
    }
    
    this.barn.display();
    this.barnFence.display();
    if (this.actorChoice === 'Ball') this.ball.display();
    
    this.grass.display();
    this.flowers.display();

    if (this.actorChoice === 'Wagon') this.wagon.display();

    // ---- END Primitive drawing section
    
    // Render UI overlay
    this.renderGameUI();
  }

  /**
   * Create overlay canvas for UI rendering (separate from WebGL canvas)
   */
  ensureUIOverlay() {
    if (this._uiOverlay) return;

    const glCanvas = this.gl.canvas;
    const overlay = document.createElement('canvas');
    overlay.id = 'ui-overlay';
    overlay.width = glCanvas.width;
    overlay.height = glCanvas.height;
    overlay.style.position = 'absolute';
    overlay.style.top = glCanvas.offsetTop + 'px';
    overlay.style.left = glCanvas.offsetLeft + 'px';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '100';

    glCanvas.parentNode.insertBefore(overlay, glCanvas.nextSibling);
    this._uiOverlay = overlay;
    this._uiContext = overlay.getContext('2d');
  }

  /**
   * Render game UI overlay (health display, game over message, etc.)
   */
  renderGameUI() {
    if (!this.gameState) return;

    this.ensureUIOverlay();
    const ctx = this._uiContext;
    const canvas = this._uiOverlay;
    
    if (!ctx) return;

    // Clear overlay
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ═══════════════════════════════════════════════════════
    // Health Bar (Bottom-Left)
    // ═══════════════════════════════════════════════════════
    const barX = 20;
    const barY = canvas.height - 50;
    const barWidth = 200;
    const barHeight = 30;
    const healthPercent = this.gameState.getHealthPercent();
    const healthBarWidth = (healthPercent / 100) * barWidth;

    // Background (semi-transparent dark box)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(barX - 5, barY - 5, barWidth + 10, barHeight + 10);

    // Health bar color: Green -> Yellow -> Red
    if (healthPercent > 50) {
      ctx.fillStyle = `rgb(100, 255, 100)`;
    } else if (healthPercent > 25) {
      ctx.fillStyle = `rgb(255, 255, 50)`;
    } else {
      ctx.fillStyle = `rgb(255, 50, 50)`;
    }

    // Draw health bar
    ctx.fillRect(barX, barY, healthBarWidth, barHeight);

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    // Health text
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${Math.ceil(this.gameState.wagonHealth)} / ${this.gameState.wagonMaxHealth}`,
      barX + barWidth / 2,
      barY + barHeight / 2 + 5
    );

    // ═══════════════════════════════════════════════════════
    // Game Over Message
    // ═══════════════════════════════════════════════════════
    if (this.gameState.isGameOver()) {
      // Semi-transparent overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Main message
      ctx.fillStyle = 'rgba(255, 50, 50, 1)';
      ctx.font = 'bold 72px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 80);

      // Subtitle
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = 'bold 28px Arial';
      ctx.fillText('The wagon was destroyed!', canvas.width / 2, canvas.height / 2);

      // Instructions
      ctx.fillStyle = 'rgba(200, 200, 200, 0.8)';
      ctx.font = '20px Arial';
      ctx.fillText('Press R to reset the game', canvas.width / 2, canvas.height / 2 + 80);
    }
  }
}
