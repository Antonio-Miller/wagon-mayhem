import { CGFobject, CGFappearance } from "../../../lib/CGF.js";
import { MyCilinder } from "../primitives/MyCilinder.js";

export class MyBarnFence extends CGFobject {
  constructor(
    scene,
    terrain,
    centerX = 0,
    centerZ = 0,
    fenceRadius = 10,
    postRadius = 0.35,
    postHeight = 4.2,
    postSpacing = 6.5,
    openingAngles = []
  ) {
    super(scene);

    this.terrain = terrain;
    this.centerX = centerX;
    this.centerZ = centerZ;
    this.fenceRadius = fenceRadius;
    this.postRadius = postRadius;
    this.postHeight = postHeight;
    this.postSpacing = postSpacing;
    this.openingAngles = openingAngles;
    this.pathClearance = 6;

    // Create fence post primitive (thin vertical cylinder)
    this.postPrimitive = new MyCilinder(scene, 12, 2, postRadius, postHeight, true);

    // Base cylinder under each post
    const baseRadius = postRadius * 1.5;
    const baseHeight = postRadius * 0.45;
    this.baseHeight = baseHeight;
    this.basePrimitive = new MyCilinder(scene, 12, 1, baseRadius, baseHeight, true);

    // Create horizontal connecting cylinder (unit length; we scale length per segment)
    this.horizontalRadius = postRadius * 0.42;
    this.horizontalConnector = new MyCilinder(scene, 12, 1, this.horizontalRadius, 1, true);

    // Create wooden post appearance
    this.postAppearance = new CGFappearance(this.scene);
    this.postAppearance.setAmbient(0.48, 0.32, 0.16, 1.0);
    this.postAppearance.setDiffuse(0.72, 0.54, 0.36, 1.0);
    this.postAppearance.setSpecular(0.04, 0.04, 0.04, 1.0);
    this.postAppearance.setShininess(4.0);

    // Generate fence posts positions
    this.fencePosts = this.generateFencePosts();
  }

  generateFencePosts() {
    const posts = [];
    const circumference = 2 * Math.PI * this.fenceRadius;
    const numPostsRaw = circumference / this.postSpacing;
    const numPosts = Math.ceil(numPostsRaw);
    this.fullPostCount = numPosts;

    for (let i = 0; i < numPosts; i++) {
      const angle = (i / numPosts) * 2 * Math.PI;

      // Check if this angle is within an opening
      let isInOpening = false;
      for (const [startAngle, endAngle] of this.openingAngles) {
        if (startAngle < endAngle) {
          if (angle >= startAngle && angle <= endAngle) {
            isInOpening = true;
            break;
          }
        } else {
          // Opening wraps around 0/2π
          if (angle >= startAngle || angle <= endAngle) {
            isInOpening = true;
            break;
          }
        }
      }

      if (!isInOpening) {
        const x = this.centerX + this.fenceRadius * Math.cos(angle);
        const z = this.centerZ + this.fenceRadius * Math.sin(angle);
        
        // Skip posts only if in path ring; allow posts in barn area only
        if (this.terrain?.isPointInPathRing && this.terrain.isPointInPathRing(x, z, this.pathClearance)) {
          continue;
        }
        
        // store tangent (angle + 90deg) so posts/rails can align tangent to circle
        const tangent = angle + Math.PI / 2;
        posts.push({ x, y: undefined, z, angle, tangent, index: i });
      }
    }

    return posts;
  }

  getTerrainHeight(x, z) {
    // Sample terrain height at given x, z coordinates
    if (this.terrain && typeof this.terrain.getHeightAt === 'function') {
      return this.terrain.getHeightAt(x, z);
    }
    return 0;
  }

  constrainCamera(cameraPosition) {
    for (const post of this.fencePosts) {
      const dx = cameraPosition[0] - post.x;
      const dz = cameraPosition[2] - post.z;
      const distanceSquared = dx * dx + dz * dz;
      const radius = this.postRadius + this.baseHeight + this.pathClearance;

      if (distanceSquared > 0 && distanceSquared < radius * radius) {
        const distance = Math.sqrt(distanceSquared);
        const scale = radius / distance;
        cameraPosition[0] = post.x + dx * scale;
        cameraPosition[2] = post.z + dz * scale;
      }
    }
  }

  display() {

    this.postAppearance.apply();

    for (let i = 0; i < this.fencePosts.length; i++) {
      const post = this.fencePosts[i];

      if (post.y === undefined) {
        post.y = this.getTerrainHeight(post.x, post.z);
      }

      const terrainHeight = post.y;

      // Draw vertical post with base, rotated so the post's local X aligns
      // with the tangent direction (keeps rails and posts consistently tangent).
      this.scene.pushMatrix();
      this.scene.translate(post.x, terrainHeight, post.z);
      if (typeof post.tangent === 'number') this.scene.rotate(-post.tangent, 0, 1, 0);

      // Draw post base at ground level
      this.basePrimitive.display();

      // Draw vertical post standing on top of the base
      this.scene.translate(0, this.baseHeight, 0);
      this.postPrimitive.display();

      this.scene.popMatrix();

      // Draw horizontal connectors to next post at multiple heights
      const nextPost = this.fencePosts[(i + 1) % this.fencePosts.length];

      // Avoid connecting rails across openings (indices are discontinuous there)
      const isConsecutive = ((post.index + 1) % this.fullPostCount) === nextPost.index;
      if (!isConsecutive) continue;

      const nextTerrainHeight = this.getTerrainHeight(nextPost.x, nextPost.z);

      const midX = (post.x + nextPost.x) / 2;
      const midZ = (post.z + nextPost.z) / 2;

      const distance = Math.sqrt(
        (nextPost.x - post.x) ** 2 + (nextPost.z - post.z) ** 2
      );

      // Use this post's tangent so the rail is perpendicular to the radius
      // from the barn center to the pole position.
      const tangentAngle = post.tangent + 0.086;

      const avgTerrainHeight = (terrainHeight + nextTerrainHeight) / 2;

      // Draw lower horizontal rail
      const lowerRailHeight = avgTerrainHeight + this.baseHeight + this.postHeight * 0.55;
      this.scene.pushMatrix();
      this.scene.translate(midX, lowerRailHeight, midZ);
      this.scene.rotate(-tangentAngle, 0, 1, 0);
      this.scene.rotate(-Math.PI / 2, 0, 0, 1);
      this.scene.scale(1, distance, 1);
      this.horizontalConnector.display();
      this.scene.popMatrix();

      // Draw upper horizontal rail
      const upperRailHeight = avgTerrainHeight + this.baseHeight + this.postHeight * 0.86;
      this.scene.pushMatrix();
      this.scene.translate(midX, upperRailHeight, midZ);
      this.scene.rotate(-tangentAngle, 0, 1, 0);
      this.scene.rotate(-Math.PI / 2, 0, 0, 1);
      this.scene.scale(1, distance, 1);
      this.horizontalConnector.display();
      this.scene.popMatrix();
    }
  }
}
