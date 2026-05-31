# Wagon Mayhem

Final project for CGRA 2025/2026 at FEUP.

## Team

- António Miller - up202008423
- José Reis - up202307304

## Project Summary

Wagon Mayhem is a spring prairie survival game built with WebCGF, WebGL, GLSL and DAT.gui. The player drives a covered wagon across a prairie, collects hay bales, avoids rocks and trees, and returns bales to the barn to recover health.

The scene is organized as a layered world with a sky dome, animated clouds, terrain, grass, flowers, rocks, trees, a barn, hay bales and the wagon itself. Most objects are procedural or data-driven so the scene can be populated consistently while keeping the code modular.

## Development Phases

### Phase 1 - Environment

The first phase established the world backdrop: the sky dome, sun lighting and animated clouds. The goal here was to create an atmospheric scene before adding gameplay objects.

Implemented ideas:

- Sky dome with inward-facing geometry and a panoramic texture.
- Directional sunlight with warm color to simulate late afternoon prairie light.
- Cloud layer that drifts over time for a sense of motion.

Main result: a complete outdoor environment that already looked coherent even before gameplay was added.

Screenshots:

- [environment_1.png](screenshots/environment_1.png)
- [environment_2.png](screenshots/environment_2.png)
- [environment_3.png](screenshots/environment_3.png)

### Phase 2 - Terrain, Ground and Scatter

This phase introduced the playable space and the first obstacle layer.

Implemented ideas:

- Height-mapped terrain sampled during rendering and placement.
- Ground and path composition to guide the player visually.
- Procedural scatter for rocks and trees with placement constraints.
- Collision and camera constraints so the environment behaved like a solid world instead of just a visual backdrop.

Main result: the prairie started functioning as a navigable level instead of a static scene.

Screenshots:

- [terrain_1.png](screenshots/terrain_1.png)
- [terrain_2.png](screenshots/terrain_2.png)

### Phase 3 - Flora

This phase focused on visual richness and performance-aware decoration.

Implemented ideas:

- Flowers built from configurable procedural parameters such as stem height, petal count, bloom radius and color variation.
- Grass patches rendered with a custom shader that reacts to time.
- Placement rules that keep flora away from the road and from existing objects.
- Distance culling to avoid drawing distant decorations unnecessarily.

Main result: the prairie gained density and life without collapsing performance.

Screenshots:

- [flora_1.png](screenshots/flora_1.png)
- [flora_2.png](screenshots/flora_2.png)

### Phase 4 - Wagon, Movement and Animation

This phase added the player-controlled wagon and the mechanical parts that make it believable.

Implemented ideas:

- Hierarchical wagon structure with body, cover, tongue, wheels and horse.
- Steering and forward motion tied to keyboard input.
- Wheel rotation driven by movement speed.
- Camera modes and orbit controls for inspection and gameplay.

Main result: the scene became interactive and the player could move through the world with a coherent vehicle model.

Screenshots:

- [interaction_1.png](screenshots/interaction_1.png)

### Phase 5 - Gameplay and UI

This phase added the survival loop and the final game-state layer.

Implemented ideas:

- Hay bale spawning and collection.
- Barn delivery area logic.
- Health, score and game-over state management.
- DAT.gui controls for debugging and feedback.
- Physics support for dynamically placed objects.

Main result: the project became a complete game with a clear objective and failure condition.

Screenshots:

- [gameplay_2.png](screenshots/gameplay_2.png)
- [final_1.png](screenshots/final_1.png)
- [final_2.png](screenshots/final_2.png)
- [final_3.png](screenshots/final_3.png)
- [final_4.png](screenshots/final_4.png)

## Technical Innovations

### OBJ Import Pipeline

The wagon horse uses a custom OBJ importer in [src/MyOBJModel.js](src/MyOBJModel.js). The loader is intentionally small and tailored to the project instead of relying on a full external asset pipeline.

How it works:

1. The OBJ file is read synchronously with XMLHttpRequest.
2. If the OBJ references a material library, the loader parses the MTL file first.
3. Materials are converted into CGF appearances using Ka, Kd, Ks and Ns values.
4. Texture paths are resolved relative to the material file with multiple fallbacks.
5. Faces are triangulated and split into submeshes by material.
6. Vertex data is deduplicated by the tuple position/texCoord/normal so the final buffers stay compact.
7. If the OBJ does not provide normals, they are computed from triangle geometry.
8. The final result is uploaded to WebGL buffers and rendered submesh by submesh.

