import {CGFinterface, dat} from '../../lib/CGF.js';

/**
* MyInterface
* @constructor
*/
export class MyInterface extends CGFinterface {
    constructor() {
        super();
    }

    init(application) {
        // call CGFinterface init
        super.init(application);
        // Make the scene's camera the interface active camera.
        if (this.scene && this.scene.camera) this.setActiveCamera(this.scene.camera);
        
        // init GUI. For more information on the methods, check:
        // https://github.com/dataarts/dat.gui/blob/master/API.md
        this.gui = new dat.GUI();

        //Checkbox element in GUI
        this.gui.add(this.scene, 'displayAxis').name('Display Axis');
        this.gui.add(this.scene, 'sunEnabled').name('Sun On');
        this.gui.add(this.scene, 'timeOfDay', 0, 24).name('Time of Day').step(0.5);

        // Forward player controls to the scene. The active camera is passive,
        // so mouse input no longer changes gameplay state.
        const self = this;
        document.onkeydown = function(ev) {
            const key = (ev && ev.key) ? ev.key.toLowerCase() : '';
            const code = ev && ev.code ? ev.code : '';
            // Player movement keys + camera mode (Shift) handling
            if (['w','a','s','d'].indexOf(key) !== -1 || key === ' ' || code === 'Space') {
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
        document.onkeyup = function(ev) {
            const key = (ev && ev.key) ? ev.key.toLowerCase() : '';
            const code = ev && ev.code ? ev.code : '';
            if (['w','a','s','d'].indexOf(key) !== -1 || key === ' ' || code === 'Space') {
                if (self.scene && typeof self.scene.handleControlKeyUp === 'function') {
                    self.scene.handleControlKeyUp(ev);
                }
                ev.preventDefault();
            }
        };

        return true;
    }
}