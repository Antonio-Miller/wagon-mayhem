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
        if (this.scene && this.scene.camera) this.setActiveCamera(this.scene.camera);

        // ── GUI ──────────────────────────────────────────────
        this.gui = new dat.GUI();
        this.gui.add(this.scene, 'displayAxis').name('Display Axis');
        this.gui.add(this.scene, 'sunEnabled').name('Sun On');
        this.gui.add(this.scene, 'timeOfDay', 0, 24).name('Time of Day').step(0.5);
        this.gui.add(this.scene, 'displayWagon').name('Show Wagon');

        // ── Keyboard state ───────────────────────────────────
        // Game keys: WASD (movement), P (pickup), L (drop), R (reset)
        const gameKeys = ['w', 'a', 's', 'd', 'p', 'l', 'r'];
        const self = this;

        document.onkeydown = function (ev) {
            const k = (ev && ev.key) ? ev.key.toLowerCase() : '';
            if (gameKeys.indexOf(k) !== -1) {
                // Write the key state onto the scene for the wagon to read
                if (self.scene) self.scene.keys[ev.code] = true;
                // NOTE: WASD now drives the wagon exclusively.
                // Camera movement uses mouse (orbit / zoom / pan via CGFinterface).
            }
        };

        document.onkeyup = function (ev) {
            const k = (ev && ev.key) ? ev.key.toLowerCase() : '';
            if (gameKeys.indexOf(k) !== -1) {
                if (self.scene) self.scene.keys[ev.code] = false;
            }
        };

        return true;
    }
}
