import { CGFcamera } from '../../lib/CGF.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class MyFirstPersonCamera extends CGFcamera {
  constructor(fov, near, far, position, target) {
    super(fov, near, far, position, target);
    this.minPitch = -Math.PI / 2 + 0.05;
    this.maxPitch = Math.PI / 2 - 0.05;

    this.yaw = 0;
    this.pitch = 0;
    this.syncAnglesFromTarget();
  }

  syncAnglesFromTarget() {
    const forward = vec3.fromValues(
      this.target[0] - this.position[0],
      this.target[1] - this.position[1],
      this.target[2] - this.position[2]
    );
    vec3.normalize(forward, forward);

    this.pitch = Math.asin(clamp(forward[1], -1, 1));
    this.yaw = Math.atan2(forward[0], forward[2]);
    this.updateDirection();
  }

  getForwardVector() {
    const forward = vec3.fromValues(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch)
    );
    return vec3.normalize(forward, forward);
  }

  getFlatForwardVector() {
    const forward = vec3.fromValues(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    return vec3.normalize(forward, forward);
  }

  getRightVector() {
    const right = vec3.cross(vec3.create(), this.getFlatForwardVector(), this._up);
    return vec3.normalize(right, right);
  }

  updateDirection() {
    const forward = this.getForwardVector();
    vec4.set(this.direction, forward[0], forward[1], forward[2], 0);
    vec4.set(
      this.target,
      this.position[0] + forward[0],
      this.position[1] + forward[1],
      this.position[2] + forward[2],
      0
    );
  }

  getViewMatrix() {
    this.updateDirection();
    return super.getViewMatrix();
  }

  orbit(axisID, angle) {
    if (axisID === 0) {
      this.pitch = clamp(this.pitch - angle, this.minPitch, this.maxPitch);
    } else if (axisID === 1) {
      this.yaw -= angle;
    }

    this.updateDirection();
  }

  rotate(axisID, angle) {
    this.orbit(axisID, angle);
  }

  moveForward(value) {
    const forward = this.getFlatForwardVector();
    this.position[0] += forward[0] * value;
    this.position[2] += forward[2] * value;
    this.updateDirection();
  }

  moveRight(value) {
    const right = this.getRightVector();
    this.position[0] += right[0] * value;
    this.position[1] += right[1] * value;
    this.position[2] += right[2] * value;
    this.updateDirection();
  }

  moveUp(value) {
    this.position[0] += this._up[0] * value;
    this.position[1] += this._up[1] * value;
    this.position[2] += this._up[2] * value;
    this.updateDirection();
  }

  zoom(value) {
    this.moveForward(value);
  }

  pan(vecValue) {
    if (!vecValue) {
      return;
    }

    this.moveRight(vecValue[0]);
    this.moveUp(vecValue[1]);
  }

  // Simple keyboard handlers for WASD movement. These are invoked by the
  // CGF interface only for those keys so regular browser shortcuts remain
  // available (Ctrl/Shift/F12/etc.). `event` is forwarded for compatibility.
  onKeyDown(event) {
    const key = (event && event.key) ? event.key.toLowerCase() : '';
    const step = 0.5;
    console.log('MyFirstPersonCamera.onKeyDown', key, 'pos before', this.position.slice());
    if (key === 'w') {
      this.moveForward(step);
    } else if (key === 's') {
      this.moveForward(-step);
    } else if (key === 'a') {
      this.moveRight(-step);
    } else if (key === 'd') {
      this.moveRight(step);
    }
    console.log('MyFirstPersonCamera.onKeyDown', key, 'pos after', this.position.slice());
  }

  onKeyUp(/* event */) {
    // No-op for now. Keeping the method allows future expansion (continuous
    // movement on key hold, toggles, etc.) without changing the interface.
  }
}