import { CGFscene, CGFcamera, CGFaxis } from "../../lib/CGF.js";
import { MySky } from "./environment/MySky.js";
import { MyClouds } from "./environment/MyClouds.js";
import { MyTerrain } from "./terrain/MyTerrain.js";

/**
 * MyScene
 * @constructor
 */
export class MyScene extends CGFscene {
  constructor() {
    super();
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
    this.lastUpdateTime = 0;

    this.setUpdatePeriod(16);

    //Objects connected to MyInterface
    this.displayAxis = true;
    this.sunEnabled = true;
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
    this.camera = new CGFcamera(
      0.4,
      0.1,
      1000,
      vec3.fromValues(200, 200, 200),
      vec3.fromValues(0, 0, 0)
    );
    this.domeRadius = 195; // Keep camera within dome (radius 200 with margin)
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
    // Force target to center (0,0,0)
    // We enforce this here so panning is effectively disabled and we always look at the center.
    this.camera.target[0] = 0;
    this.camera.target[1] = 0;
    this.camera.target[2] = 0;

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

  update(t) {
    if (this.lastUpdateTime === 0) {
      this.lastUpdateTime = t;
      return;
    }

    const deltaTime = (t - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = t;
    this.clouds.update(deltaTime);
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
    
    // Apply transformations corresponding to the camera position relative to the origin
    this.applyViewMatrix();

    if (this.sunEnabled) this.lights[0].enable();
    else this.lights[0].disable();
    this.lights[0].update();

    this.setDefaultAppearance();

    // ---- BEGIN Primitive drawing section

    // Draw

    if (this.displayAxis) this.axis.display();

    // Sky dome with radius 200
    this.sky.display();
    this.clouds.display();
    this.terrain.display();

    // ---- END Primitive drawing section
  }
}
