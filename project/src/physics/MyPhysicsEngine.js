export class MyPhysicsEngine {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.gravity = options.gravity ?? -24.0;
    this.terminalVelocity = options.terminalVelocity ?? -90.0;
    this.bodies = [];
  }

  registerBody(config) {
    const body = {
      name: config.name ?? 'body',
      position: config.position ?? vec3.fromValues(0, 0, 0),
      velocity: config.velocity ?? vec3.fromValues(0, 0, 0),
      gravityScale: config.gravityScale ?? 1,
      active: config.active ?? true,
      linearDrag: config.linearDrag ?? 0,
      groundResistance: config.groundResistance ?? 0,
      restVelocityThreshold: config.restVelocityThreshold ?? 0.02,
      groundHeightFn: config.groundHeightFn ?? null,
      beforeStep: config.beforeStep ?? null,
      onStep: config.onStep ?? null,
      onGround: config.onGround ?? null,
      settled: false,
    };

    this.bodies.push(body);
    return body;
  }

  step(deltaTime) {
    if (!deltaTime || deltaTime <= 0) {
      return;
    }

    for (const body of this.bodies) {
      if (!body.active) {
        continue;
      }

      if (typeof body.beforeStep === 'function') {
        body.beforeStep(body);
      }

      const drag = Math.max(0, body.linearDrag || 0);
      const groundResistance = Math.max(0, body.groundResistance || 0);
      if (drag > 0) {
        const dragFactor = Math.max(0, 1 - drag * deltaTime);
        body.velocity[0] *= dragFactor;
        body.velocity[1] *= dragFactor;
        body.velocity[2] *= dragFactor;
      }

      body.velocity[1] += this.gravity * body.gravityScale * deltaTime;
      if (body.velocity[1] < this.terminalVelocity) {
        body.velocity[1] = this.terminalVelocity;
      }

      body.position[0] += body.velocity[0] * deltaTime;
      body.position[1] += body.velocity[1] * deltaTime;
      body.position[2] += body.velocity[2] * deltaTime;

      const groundHeight = body.groundHeightFn ? body.groundHeightFn(body.position, body) : 0;
      if (body.position[1] <= groundHeight) {
        body.position[1] = groundHeight;
        if (body.velocity[1] < 0) {
          body.velocity[1] = 0;
        }

        if (groundResistance > 0) {
          const groundDragFactor = Math.max(0, 1 - groundResistance * deltaTime);
          body.velocity[0] *= groundDragFactor;
          body.velocity[2] *= groundDragFactor;
          if (Math.abs(body.velocity[0]) < body.restVelocityThreshold) {
            body.velocity[0] = 0;
          }
          if (Math.abs(body.velocity[2]) < body.restVelocityThreshold) {
            body.velocity[2] = 0;
          }
        }

        if (Math.abs(body.velocity[0]) < body.restVelocityThreshold) {
          body.velocity[0] = 0;
        }
        if (Math.abs(body.velocity[2]) < body.restVelocityThreshold) {
          body.velocity[2] = 0;
        }

        body.settled = true;
        if (typeof body.onGround === 'function') {
          body.onGround(body);
        }
      } else {
        body.settled = false;
      }

      if (typeof body.onStep === 'function') {
        body.onStep(body);
      }
    }
  }
}