This approach keeps the loader simple, material-aware and good enough for the imported horse model used by the wagon.

### Object Pooling

Reusable temporary data is managed through [src/utils/ObjectPool.js](src/utils/ObjectPool.js).

Why it exists:

- The scene creates many temporary arrays and small objects while culling, placing grass and generating scatter.
- Reusing these objects reduces garbage collection pressure in tight update and render loops.

How it works:

1. A generic `ObjectPool` pre-allocates a batch of objects.
2. `acquire()` returns a recycled object when available, or creates a new one if the pool is empty.
3. `release()` returns the object to the pool and resets its fields through a callback.
4. `releaseAll()` moves everything currently in use back to the available list.

Specialized pools are built on top of it:

- `Vec3Pool` for small 3D vectors.
- `Mat4Pool` for temporary matrices.
- `ArrayPool` for short-lived work arrays.
- `DistanceCheckPool` for collision and distance-test helper objects.

The result is a cleaner update loop and fewer unnecessary allocations during gameplay.

### Procedural Placement and Distribution

Scatter placement is centralized in [src/scatter/distribute.js](src/scatter/distribute.js).

Highlights:

- Poisson-disc style sampling is used to spread candidate positions across the prairie.
- Trees and rocks are distributed together so their spacing rules stay consistent.
- Forbidden regions from the terrain are respected so objects avoid roads and barn areas.
- The scatter sets consume precomputed positions instead of generating their own fallback placements.

This keeps scene composition predictable while still looking organic.

### Grass Shader Animation

Grass uses a dedicated shader and a time uniform.

- `uTime` is updated every frame from the scene.
- The vertex shader offsets blade geometry over time.
- Grass patches are also distance culled and LOD reduced when far away.

The visual effect is subtle, but it adds motion across the whole prairie and helps the scene feel alive.

### Performance-Oriented Rendering

Several small optimizations are used together:

- Distance culling for grass, flowers, rocks and trees.
- Lower grass density than the initial prototype to keep frame rate stable.
- Render distance controls exposed through the scene so the camera and world size stay in sync.
- Lazy placement of vegetation once the terrain heightmap is ready.

These changes keep the final scene responsive even with many instanced decorative objects.

## Controls

| Key | Action |
|-----|--------|
| W | Accelerate wagon |
| A | Steer left |
| S | Brake / stop |
| D | Steer right |
| P | Pick up nearest hay bale |
| L | Drop carried hay bale in the barn area |
| Shift | Cycle camera mode |
| N | Snap camera left / orbit left while held |
| M | Snap camera right / orbit right while held |
| Left mouse drag | Orbit camera sideways |
| R | Reset game when game over |
| Esc | Resume game |

## Run Instructions

1. Open the project folder in a browser-friendly local server.
2. Use the `project/index.html` entry point.
3. Start a server from the repository root or from `project/`.
4. Open the page in the browser and wait for the scene to finish loading.

If you are using the included `http-server`, launching it from the repository root and opening the project page is enough.

## Implemented Features

- Sky dome and animated clouds.
- Directional sun lighting.
- Height-based terrain.
- Terrain-aware road and barn area.
- Procedural rock and tree scatter.
- Procedural flowers.
- Grass with a custom time-based shader.
- Hierarchical wagon model.
- Imported horse model.
- Hay bale collection and delivery loop.
- Barn fence and collision boundaries.
- Health, score and game-over state.
- Camera orbit and follow behavior.
- Object pooling for temporary data.
- Material-aware OBJ loading.

## Screenshots

Existing project screenshots in this repository:

- [environment_1.png](screenshots/environment_1.png)
- [environment_2.png](screenshots/environment_2.png)
- [environment_3.png](screenshots/environment_3.png)
- [terrain_1.png](screenshots/terrain_1.png)
- [terrain_2.png](screenshots/terrain_2.png)
- [flora_1.png](screenshots/flora_1.png)
- [flora_2.png](screenshots/flora_2.png)
- [interaction_1.png](screenshots/interaction_1.png)
- [gameplay_2.png](screenshots/gameplay_2.png)
- [final_1.png](screenshots/final_1.png)
- [final_2.png](screenshots/final_2.png)
- [final_3.png](screenshots/final_3.png)
- [final_4.png](screenshots/final_4.png)
- [final.webm](screenshots/final.webm)



## Known Notes

- The scene is tuned for visual clarity and stable frame rate, so some decorative systems use culling and density limits.
- The OBJ importer is intentionally lightweight and focused on the assets used in this project.
