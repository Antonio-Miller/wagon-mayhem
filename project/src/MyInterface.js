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
        // Make the scene's camera the interface active camera (first-person)
        if (this.scene && this.scene.camera) this.setActiveCamera(this.scene.camera);
        
        // init GUI. For more information on the methods, check:
        // https://github.com/dataarts/dat.gui/blob/master/API.md
        this.gui = new dat.GUI();

        //Checkbox element in GUI
        this.gui.add(this.scene, 'displayAxis').name('Display Axis');
        this.gui.add(this.scene, 'sunEnabled').name('Sun On');
        this.gui.add(this.scene, 'timeOfDay', 0, 24).name('Time of Day').step(0.5);

        // Ensure only WASD keys are forwarded to the scene/interface key handlers
        // so browser shortcuts (Ctrl/Shift/F12, etc.) are not intercepted.
        const self = this;
        document.onkeydown = function(ev) {
            const k = (ev && ev.key) ? ev.key.toLowerCase() : '';
            if (['w','a','s','d'].indexOf(k) !== -1) {
                console.log('MyInterface: WASD keydown', k);
                self.processKeyDown(ev);
                if (self.activeCamera && typeof self.activeCamera.onKeyDown === 'function') {
                    try { console.log('MyInterface: forwarding keydown to activeCamera', k); self.activeCamera.onKeyDown(ev); } catch (e) { console.error(e); }
                }
            }
        };
        document.onkeyup = function(ev) {
            const k = (ev && ev.key) ? ev.key.toLowerCase() : '';
            if (['w','a','s','d'].indexOf(k) !== -1) {
                console.log('MyInterface: WASD keyup', k);
                self.processKeyUp(ev);
                if (self.activeCamera && typeof self.activeCamera.onKeyUp === 'function') {
                    try { console.log('MyInterface: forwarding keyup to activeCamera', k); self.activeCamera.onKeyUp(ev); } catch (e) { console.error(e); }
                }
            }
        };

        return true;
    }
}