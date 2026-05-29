import { CGFcamera } from '../../lib/CGF.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class MyThirdPersonCamera extends CGFcamera {
  constructor(fov, near, far, position, target) {
    super(fov, near, far, position, target);
    this.followDistance = 32;
    this.followHeight = 12;
    this.lookHeight = 5;
    this.smoothing = 0.18;
    this.orbitOffset = 0;
    this.orbitSensitivity = 0.008;
    this.orbitMax = Math.PI * 0.98; // allow near-front positions
    this.recenterSpeed = 0.14;
    this._orbitTarget = null; // if set, camera.orbitOffset will lerp toward this value
    this.orbitLerp = 0.22; // smoothing when moving toward _orbitTarget
  }

  follow(targetPosition, heading, options = {}) {
    const distance = options.distance ?? this.followDistance;
    const height = options.height ?? this.followHeight;
    const lookHeight = options.lookHeight ?? this.lookHeight;
    const smoothing = clamp(options.smoothing ?? this.smoothing, 0, 1);
    const desiredOrbitOffset = clamp(options.orbitOffset ?? this.orbitOffset, -this.orbitMax, this.orbitMax);

    // If a target orbit is set, lerp toward it; otherwise use current orbitOffset
    if (this._orbitTarget !== null && Number.isFinite(this._orbitTarget)) {
      // move orbitOffset toward target using orbitLerp
      this.orbitOffset += (this._orbitTarget - this.orbitOffset) * clamp(this.orbitLerp, 0, 1);
      // if close, snap and clear target
      if (Math.abs(this._orbitTarget - this.orbitOffset) < 1e-3) this._orbitTarget = null;
    } else {
      this.orbitOffset = desiredOrbitOffset;
    }

    const orbitOffset = clamp(this.orbitOffset, -this.orbitMax, this.orbitMax);

    const cameraHeading = heading + orbitOffset;
    const desiredX = targetPosition[0] - Math.sin(cameraHeading) * distance;
    const desiredY = targetPosition[1] + height;
    const desiredZ = targetPosition[2] - Math.cos(cameraHeading) * distance;

    this.position[0] += (desiredX - this.position[0]) * smoothing;
    this.position[1] += (desiredY - this.position[1]) * smoothing;
    this.position[2] += (desiredZ - this.position[2]) * smoothing;

    this.target[0] += (targetPosition[0] - this.target[0]) * smoothing;
    this.target[1] += ((targetPosition[1] + lookHeight) - this.target[1]) * smoothing;
    this.target[2] += (targetPosition[2] - this.target[2]) * smoothing;

    this.direction = this.calculateDirection();
  }

  orbit(axisID, angle) {
    if (axisID !== 1) {
      return;
    }

    this.orbitOffset = clamp(this.orbitOffset - angle * this.orbitSensitivity, -this.orbitMax, this.orbitMax);
  }

  recenterOrbit(amount = this.recenterSpeed) {
    const step = clamp(amount, 0, 1);
    this.orbitOffset += (0 - this.orbitOffset) * step;
  }

  rotate(axisID, angle) {
    this.orbit(axisID, angle);
  }

  /**
   * Smoothly set a target absolute orbit angle (radians). If `immediate` is true,
   * set orbitOffset instantly.
   */
  setOrbitAngle(angle, immediate = false) {
    const clamped = clamp(angle, -this.orbitMax, this.orbitMax);
    if (immediate) {
      this.orbitOffset = clamped;
      this._orbitTarget = null;
    } else {
      this._orbitTarget = clamped;
    }
  }
  pan() {}
  zoom() {}
  moveForward() {}
  moveRight() {}
  moveUp() {}
  onKeyDown() {}
  onKeyUp() {}
}