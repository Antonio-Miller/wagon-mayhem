import { CGFscene, CGFcamera, CGFaxis } from "../../lib/CGF.js";
import { MyFirstPersonCamera } from "./MyFirstPersonCamera.js";
import { MySky } from "./environment/MySky.js";
import { MyClouds } from "./environment/MyClouds.js";
import { MyTerrain } from "./terrain/MyTerrain.js";
import { MyRockSet } from "./scatter/MyRockSet.js";
import { MyPineTreeSet } from "./scatter/MyPineTreeSet.js";
import { MyGrass } from "./entities/MyGrass.js";
import { MyFlowerSet } from "./scatter/MyFlowerSet.js";

/**
 * MyScene
 * @constructor
 */
export class MyScene extends CGFscene {
  constructor() {
    super();
    this.timeOfDay = 12;
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

    const barnAreaCenterX = 112.65;
    const barnAreaCenterZ = -220.85;
    const barnAreaRadius = 90;
    this.terrain.setCircularArea(
      barnAreaCenterX,
      barnAreaCenterZ,
      barnAreaRadius,
      [0.72, 0.54, 0.36],
      0.92,
      10.0
    );

    this.grass = new MyGrass(this, this.terrain);
    this.rocks = new MyRockSet(this, 50, this.terrain);
    this.pineTrees = new MyPineTreeSet(this, 20, this.terrain);
    this.flowers = new MyFlowerSet(this, 80, this.terrain, this.rocks, this.pineTrees);
    this.lastUpdateTime = 0;
    this.cameraDebugEnabled = true;
    this.cameraDebugIntervalMs = 500;
    this.lastCameraDebugLogTime = 0;

    this.setUpdatePeriod(16);

    //Objects connected to MyInterface
    this.displayAxis = true;
    this.sunEnabled = true;
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
    this.camera = new MyFirstPersonCamera(
      0.4,
      0.1,
      1000,
      vec3.fromValues(200, 200, 200),
      vec3.fromValues(0, 0, 0)
    );
    this.domeRadius = 295; // Keep camera within dome (radius 200 with margin)
    this.terrainMinHeight = 25; // Keep camera above terrain peaks
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

  constrainCameraToObjects() {
    const pos = this.camera.position;

    if (this.rocks) {
      this.rocks.constrainCamera(pos);
    }

    if (this.pineTrees) {
      this.pineTrees.constrainCamera(pos);
    }
  }

  update(t) {
    this.time = t / 1000;

    if (this.lastUpdateTime === 0) {
      this.lastUpdateTime = t;
      if (this.grass) {
        this.grass.update(this.time);
      }
      return;
    }

    const deltaTime = (t - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = t;
    this.clouds.update(deltaTime);

    if (this.grass) {
      this.grass.update(this.time);
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
    this.grass.display();
    this.flowers.display();
    

    // ---- END Primitive drawing section
  }
}
