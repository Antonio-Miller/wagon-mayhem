import { CGFscene, CGFcamera, CGFaxis } from "../../lib/CGF.js";
import { MyThirdPersonCamera } from "./MyThirdPersonCamera.js";
import { MySky } from "./environment/MySky.js";
import { MyClouds } from "./environment/MyClouds.js";
import { MyTerrain } from "./terrain/MyTerrain.js";
import { MyRockSet } from "./scatter/MyRockSet.js";
import { MyHayBaleRound } from "./entities/MyHayBaleRound.js";
import { MyHaySet } from "./scatter/MyHaySet.js";
import { MyPineTreeSet } from "./scatter/MyPineTreeSet.js";
import { distributeMixedRocksAndTrees } from "./scatter/distribute.js";
import { MyGrass } from "./entities/MyGrass.js";
import { MyFlowerSet } from "./scatter/MyFlowerSet.js";
import { MyBarn } from "./entities/MyBarn.js";
import { MyBarnFence } from "./entities/MyBarnFence.js";
// MyRollingBall removed — Ball actor is deprecated
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
    this.timeOfDay = 9; // start at 09:00
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
    this.actionInput = {
      pickup: false,
      drop: false,
    };
    this.grassAmount = 0.4;    // 40% density: balances visuals with performance
    this.renderDistance = 650;  // ~65% of max: reduces far-LOD overhead
    this.carriedHayBales = [];
    this.maxCarriedHayBales = 2;
    this.barnDropSlot = 0;
    // Explicit stored hay bale registry (bales delivered to barn via L)
    this.storedHayBales = [];
    // Wagon spawn location (from previous ball spawn coordinates)
    this.defaultSpawn = {
      x: 116.22,
      z: -175.48,
      heading: 0,
    };
    // Only Wagon actor is supported; actorChoice removed
    
    // Game state manager
    this.gameState = new GameState();
    this.isPaused = false;
  }

  // Actor switching removed; only Wagon is supported
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

    // Mixed dispersion for trees and rocks is fully centralized in distribute.js
    const rockCount = 10;
    const treeCount = 15;
    const { treePositions, rockPositions } = distributeMixedRocksAndTrees({
      radius: 290,
      treeCount,
      rockCount,
      treeMinDist: 32,
      rockMinDist: 12,
      crossMinDist: 20,
      baseMinDist: 10,
      k: 30,
      forbiddenFn: (x, z, kind) => {
        if (!this.terrain?.isPointForbidden) return false;
        const clearance = kind === "tree" ? 20 : 15;
        return this.terrain.isPointForbidden(x, z, clearance);
      },
    });

    // Pass precomputed positions to sets; placement generation is centralized in distribute.js
    this.pineTrees = new MyPineTreeSet(this, treeCount, this.terrain, treePositions);
    this.rocks = new MyRockSet(this, rockCount, this.terrain, rockPositions);
    this.flowers = new MyFlowerSet(this, 12, this.terrain, this.rocks, this.pineTrees);  // Reduced from 20 to 12 for performance
    this.physics = new MyPhysicsEngine(this, {
      gravity: -24.0,
      terminalVelocity: -90.0,
    });
    this.registerPhysicsBodies();
    this.wagon = new MyWagon(this, this.gameState);
    if (this.wagon && typeof this.wagon.setCarriedHayBales === 'function') {
      this.wagon.setCarriedHayBales(this.carriedHayBales);
    }
    // Wagon spawns at default location
    if (this.wagon && this.defaultSpawn) {
      this.wagon.x = this.defaultSpawn.x;
      this.wagon.z = this.defaultSpawn.z;
      this.wagon.heading = this.defaultSpawn.heading || 0;
      this.wagon.y = this.terrain ? this.terrain.getHeightAt(this.wagon.x, this.wagon.z) : 0;
    }
    this.applyPerformanceSettings();
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
            linearDrag: 0.08,
            groundResistance: 2.2,
            restVelocityThreshold: 0.015,
            groundHeightFn: () => {
              if (this.terrain?.getHeightAt) {
                const terrainY = this.terrain.getHeightAt(hay.x, hay.z);
                return terrainY + 1.0;
              }
              return 0;
            },
            onStep: (body) => {
              hay.x = body.position[0];
              hay.y = body.position[1];
              hay.z = body.position[2];
            },
          });

          if (hay.bale && typeof hay.bale.setPhysicsBody === 'function') {
            hay.bale.setPhysicsBody(body);
          }
        }
      }
      if (this.wagon && typeof this.wagon.setCarriedHayBales === 'function') {
        this.wagon.setCarriedHayBales(this.carriedHayBales);
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
    // Single active actor model (Wagon) - actorChoice removed
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

  setGrassAmount(amount) {
    const clampedAmount = Math.max(0.25, Math.min(1.0, amount));
    this.grassAmount = clampedAmount;

    if (this.grass && typeof this.grass.setGrassDensity === 'function') {
      this.grass.setGrassDensity(clampedAmount);
    }
  }

  setRenderDistance(renderDistance) {
    const clampedDistance = Math.max(250, Math.min(1200, renderDistance));
    this.renderDistance = clampedDistance;

    if (this.camera) {
      this.camera.far = clampedDistance;
    }
  }

  applyPerformanceSettings() {
    this.setGrassAmount(this.grassAmount);
    this.setRenderDistance(this.renderDistance);
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

  // Ball actor removed: initPlayerBall() deleted

  clearGameplayInputs() {
    this.playerInput = {
      w: false,
      a: false,
      s: false,
      d: false,
      space: false,
    };

    this.actionInput.pickup = false;
    this.actionInput.drop = false;

    if (this.keys) {
      this.keys.KeyW = false;
      this.keys.KeyA = false;
      this.keys.KeyS = false;
      this.keys.KeyD = false;
      this.keys.KeyP = false;
      this.keys.KeyL = false;
      this.keys.Space = false;
      this.keys.wagonForwardGear = 1;
      this.keys.wagonReverseGear = 1;
    }

    if (this.wagonDriveState) {
      if (this.wagonDriveState.w) {
        this.wagonDriveState.w.pressed = false;
        this.wagonDriveState.w.gear = 1;
      }
      if (this.wagonDriveState.s) {
        this.wagonDriveState.s.pressed = false;
        this.wagonDriveState.s.gear = 1;
      }
    }
  }

  togglePause() {
    if (this.gameState?.isGameOver()) {
      return;
    }

    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.clearGameplayInputs();
    }
  }

  resetGameFromGameOver() {
    if (!this.gameState || !this.gameState.isGameOver()) {
      return;
    }

    const spawnX = this.defaultSpawn?.x ?? 0;
    const spawnZ = this.defaultSpawn?.z ?? 0;
    const spawnHeading = this.defaultSpawn?.heading ?? 0;
    const spawnY = this.terrain ? this.terrain.getHeightAt(spawnX, spawnZ) : (this.defaultSpawn?.y ?? 0);

    this.gameState.reset();
    this.actionInput.pickup = false;
    this.actionInput.drop = false;

    // Reset carried hay references
    this.carriedHayBales = [];
    if (this.wagon && typeof this.wagon.setCarriedHayBales === 'function') {
      this.wagon.setCarriedHayBales(this.carriedHayBales);
    }

    if (this.wagon && typeof this.wagon.reset === 'function') {
      this.wagon.reset({
        x: spawnX,
        y: spawnY,
        z: spawnZ,
        heading: spawnHeading,
        resetGameState: false,
      });
    }

    // Wagon remains the only actor; nothing to switch
  }

  // Ball collision handling removed

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

    if (['p', 'l'].includes(key)) {
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
    } else if (key === 'p') {
        if (!event.repeat) this.actionInput.pickup = true;
    } else if (key === 'l') {
        if (!event.repeat) this.actionInput.drop = true;
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

  findNearestAvailableHayBale(maxDistance = 35.0) {
    if (!this.wagon || !this.haySet?.hay) {
      return null;
    }

    let closestHay = null;
    let closestDistance = maxDistance;

    for (const hay of this.haySet.hay) {
      if (!hay || hay.collected || !hay.bale) {
        continue;
      }

      // Exclude hay that has been explicitly stored (only set by dropHayBale())
      if (this.storedHayBales.includes(hay)) {
        continue;
      }

      const dx = hay.x - this.wagon.x;
      const dz = hay.z - this.wagon.z;
      const distance = Math.hypot(dx, dz);

      if (distance <= closestDistance) {
        closestDistance = distance;
        closestHay = hay;
      }
    }

    return closestHay;
  }

  pickUpHayBale() {
    if (!this.wagon || !this.haySet || !this.gameState) {
      return false;
    }

    if (Math.abs(this.wagon.speed || 0) > 1e-3) {
      return false;
    }

    if (this.carriedHayBales.length >= this.maxCarriedHayBales) {
      return false;
    }

    const hay = this.findNearestAvailableHayBale();
    if (!hay) {
      return false;
    }

    hay.collected = true;
    // If we pick up a bale that was previously marked as stored, clear that flag
    if (hay.stored) {
      const idx = this.storedHayBales.indexOf(hay);
      if (idx !== -1) this.storedHayBales.splice(idx, 1);
    }
    hay.stored = false;
    if (hay.bale && typeof hay.bale.setCarried === 'function') {
      hay.bale.setCarried(true);
    }
    this.carriedHayBales.push(hay);
    this.gameState.addBales(1);
    return true;
  }

  getBarnSideDropPosition(slotIndex = 0) {
    if (!this.barn) {
      return null;
    }

    const barn = this.barn;
    const halfWidth = barn.width / 2;
    const halfDepth = barn.depth / 2;
    const sidePadding = 3.0;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    const dx = this.wagon.x - barn.positionX;
    const dz = this.wagon.z - barn.positionZ;

    let dropX = this.wagon.x;
    let dropZ = this.wagon.z;

    if (Math.abs(dx) >= Math.abs(dz)) {
      dropX = barn.positionX + Math.sign(dx || 1) * (halfWidth + sidePadding);
      dropZ = clamp(this.wagon.z, barn.positionZ - halfDepth + 2.0, barn.positionZ + halfDepth - 2.0);
    } else {
      dropZ = barn.positionZ + Math.sign(dz || 1) * (halfDepth + sidePadding);
      dropX = clamp(this.wagon.x, barn.positionX - halfWidth + 2.0, barn.positionX + halfWidth - 2.0);
    }

    const slotOffset = slotIndex % 2 === 0 ? -1.25 : 1.25;
    if (Math.abs(dx) >= Math.abs(dz)) {
      dropZ += slotOffset;
    } else {
      dropX += slotOffset;
    }

    const terrainY = this.terrain?.getHeightAt ? this.terrain.getHeightAt(dropX, dropZ) : 0;
    return [dropX, terrainY + 1.0, dropZ];
  }

  dropHayBale() {
    if (!this.wagon || !this.barn || !this.haySet || !this.gameState) {
      return false;
    }

    // Drop only allowed inside the Drop Area: defined as the barn fence radius minus 5 units
    const fenceRadius = this.barnFence?.fenceRadius ?? null;
    if (fenceRadius === null) {
      // fallback to terrain's barn area test if fence info not available
      if (!this.terrain?.isPointInBarnArea || !this.terrain.isPointInBarnArea(this.wagon.x, this.wagon.z, 0)) {
        return false;
      }
    } else {
      const dropRadius = Math.max(0, fenceRadius - 5);
      const centerX = this.barn.positionX ?? this.barnAreaCenterX;
      const centerZ = this.barn.positionZ ?? this.barnAreaCenterZ;
      const dx = this.wagon.x - centerX;
      const dz = this.wagon.z - centerZ;
      if (dx * dx + dz * dz > dropRadius * dropRadius) {
        return false;
      }
    }

    if (!this.carriedHayBales.length) {
      return false;
    }

    const hay = this.carriedHayBales.pop();
    const dropPos = this.getBarnSideDropPosition(this.barnDropSlot++);
    if (!dropPos) {
      this.carriedHayBales.push(hay);
      return false;
    }

    const [dropX, dropY, dropZ] = dropPos;
    hay.collected = false;
    // Mark this hay bale as stored in the barn (only set when dropped via L)
    hay.stored = true;
    if (!this.storedHayBales.includes(hay)) this.storedHayBales.push(hay);
    if (hay.bale && typeof hay.bale.setCarried === 'function') {
      hay.bale.setCarried(false);
      if (hay.bale.body) {
        hay.bale.body.position[0] = dropX;
        hay.bale.body.position[1] = dropY;
        hay.bale.body.position[2] = dropZ;
        hay.bale.body.velocity[0] = 0;
        hay.bale.body.velocity[1] = 0;
        hay.bale.body.velocity[2] = 0;
        hay.bale.body.active = true;
        hay.bale.body.settled = true;
      }
    }
    hay.x = dropX;
    hay.y = dropY;
    hay.z = dropZ;
    const delivered = this.gameState.deliverBales(1);
    if (delivered > 0) {
      this.gameState.healWagon(10);
    }
    return true;
  }

  processHayActions() {
    if (this.actionInput.pickup) {
      this.pickUpHayBale();
      this.actionInput.pickup = false;
    }

    if (this.actionInput.drop) {
      this.dropHayBale();
      this.actionInput.drop = false;
    }
  }

  updateHayWagonCollisions(deltaTime) {
    if (!this.wagon || !this.haySet?.hay) {
      return;
    }

    const wagonRadius = Math.max(this.wagon.bodyWidth, this.wagon.bodyLength) / 2 + 0.8;
    const wagonSpeed = Math.abs(this.wagon.speed || 0);
    const forwardX = Math.sin(this.wagon.heading || 0);
    const forwardZ = Math.cos(this.wagon.heading || 0);
    const terrainY = this.terrain?.getHeightAt ? this.terrain.getHeightAt(this.wagon.x, this.wagon.z) : 0;

    for (const hay of this.haySet.hay) {
      if (!hay || hay.collected || !hay.bale?.body || hay.bale.carried) {
        continue;
      }

      hay.pushCooldown = Math.max(0, (hay.pushCooldown || 0) - deltaTime);
      if (hay.pushCooldown > 0) {
        continue;
      }

      const body = hay.bale.body;
      const hx = body.position[0];
      const hz = body.position[2];
      const dx = hx - this.wagon.x;
      const dz = hz - this.wagon.z;
      const distance = Math.hypot(dx, dz);
      const hayRadius = Math.max(2.5, hay.scale * 0.45);
      const collisionThreshold = wagonRadius + hayRadius;

      if (distance >= collisionThreshold) {
        continue;
      }

      // Only treat the bale as immovable in the barn if it was explicitly stored via L
      const inBarnArea = !!hay.stored;

      let pushX = dx;
      let pushZ = dz;
      if (distance < 1e-4) {
        pushX = forwardX;
        pushZ = forwardZ;
      } else {
        pushX /= distance;
        pushZ /= distance;
      }

      const separation = collisionThreshold - distance + 0.15;
      const impulse = Math.max(3.0, wagonSpeed * 2.2 + separation * 4.5);

      if (inBarnArea) {
        const resolveDistance = collisionThreshold + 0.2;
        this.wagon.x = hx - pushX * resolveDistance;
        this.wagon.z = hz - pushZ * resolveDistance;
        this.wagon.speed = 0;
        continue;
      }

      body.position[0] = this.wagon.x + pushX * (collisionThreshold + 0.15);
      body.position[1] = Math.max(body.position[1], terrainY + 1.0);
      body.position[2] = this.wagon.z + pushZ * (collisionThreshold + 0.15);
      body.velocity[0] = pushX * impulse + forwardX * wagonSpeed * 0.75;
      body.velocity[1] = Math.max(body.velocity[1], 0.0);
      body.velocity[2] = pushZ * impulse + forwardZ * wagonSpeed * 0.75;
      body.active = true;
      body.settled = false;
      hay.pushCooldown = 0.2;
    }
  }

  updateHayStaticCollisions(deltaTime) {
    if (!this.haySet?.hay) {
      return;
    }

    for (const hay of this.haySet.hay) {
      if (!hay || hay.collected || !hay.bale?.body || hay.bale.carried) {
        continue;
      }

      hay.collisionCooldown = Math.max(0, (hay.collisionCooldown || 0) - deltaTime);

      const body = hay.bale.body;
      const hx = body.position[0];
      const hz = body.position[2];
      const hayRadius = Math.max(2.5, hay.scale * 0.45);

      // Check collision with ROCKS
      if (this.rocks?.rocks) {
        for (let i = 0; i < this.rocks.rocks.length; i++) {
          const rock = this.rocks.rocks[i];
          if (!rock || rock.x === undefined || rock.z === undefined) continue;

          const dx = hx - rock.x;
          const dz = hz - rock.z;
          const distance = Math.hypot(dx, dz);
          const rockRadius = (rock.scaleX + rock.scaleY + rock.scaleZ) / 3 * 0.85;
          const collisionThreshold = hayRadius + rockRadius;

          if (distance < collisionThreshold && distance > 0) {
            const pushX = dx / distance;
            const pushZ = dz / distance;
            const separation = collisionThreshold - distance + 0.1;
            body.position[0] = rock.x + pushX * (collisionThreshold + 0.1);
            body.position[2] = rock.z + pushZ * (collisionThreshold + 0.1);
            body.velocity[0] = pushX * 2.5;
            body.velocity[2] = pushZ * 2.5;
            body.settled = false;
            hay.collisionCooldown = 0.1;
          }
        }
      }

      // Check collision with PINE TREES
      if (this.pineTrees?.trees) {
        for (let i = 0; i < this.pineTrees.trees.length; i++) {
          const tree = this.pineTrees.trees[i];
          if (!tree || !tree.placed || tree.x === undefined || tree.z === undefined) continue;

          const dx = hx - tree.x;
          const dz = hz - tree.z;
          const distance = Math.hypot(dx, dz);
          const treeRadius = tree.foliageRadius || 6;
          const collisionThreshold = hayRadius + treeRadius;

          if (distance < collisionThreshold && distance > 0) {
            const pushX = dx / distance;
            const pushZ = dz / distance;
            body.position[0] = tree.x + pushX * (collisionThreshold + 0.1);
            body.position[2] = tree.z + pushZ * (collisionThreshold + 0.1);
            body.velocity[0] = pushX * 2.0;
            body.velocity[2] = pushZ * 2.0;
            body.settled = false;
            hay.collisionCooldown = 0.1;
          }
        }
      }

      // Check collision with FENCE POSTS
      if (this.barnFence?.fencePosts) {
        for (let i = 0; i < this.barnFence.fencePosts.length; i++) {
          const post = this.barnFence.fencePosts[i];
          if (!post || post.x === undefined || post.z === undefined) continue;

          const dx = hx - post.x;
          const dz = hz - post.z;
          const distance = Math.hypot(dx, dz);
          const postRadius = (this.barnFence.postRadius || 0.35) + 0.4;
          const collisionThreshold = hayRadius + postRadius;

          if (distance < collisionThreshold && distance > 0) {
            const pushX = dx / distance;
            const pushZ = dz / distance;
            body.position[0] = post.x + pushX * (collisionThreshold + 0.1);
            body.position[2] = post.z + pushZ * (collisionThreshold + 0.1);
            body.velocity[0] = pushX * 2.0;
            body.velocity[2] = pushZ * 2.0;
            body.settled = false;
            hay.collisionCooldown = 0.1;
          }
        }
      }

      // Check collision with BARN
      if (this.barn) {
        const barnX = this.barn.positionX;
        const barnZ = this.barn.positionZ;
        const barnHalfWidth = (this.barn.width || 50) / 2;
        const barnHalfDepth = (this.barn.depth || 52) / 2;

        const dx = hx - barnX;
        const dz = hz - barnZ;

        const closestX = Math.max(-barnHalfWidth, Math.min(barnHalfWidth, dx));
        const closestZ = Math.max(-barnHalfDepth, Math.min(barnHalfDepth, dz));

        const distX = dx - closestX;
        const distZ = dz - closestZ;
        const distance = Math.hypot(distX, distZ);
        const collisionThreshold = hayRadius + 0.5;

        if (distance < collisionThreshold && distance > 0) {
          const pushX = distX / distance;
          const pushZ = distZ / distance;
          body.position[0] = barnX + closestX + pushX * (collisionThreshold + 0.1);
          body.position[2] = barnZ + closestZ + pushZ * (collisionThreshold + 0.1);
          body.velocity[0] = pushX * 2.0;
          body.velocity[2] = pushZ * 2.0;
          body.settled = false;
          hay.collisionCooldown = 0.1;
        }
      }
    }
  }

  // Ball player controls removed

  // Ball post-physics update removed

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
    // Single-actor model: no actor change detection needed

    // Reset is only allowed on Game Over screen
    if (this.gameState?.isGameOver() && this.keys?.KeyR) {
      this.resetGameFromGameOver();
      this.keys.KeyR = false;
    }

    if (this.isPaused) {
      return;
    }

    // Advance time of day: 5 hours every 5 real seconds -> 1 hour/sec (10x faster)
    // (deltaTime is in seconds; deltaTime * 1.0 -> hours advanced)
    if (deltaTime > 0 && this.timeOfDay !== undefined) {
      const gameOver = this.gameState ? this.gameState.isGameOver() : false;
      if (!gameOver) {
        this.timeOfDay = (this.timeOfDay + deltaTime * 0.01) % 24;
      }
    }

    // Pickup/drop apply to wagon; no actor gating required

    if (deltaTime > 0) {
      // Player ball controls removed
    }

    this.physics?.step(deltaTime);
    // Ball actor removed: no physics-time constraints

    if (deltaTime > 0) {
      // Ball post-physics update removed
    }
    this.clouds.update(deltaTime);

    if (this.gameState) {
      this.gameState.update(deltaTime);
    }

    if (this.grass) {
      this.grass.update(this.time);
    }

    // Wagon physics + snap to terrain
    if (this.wagon) {
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

      this.updateHayWagonCollisions(deltaTime);

      // constrain wagon against world geometry
      this.constrainWagonPosition(this.wagon);
      if (this.terrain) {
        this.wagon.y = this.terrain.getHeightAt(this.wagon.x, this.wagon.z);
      }
      this.wagon.updateTerrainAlignment(this.terrain, deltaTime);
      this.processHayActions();
      
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
    // Ball display removed
    
    this.grass.display();
    this.flowers.display();

    if (this.wagon) this.wagon.display();

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
    // Health Bar (Top-Left)
    // ═══════════════════════════════════════════════════════
    const barX = 20;
    const barY = 20;
    const barWidth = 320;
    const barHeight = 24;
    const healthPercent = this.gameState.getHealthPercent();
    const healthBarWidth = (healthPercent / 100) * barWidth;

    // Background (semi-transparent dark box)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(barX - 5, barY - 5, barWidth + 10, barHeight + 10);

    // Health bar color: solid red
    ctx.fillStyle = 'rgb(220, 40, 40)';

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
    // Bale Counter (Below Health Bar)
    // ═══════════════════════════════════════════════════════
    const baleCounterY = barY + barHeight + 12;
    const baleCounterHeight = 20;

    // Background (semi-transparent dark box)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(barX - 5, baleCounterY - 5, barWidth + 10, baleCounterHeight + 10);

    // Label
    ctx.fillStyle = 'rgba(200, 180, 100, 0.9)';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Bales Delivered:', barX + 8, baleCounterY + 15);

    // Count value (gold/amber color for contrast)
    ctx.fillStyle = 'rgb(255, 215, 0)';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`${this.gameState.totalBalesDelivered}`, barX + barWidth - 8, baleCounterY + 15);

    // Border
    ctx.strokeStyle = 'rgba(200, 180, 100, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(barX, baleCounterY, barWidth, baleCounterHeight);

    // ═══════════════════════════════════════════════════════
    // Clock Display (Below Bale Counter)
    // ═══════════════════════════════════════════════════════
    const clockY = baleCounterY + baleCounterHeight + 12;
    const clockHeight = 26;

    // Background (semi-transparent dark box)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(barX - 5, clockY - 5, barWidth + 10, clockHeight + 10);

    // Format time as HH:MM
    const hours = Math.floor(this.timeOfDay);
    const minutes = Math.floor((this.timeOfDay % 1) * 60);
    const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

    // Clock display (large, centered)
    ctx.fillStyle = 'rgb(255, 200, 100)';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(timeString, barX + barWidth / 2, clockY + 18);

    // Border
    ctx.strokeStyle = 'rgba(255, 200, 100, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(barX, clockY, barWidth, clockHeight);

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
      return;
    }

    if (this.isPaused) {
      // Dimmed fullscreen backdrop
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const panelWidth = Math.min(760, canvas.width * 0.88);
      const panelHeight = Math.min(700, canvas.height * 0.84);
      const panelX = (canvas.width - panelWidth) * 0.5;
      const panelY = (canvas.height - panelHeight) * 0.5;

      // Main panel
      ctx.fillStyle = 'rgba(24, 24, 24, 0.92)';
      ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
      ctx.strokeStyle = 'rgba(255, 220, 140, 0.95)';
      ctx.lineWidth = 3;
      ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

      const centerX = panelX + panelWidth * 0.5;
      let y = panelY + 62;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.fillStyle = 'rgba(255, 230, 170, 1)';
      ctx.font = 'bold 64px Arial';
      ctx.fillText('PAUSED', centerX, y);

      y += 72;
      ctx.fillStyle = 'rgba(220, 220, 220, 0.95)';
      ctx.font = 'bold 30px Arial';
      ctx.fillText('Controls', centerX, y);

      const controls = [
        'W - Accelerate wagon',
        'Double tap W - Faster gear',
        'A/D - Steer wagon',
        'S - Stop wagon',
        'P - Pick up nearest hay bale',
        'L - Drop carried hay bale in barn drop area',
        'SHIFT - Cycle camera mode',
        'R - Reset game (when Game Over)',
        'ESC - Resume game',
      ];

      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(240, 240, 240, 0.95)';
      ctx.font = '24px Arial';
      const textX = panelX + 56;
      y += 56;
      for (const line of controls) {
        ctx.fillText(line, textX, y);
        y += 50;
      }

      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255, 210, 130, 0.95)';
      ctx.font = 'bold 26px Arial';
      ctx.fillText('Press ESC to continue', centerX, panelY + panelHeight - 54);
    }
  }
}
