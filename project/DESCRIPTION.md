# CGRA 2025/2026 — Final Project: Complete Technical Guide

**Course:** Computação Gráfica / Computer Graphics · L.EIC, 3rd Year  
**Institution:** Faculdade de Engenharia da Universidade do Porto  

| Field | Details |
|-------|---------|
| Theme | Spring Prairie Survival Game |
| Team | Groups of 3 students |
| Stack | WebCGF · WebGL · GLSL · DAT.gui |
| Deadline | 29 May 2026 (Moodle) |
| Presentation | Week 13 · 1 June 2026 |
| Total Marks | 20 points |

*Version 1.0 draft · 20th April 2026*

---

## Table of Contents

1. [What Is This Project?](#1-what-is-this-project)
2. [The Game Loop — How It Works](#2-the-game-loop--how-it-works)
3. [Architecture — Code Structure](#3-architecture--code-structure)
   - [3.1 Scene Graph Overview](#31-scene-graph-overview)
   - [3.2 Key Design Principles](#32-key-design-principles)
4. [Directory Structure](#4-directory-structure)
5. [The 5 Weekly Phases](#5-the-5-weekly-phases)
   - [Phase 1 – Sky, Sun & Clouds](#phase-1--sky-sun--clouds)
   - [Phase 2 – Terrain, Ground & Scatter](#phase-2--terrain-ground--scatter)
   - [Phase 3 – Flora: Flowers & Grass](#phase-3--flora-flowers--grass)
   - [Phase 4 – Wagon + Interaction + Animation](#phase-4--wagon--interaction--animation)
   - [Phase 5 – Collectable System + Full UI](#phase-5--collectable-system--full-ui)
6. [Shader System](#6-shader-system)
7. [Collision Detection](#7-collision-detection)
8. [Evaluation Strategy](#8-evaluation-strategy)
9. [Delivery Checklist](#9-delivery-checklist)

---

## 1. What Is This Project?

This is a WebGL-based 3D interactive game built from scratch for the Computer Graphics course at FEUP.

You are building a **survival game set in a spring prairie**, where the player drives a covered wagon (prairie schooner) around a field, collecting hay bales and returning them to a barn to stay alive. The score is simply how long you survive.

The tech stack is **WebCGF** (the WebGL framework used throughout the practical classes), vanilla JavaScript, GLSL shaders, and DAT.gui for the HUD.

### Core Entities

| Entity | Description |
|--------|-------------|
| **Prairie / Terrain** | Height-mapped ground with rolling hills, soil textures, pathway, rocks, flowers, and grass patches. |
| **Sky Dome** | Large inverted half-sphere with panoramic texture. Animated cloud layer. Directional sun light. |
| **Covered Wagon** | Hierarchical 3D model (body, cover, tongue, 4 wheels, horse). Player-controlled entity. |
| **Barn** | Static structure — the start point and delivery destination for hay bales. |
| **Hay Bales** | Collectables spawned randomly. Visible only when near. A bouncing arrow always marks them. |
| **Rocks** | Scatter obstacles. Collision causes HP damage. Multiple textures + vertex perturbation. |

### Project Timeline at a Glance

The project spans **5 development weeks** (Week 8 → Week 12) plus a presentation in Week 13. Each week has a mandatory Git tag and required screenshots to demonstrate incremental progress.

---

## 2. The Game Loop — How It Works

Every animation frame WebCGF calls `update(deltaTime)` and then `display()`. The game logic lives entirely in `update`; rendering lives in `display`. The sequence below runs 60 times per second:

```
FRAME LOOP (60 fps)
│
├─ 1. READ INPUT
│     W / A / S / D / P / L key states
│
├─ 2. UPDATE PHYSICS
│     Apply steering angle → update heading
│     Move wagon forward by speed × deltaTime
│     Rotate all 4 wheels proportionally
│
├─ 3. COLLISION DETECTION
│     Wagon vs. Rocks      → subtract 5–15 HP (random)
│     Wagon vs. Hay Bale   → capture (max 2 aboard)
│     Wagon vs. Barn Zone  → deposit bales, restore HP
│
├─ 4. HEALTH TICK
│     HP -= 1 × deltaTime (passive drain)
│     if HP ≤ 0 → GAME OVER, freeze score
│
├─ 5. SPAWN LOGIC
│     if activeBales.length < MAX_BALES → spawn new
│
├─ 6. RENDER SCENE
│     Sky → Terrain → Ground → Flora → Entities
│
└─ 7. UPDATE DAT.GUI
      HP bar · damage flash · bale count · score timer
```

### Health Point Economy

> These reference values require tuning per implementation — they are starting points, not hard rules.

| Event | HP Change | Notes |
|-------|-----------|-------|
| Starting HP | 100 HP | Wagon begins here every game |
| Passive drain | –1 HP/sec | Constant pressure to collect bales |
| Rock collision | –5 to –15 HP | Random, each collision event |
| Hay bale delivery | +50 HP | Per bale deposited at barn |
| Wagon capacity | max 2 bales | Must return to barn to reload |

---

## 3. Architecture — Code Structure

### 3.1 Scene Graph Overview

The project follows the scene graph / component pattern that WebCGF enforces. Every visual object is a class with a `display()` method. A root `MyScene` orchestrates them all.

```
MyScene (root)
├── MyInterface          DAT.gui HUD bindings
├── GameState            HP · score · bale list · game-over flag
│
├── ENVIRONMENT LAYER
│   ├── MySky            half-sphere, inward normals, sky texture
│   ├── MySun            directional light / spotlight
│   └── MyClouds         animated second texture layer
│
├── TERRAIN LAYER
│   ├── MyTerrain        height-mapped subdivided mesh
│   └── MyGround         flat soil texture + wagon pathway
│
├── SCATTER LAYER
│   ├── MyRock[]         vertex-perturbed spheres, ~20–40 instances
│   ├── MyFlower[]       parametric + randomised, ~50–100 instances
│   └── MyGrass[]        dense + dead patches, wind shader
│
├── GAME ENTITIES
│   ├── MyBarn           cube body + prism roof + textures
│   ├── MyWagon          hierarchical, animated
│   │   ├── MyWagonBody
│   │   ├── MyWagonCover     (half-length, over rear)
│   │   ├── MyWagonTongue    (front, rotates with steering)
│   │   │   ├── FrontAxle    (pivot at centre)
│   │   │   ├── MyWheel (left)
│   │   │   └── MyWheel (right)
│   │   ├── RearAxle         (fixed)
│   │   │   ├── MyWheel (left)
│   │   │   └── MyWheel (right)
│   │   └── MyHorse          (OBJ import)
│   └── MyHayBale[]      spawned randomly · arrow child
│
└── SHADERS
    ├── grassShader      wind animation on grass blades
    └── arrowShader      vertical bobbing on hay bale arrows
```

### 3.2 Key Design Principles

**Scene Graph Transforms**  
Every object only knows its local position. The wagon's wheels are children of the wagon, so moving the wagon automatically repositions them. The front axle is a pivot child of the tongue — steering the tongue steers the axle.

**GameState Singleton**  
A plain JS object (or class) holds all mutable game data: HP, score, bale inventory, game-over flag. The scene reads from it each frame; state is never scattered across individual objects.

**Collision as Distance Check**  
No physics engine needed. Each frame: `dist = sqrt((ax-bx)² + (az-bz)²)`. If `dist < (rA + rB)` → collision. All collidable objects store a radius. O(n) with n < 50 objects — perfectly fast.

**Shader Uniform `uTime`**  
Both required shaders need a time variable. `MyScene.update()` calls `shader.setUniformsValues({uTime: this.time})` every frame, which drives the grass wind wave and the arrow vertical bobbing.

---

## 4. Directory Structure

Follow this layout from day one. It maps directly to the scene graph and makes code review, peer merges, and final ZIP packaging straightforward.

```
project-t<class>g<group>/
│
├── index.html           ← entry point, loads WebCGF + your scene
├── README.md            ← required deliverable
│
├── lib/
│   └── webCGF/          ← provided framework (DO NOT EDIT)
│
├── src/
│   ├── MyScene.js       ← root: init · update · display
│   ├── MyInterface.js   ← DAT.gui setup
│   ├── GameState.js     ← HP · score · bales · game-over
│   │
│   ├── environment/
│   │   ├── MySky.js
│   │   ├── MySun.js
│   │   └── MyClouds.js
│   │
│   ├── terrain/
│   │   ├── MyTerrain.js     ← height-map mesh
│   │   └── MyGround.js      ← soil + pathway
│   │
│   ├── scatter/
│   │   ├── MyRock.js
│   │   ├── MyFlower.js
│   │   └── MyGrass.js
│   │
│   ├── entities/
│   │   ├── MyBarn.js
│   │   ├── MyWagon.js       ← top-level wagon controller
│   │   ├── MyWagonBody.js
│   │   ├── MyWagonCover.js
│   │   ├── MyWagonTongue.js
│   │   ├── MyWheel.js
│   │   └── MyHayBale.js     ← includes arrow child
│   │
│   ├── primitives/
│   │   ├── MyCylinder.js
│   │   ├── MySphere.js
│   │   ├── MyPlane.js
│   │   └── MyOBJModel.js    ← horse OBJ import
│   │
│   └── shaders/
│       ├── grass.vert / grass.frag
│       └── arrow.vert / arrow.frag
│
├── textures/
│   ├── sky_panorama.jpg  clouds.png
│   ├── soil.jpg  soil_dry.jpg  pathway.jpg
│   ├── wood_plank.jpg  wood_dark.jpg  barn_windows.png
│   ├── rock_1.jpg  rock_2.jpg  rock_3.jpg
│   ├── grass_dense.jpg  grass_dead.jpg
│   └── flower_*.png (multiple flower textures)
│
├── models/
│   └── horse.obj            ← OBJ model for mule / horse
│
└── screenshots/
    ├── project-t<>g<>-1.png (overall scene)
    ├── project-t<>g<>-2.png (floor/rocks/flowers)
    ├── project-t<>g<>-3.png (wagon close-up)
    ├── project-t<>g<>-4.gif (shader animation GIF)
    └── project-t<>g<>-5.png (5th screenshot)
```

---

## 5. The 5 Weekly Phases

Each phase builds directly on the previous one. Build each layer solid before moving to the next — commit often.

---

### Phase 1 – Sky, Sun & Clouds
**Git tag:** `environment`

Before anything game-related, the world needs to exist. This phase creates your blank canvas: the sky dome, sun light, and optional animated clouds.

**What to build:**

- **MySky:** half-sphere mesh (radius ~200), normals flipped inward, sky panorama texture, emissive material (no lighting applied to it).
- **MySun:** CGFlight configured as directional, warm colour `(0.9, 0.85, 0.7)`, positioned at a high angle.
- **MyClouds *(Advanced)*:** second sphere slightly smaller than sky, cloud texture with alpha blending, texture matrix animated — `U offset += cloudSpeed × deltaTime`.

> **Testing checkpoint:** Sky sphere visible from inside. Sun tints the scene warm. Cloud layer visibly drifts (advanced).

---

### Phase 2 – Terrain, Ground & Scatter
**Git tag:** `terrain`

The ground the game is actually played on, plus the obstacles.

**What to build:**

- **MyTerrain:** subdivided plane (e.g. 100×100 quads). Height map texture sampled in the vertex shader — each vertex `Y = heightmap_sample × max_height`. Smooth normals recalculated.
- **MyGround:** soil texture (UV tiled). Pathway as a lighter dirt-coloured strip. Dry dirt patches blended as a second texture layer.
- **MyRock (×20–40 instances):** sphere with vertex perturbation. Each instance gets random scale, rotation, position. Three different rock textures cycled through. Collision radius stored in `GameState.rocks[]`.

**Collision data setup:**

```javascript
// At scene init — populate collision array
GameState.rocks = [];
for (let rock of this.rockInstances) {
    GameState.rocks.push({
        x: rock.position.x,
        z: rock.position.z,
        radius: rock.scale * 1.5 // approximate
    });
}
```

> **Testing checkpoint:** Rolling terrain, rocks scattered, pathway visible. Test distance formula in console with one rock.

---

### Phase 3 – Flora: Flowers & Grass
**Git tag:** `flora`

Visual richness. This is what makes the prairie feel alive and earns significant marks for scene complexity and aesthetics.

**MyFlower — parametric construction:**

```javascript
// Per-instance randomised parameters
stemHeight  = random(0.3, 0.8)
petalCount  = random(4, 8)
petalColour = randomWarmHue()
scale       = random(0.5, 1.5)
position    = randomXZ(terrain)

// Hierarchy
Stem   → MyCylinder(radius=0.03, height=stemHeight)
Petals → N planes, each rotated (360/N × i)° around Y
Centre → MySphere(radius=0.08)
```

**MyGrass — wind shader concept:**

```glsl
// grass.vert — key lines
uniform float uTime;
attribute vec3 aPosition;

float windStrength = 0.15;
float windFreq     = 2.0;

// Only the top of each blade (high Y) sways
float wave = sin(uTime * windFreq + aPosition.x * 0.5)
           * windStrength
           * aPosition.y;

vPosition.x += wave;
```

> **Testing checkpoint:** Prairie looks naturally populated. Grass visibly sways. Flowers vary noticeably between instances.

---

### Phase 4 – Wagon + Interaction + Animation
**Git tag:** `interaction`

The player-controlled entity and its full hierarchical model. The most complex single object in the project.

**Steering & movement model:**

```javascript
// Input handling
if (keysDown['w']) speed = Math.min(speed + accel * dt, MAX_SPEED);
if (keysDown['s']) speed = Math.max(speed - decel * dt, 0);
if (keysDown['a']) steerAngle -= STEER_RATE * dt;
if (keysDown['d']) steerAngle += STEER_RATE * dt;
steerAngle = clamp(steerAngle, -MAX_STEER, MAX_STEER);

// Physics update
heading += steerAngle * (speed / WHEELBASE) * dt;
wagon.x += Math.cos(heading) * speed * dt;
wagon.z += Math.sin(heading) * speed * dt;

// Wheel rotation
wheelAngle += (speed / WHEEL_RADIUS) * dt;
// Apply as pushMatrix → rotate(wheelAngle, X-axis) → draw wheel
```

**Key bindings reference:**

| Key | Action | Notes |
|-----|--------|-------|
| W | Accelerate forward | Up to horse walk speed |
| S | Reduce speed / brake | Does not reverse |
| A | Steer front wheels left | Smooth interpolation |
| D | Steer front wheels right | Smooth interpolation |
| P | Hay bale pick-up | Only when within capture radius AND bales < 2 |
| L | Hay bale drop | Drops at current wagon position |

> **Testing checkpoint:** Wagon drives, turns smoothly, all 4 wheels spin correctly, front axle rotates with steering. Horse moves with wagon.

---

### Phase 5 – Collectable System + Full UI
**Git tag:** `gameplay` → `final`

Everything that makes it an actual game: the collectable loop, HP economy, barn delivery zone, and DAT.gui HUD.

**GameState schema:**

```javascript
GameState = {
    hp: 100,                  // current health points
    score: 0,                 // seconds elapsed (stops on game over)
    balesAboard: [],          // max length 2
    totalBalesDelivered: 0,   // cumulative count
    lastDamage: 0,            // shown in HUD (flash on hit)
    lastHeal: 0,              // shown in HUD (flash on delivery)
    gameOver: false
};
```

**Barn delivery zone logic:**

```javascript
// In MyScene.update()
const barnZone = { x: BARN_X, z: BARN_Z, radius: 5.0 };

if (dist(wagon.pos, barnZone) < barnZone.radius) {
    barnCircle.color = GREEN; // visual feedback
    for (const bale of wagon.balesAboard) {
        GameState.hp += bale.hpValue;
        GameState.lastHeal = bale.hpValue;
        GameState.totalBalesDelivered++;
    }
    wagon.balesAboard = [];
} else {
    barnCircle.color = WHITE;
}
```

**DAT.gui HUD elements:**

| GUI Element | Type | Behaviour |
|-------------|------|-----------|
| HP | Numeric bar 0–100 | Decreases passively; updates every frame |
| Last Damage | Numeric readout | Flashes briefly on rock collision |
| Last Heal | Numeric readout | Flashes briefly on bale delivery |
| Bales Aboard | Numeric 0–2 | Current wagon payload |
| Total Bales | Numeric, cumulative | All bales ever delivered |
| Score (s) | Numeric, counts up | Stops when game over |

> **Testing checkpoint:** Full game loop end-to-end. Survive, collect, deliver, die from rocks or time. Score displayed correctly.

---

## 6. Shader System

Both required shaders share the same WebCGF integration pattern. The scene passes a `uTime` uniform every frame, and each object activates its shader only during its own draw call.

**WebCGF shader integration pattern:**

```javascript
// 1. Create shader (once, in MyScene.init)
this.grassShader = new CGFshader(
    this.gl, 'src/shaders/grass.vert', 'src/shaders/grass.frag'
);

// 2. Update uTime every frame (in MyScene.update)
this.grassShader.setUniformsValues({ uTime: this.time });

// 3. Activate during draw (in MyGrass.display)
scene.setActiveShader(scene.grassShader);
// ... draw grass geometry ...
scene.setActiveShader(scene.defaultShader); // restore!
```

### Grass Wind Shader

```glsl
// grass.vert
attribute vec3 aPosition;
attribute vec2 aTexCoord;
uniform mat4 uMVMatrix, uPMatrix;
uniform float uTime;

void main() {
    vec4 pos = vec4(aPosition, 1.0);
    // Wave only affects the top of the blade (high Y values)
    float sway = sin(uTime * 2.0 + aPosition.x * 0.5) * 0.15;
    pos.x += sway * aPosition.y;
    gl_Position = uPMatrix * uMVMatrix * pos;
}
```

### Arrow Bobbing Shader

```glsl
// arrow.vert
attribute vec3 aPosition;
uniform mat4 uMVMatrix, uPMatrix;
uniform float uTime;

void main() {
    vec4 pos = vec4(aPosition, 1.0);
    // Vertical sine bob
    pos.y += sin(uTime * 3.0) * 0.3;
    gl_Position = uPMatrix * uMVMatrix * pos;
}

// arrow.frag — pulse the colour for extra visibility
uniform float uTime;

void main() {
    float pulse = 0.5 + 0.5 * sin(uTime * 4.0);
    gl_FragColor = vec4(1.0, pulse * 0.8, 0.0, 1.0); // orange pulse
}
```

---

## 7. Collision Detection

All collision detection uses a single formula applied to flat (XZ plane) distances. No physics engine is needed.

```javascript
// Distance between two objects (XZ plane only — ignore Y)
function dist2D(a, b) {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx*dx + dz*dz);
}

// Collision check
if (dist2D(wagon.pos, rock.pos) < (WAGON_RADIUS + rock.radius)) {
    // COLLISION OCCURRED
    const dmg = 5 + Math.floor(Math.random() * 11); // 5–15
    GameState.hp -= dmg;
    GameState.lastDamage = dmg;
}
```

**Collision radii reference:**

| Object | Radius | Notes |
|--------|--------|-------|
| Wagon | ~2.0 units | Half the wagon width |
| Rock (small) | ~1.0–1.5 | Scaled with rock instance |
| Rock (large) | ~2.0–3.0 | Scaled with rock instance |
| Hay Bale | ~1.0 units | Capture range |
| Barn Zone | ~5.0 units | Delivery area radius |

Store all collidable objects in a flat array at scene init. Iterate every frame. With fewer than 50 objects, this is O(n) and adds negligible cost even at 60 fps.

---

## 8. Evaluation Strategy

The grading rubric awards **20 points** across 7 criteria.

| # | Criterion | Weight | Key to Scoring Well |
|---|-----------|--------|---------------------|
| 1 | Explicit and procedural modelling | 4.0 | Wagon hierarchy, parametric flowers, vertex-perturbed rocks |
| 2 | Lighting, materials, and textures | 4.0 | Sun setup, rock/wood/soil textures, material configs |
| 3 | Overall scene and entity complexity | 3.0 | All scene layers present and populated |
| 4 | Animated entities | 3.0 | Wheels, steering pivot, arrow bobbing, cloud drift |
| 5 | Advanced effects through shaders | 3.0 | Grass wind shader + arrow bobbing shader |
| 6 | Aesthetics and creativity | 2.0 | Visual coherence, colour harmony, texture variety |
| 7 | Software quality | 1.0 | Modular classes, comments, clean structure |
| | **TOTAL** | **20.0** | |

> ⚠️ **Biggest risk:** Criteria 1 and 2 (modelling + textures) together are worth **8 out of 20 points**. Get visual fidelity right before chasing advanced features.

---

## 9. Delivery Checklist

### Weekly Git Tags & Screenshots

| Week | Tasks | Git Tag | Screenshots |
|------|-------|---------|-------------|
| Week 8 | Sky, sun, clouds | `environment` | 2 |
| Week 9 | Terrain, ground, scatter | `terrain` | 2 |
| Week 10 | Flowers and grass | `flora` | 2 |
| Week 11 | Wagon + interaction + animation | `interaction` | 2 |
| Week 12 | Collectable system + UI | `gameplay` | 2 |
| Week 12 | README, video, final screenshots | `final` | 5 + 1 video |
| Week 13 | Project presentation | — | — |

### Moodle Submission Files

Submit all of the following via Moodle. **Follow naming conventions exactly** — wrong names may result in the submission not being graded.

| Filename | Type | Content Required |
|----------|------|-----------------|
| `project-t<X>g<Y>-N.zip` | Source ZIP | Source code + webCGF lib + README.md |
| `project-t<X>g<Y>-1.png` | Screenshot 1 | Overall scene overview, wide angle |
| `project-t<X>g<Y>-2.png` | Screenshot 2 | Floor / rocks / flowers detail |
| `project-t<X>g<Y>-3.png` | Screenshot 3 | Wagon close-up, textures visible |
| `project-t<X>g<Y>-4.gif` | Screenshot 4 | Animated GIF of a shader effect |
| `project-t<X>g<Y>-5.png` | Screenshot 5 | Your choice — highlight something |
| `project-t<X>g<Y>.mp4` | Video | 1 min, H.264, screen capture demo |

### README.md Required Sections

- Project title, class section, and all group members (full name + student number)
- Brief description of the scene and features implemented
- Instructions to run the project (dependencies, how to launch in browser)
- Keyboard controls reference table
- List of implemented features — note which advanced/bonus features were attempted
- Known issues or limitations (if any)
- Screenshot thumbnails or links to the 5 required screenshots
- **Declaration on AI use:** to what extent and for what purpose

### Video Demo Requirements (1 minute, MP4, H.264)

- A tour of the full scene (terrain, sky, flora, barn)
- Wagon movement and animation — keyboard control, turning, wheel spin
- Pick-up and delivery of hay bales — full loop
- At least one shader in action (grass wind or arrow bobbing)

---

*Good luck — build something you're proud of!*