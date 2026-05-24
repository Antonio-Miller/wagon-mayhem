import { CGFcamera } from '../../lib/CGF.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class MyThirdPersonCamera extends CGFcamera {
  constructor(fov, near, far, position, target) {
    super(fov, near, far, position, target);
    this.followDistance = 24;
    this.followHeight = 9;
    this.lookHeight = 4 ;
    this.smoothing = 0.18;
  }

  follow(targetPosition, heading, options = {}) {
    const distance = options.distance ?? this.followDistance;
    const height = options.height ?? this.followHeight;
    const lookHeight = options.lookHeight ?? this.lookHeight;
    const smoothing = clamp(options.smoothing ?? this.smoothing, 0, 1);

    const desiredX = targetPosition[0] - Math.sin(heading) * distance;
    const desiredY = targetPosition[1] + height;
    const desiredZ = targetPosition[2] - Math.cos(heading) * distance;

    this.position[0] += (desiredX - this.position[0]) * smoothing;
    this.position[1] += (desiredY - this.position[1]) * smoothing;
    this.position[2] += (desiredZ - this.position[2]) * smoothing;

    this.target[0] += (targetPosition[0] - this.target[0]) * smoothing;
    this.target[1] += ((targetPosition[1] + lookHeight) - this.target[1]) * smoothing;
    this.target[2] += (targetPosition[2] - this.target[2]) * smoothing;

    this.direction = this.calculateDirection();
  }

  orbit() {}
  rotate() {}
  pan() {}
  zoom() {}
  moveForward() {}
  moveRight() {}
  moveUp() {}
  onKeyDown() {}
  onKeyUp() {}
}