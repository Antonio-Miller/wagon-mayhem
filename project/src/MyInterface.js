import {CGFinterface, dat} from '../../lib/CGF.js';

/**
 * MyInterface
 * DAT.gui HUD + keyboard state tracking for wagon controls.
 */
export class MyInterface extends CGFinterface {
    constructor() {
        super();
    }

    init(application) {
        super.init(application);

        // Make the scene's camera the interface active camera
        // Make the scene's camera the interface active camera.
        if (this.scene && this.scene.camera) this.setActiveCamera(this.scene.camera);

        // ── GUI ──────────────────────────────────────────────
        this.gui = new dat.GUI();
        this.gui.add(this.scene, 'displayAxis').name('Display Axis');
        this.gui.add(this.scene, 'sunEnabled').name('Sun On');
        this.gui.add(this.scene, 'timeOfDay', 0, 24).name('Time of Day').step(0.5).listen();
        this.gui.add(this.scene, 'grassAmount', 0.25, 1.0).name('Grass Amount').step(0.05)
            .onFinishChange((value) => {
                if (this.scene && typeof this.scene.setGrassAmount === 'function') {
                    this.scene.setGrassAmount(value);
                }
            });
        this.gui.add(this.scene, 'renderDistance', 250, 1200).name('Render Distance').step(25)
            .onFinishChange((value) => {
                if (this.scene && typeof this.scene.setRenderDistance === 'function') {
                    this.scene.setRenderDistance(value);
                }
            });
        // Actor selection removed; Wagon is the only actor

        // ── Keyboard state ───────────────────────────────────
        // Game keys: WASD (movement), P (pickup), L (drop), R (reset)
        const gameKeys = ['w', 'a', 's', 'd', 'p', 'l', 'r'];
        // Forward player controls to the scene. The active camera is passive,
        // so mouse input no longer changes gameplay state.
        const self = this;

        document.onkeydown = function (ev) {
            const key = (ev && ev.key) ? ev.key.toLowerCase() : '';
            const code = ev && ev.code ? ev.code : '';

            if (code === 'Escape' || key === 'escape') {
                if (self.scene && typeof self.scene.togglePause === 'function') {
                    self.scene.togglePause();
                }
                ev.preventDefault();
                return;
            }

            if (gameKeys.indexOf(key) !== -1) {
                if (self.scene) self.scene.keys[code] = true;
            }
            if (key === ' ' || code === 'Space') {
                if (self.scene) self.scene.keys.Space = true;
            }

            if (gameKeys.indexOf(key) !== -1 || key === ' ' || code === 'Space') {
                if (self.scene && typeof self.scene.handleControlKeyDown === 'function') {
                    self.scene.handleControlKeyDown(ev);
                }
                ev.preventDefault();
            } else if (code === 'ShiftLeft' || code === 'ShiftRight' || key === 'shift') {
                if (self.scene && typeof self.scene.cycleCameraMode === 'function') {
                    self.scene.cycleCameraMode();
                }
                ev.preventDefault();
            }
        };

        document.onkeyup = function (ev) {
            const key = (ev && ev.key) ? ev.key.toLowerCase() : '';
            const code = ev && ev.code ? ev.code : '';

            if (gameKeys.indexOf(key) !== -1) {
                if (self.scene) self.scene.keys[code] = false;
            }
            if (key === ' ' || code === 'Space') {
                if (self.scene) self.scene.keys.Space = false;
            }

            if (gameKeys.indexOf(key) !== -1 || key === ' ' || code === 'Space') {
                if (self.scene && typeof self.scene.handleControlKeyUp === 'function') {
                    self.scene.handleControlKeyUp(ev);
                }
                ev.preventDefault();
            }
        };

        return true;
    }
}
