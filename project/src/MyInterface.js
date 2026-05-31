import {CGFinterface, dat} from '../../lib/CGF.js';

/**
 * MyInterface
 * DAT.gui HUD + keyboard state tracking for wagon controls.
 */
export class MyInterface extends CGFinterface {
    constructor() {
        super();
        this.menuOverlay = null;
        this.menuPanel = null;
        this.menuMode = 'menu';
    }

    init(application) {
        super.init(application);

        // Make the scene's camera the interface active camera
        // Make the scene's camera the interface active camera.
        if (this.scene && this.scene.camera) this.setActiveCamera(this.scene.camera);

        this.ensureMenuOverlay();
        this.showMainMenu();

        // ── GUI ──────────────────────────────────────────────
        this.gui = new dat.GUI();
        this.gui.domElement.style.display = 'none';
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

        // ── Game Status folder ───
        const gs = this.scene.gameState;
        if (gs) {
            const statusFolder = this.gui.addFolder('Game Status');

            // Current HP (numeric bar 0–100) — display-only
            const healthCtrl = statusFolder.add(gs, 'wagonHealth', 0, 100).name('Health (HP)').listen();
            try { if (healthCtrl.__li) healthCtrl.__li.style.pointerEvents = 'none'; } catch (e) {}

            // Instantaneous damage — display-only
            const dmgCtrl = statusFolder.add(gs, 'lastDamage').name('Last Damage').listen();
            try { if (dmgCtrl.__li) dmgCtrl.__li.style.pointerEvents = 'none'; } catch (e) {}

            // Instantaneous heal — display-only
            const healCtrl = statusFolder.add(gs, 'lastHeal').name('Last Heal').listen();
            try { if (healCtrl.__li) healCtrl.__li.style.pointerEvents = 'none'; } catch (e) {}

            // Total bales delivered — display-only
            const balesCtrl = statusFolder.add(gs, 'totalBalesDelivered').name('Bales Delivered').listen();
            try { if (balesCtrl.__li) balesCtrl.__li.style.pointerEvents = 'none'; } catch (e) {}

            // Score (elapsed seconds, formatted)
            Object.defineProperty(this.scene, '_guiScore', {
                get() {
                    const s = gs.score || 0;
                    const mins = Math.floor(s / 60);
                    const secs = Math.floor(s % 60);
                    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                },
                configurable: true,
            });
            const scoreCtrl = statusFolder.add(this.scene, '_guiScore').name('Score (time)').listen();
            try { if (scoreCtrl.__li) scoreCtrl.__li.style.pointerEvents = 'none'; } catch (e) {}

            statusFolder.open();
        }

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
                if (self.menuMode === 'controls') {
                    self.showMainMenu();
                    ev.preventDefault();
                    return;
                }
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

    ensureMenuOverlay() {
        if (this.menuOverlay) {
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = 'wagon-mayhem-menu';
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.zIndex = '1000';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.background = 'linear-gradient(180deg, rgba(8, 12, 18, 0.94), rgba(18, 24, 32, 0.88))';
        overlay.style.backdropFilter = 'blur(10px)';
        overlay.style.color = '#f6e7c1';
        overlay.style.fontFamily = 'Georgia, "Times New Roman", serif';

        const panel = document.createElement('div');
        panel.style.width = 'min(760px, calc(100vw - 32px))';
        panel.style.maxHeight = 'min(86vh, 860px)';
        panel.style.padding = '32px 34px';
        panel.style.border = '1px solid rgba(255, 220, 150, 0.45)';
        panel.style.borderRadius = '24px';
        panel.style.boxShadow = '0 24px 80px rgba(0, 0, 0, 0.45)';
        panel.style.background = 'linear-gradient(180deg, rgba(32, 28, 22, 0.95), rgba(18, 16, 14, 0.97))';
        panel.style.textAlign = 'center';

        const title = document.createElement('div');
        title.textContent = 'Wagon Mayhem';
        title.style.fontSize = 'clamp(3rem, 8vw, 5rem)';
        title.style.fontWeight = '700';
        title.style.letterSpacing = '0.08em';
        title.style.marginBottom = '10px';

        const subtitle = document.createElement('div');
        subtitle.textContent = 'A wagon run through dust, hay, and chaos';
        subtitle.style.fontSize = '1.05rem';
        subtitle.style.opacity = '0.88';
        subtitle.style.marginBottom = '28px';

        const buttons = document.createElement('div');
        buttons.style.display = 'flex';
        buttons.style.gap = '14px';
        buttons.style.justifyContent = 'center';
        buttons.style.flexWrap = 'wrap';
        buttons.style.marginBottom = '26px';

        const makeButton = (label, accent, onClick) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.style.minWidth = '160px';
            button.style.padding = '14px 24px';
            button.style.border = '0';
            button.style.borderRadius = '999px';
            button.style.fontSize = '1rem';
            button.style.fontWeight = '700';
            button.style.cursor = 'pointer';
            button.style.color = '#18150f';
            button.style.background = accent;
            button.style.boxShadow = '0 10px 20px rgba(0, 0, 0, 0.28)';
            button.addEventListener('click', onClick);
            return button;
        };

        const playButton = makeButton('Play', 'linear-gradient(180deg, #f6d27b, #d9a94a)', () => {
            this.startGame();
            this.showGameHud();
        });

        const controlsButton = makeButton('Controls', 'linear-gradient(180deg, #d8c7a0, #b99b67)', () => {
            this.showControlsMenu();
        });

        buttons.appendChild(playButton);
        buttons.appendChild(controlsButton);

        const panelBody = document.createElement('div');
        panelBody.style.textAlign = 'left';
        panelBody.style.maxHeight = '50vh';
        panelBody.style.overflow = 'auto';
        panelBody.style.padding = '18px 18px 6px';
        panelBody.style.borderTop = '1px solid rgba(255, 220, 150, 0.18)';

        const footer = document.createElement('div');
        footer.style.marginTop = '18px';
        footer.style.fontSize = '0.95rem';
        footer.style.opacity = '0.82';
        footer.textContent = 'Press Play to enter the game.';

        panel.appendChild(title);
        panel.appendChild(subtitle);
        panel.appendChild(buttons);
        panel.appendChild(panelBody);
        panel.appendChild(footer);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        this.menuOverlay = overlay;
        this.menuPanel = panelBody;
        this.mainMenuContent = { title, subtitle, buttons, panelBody, footer, controlsButton };
    }

    renderMenuContent(mode) {
        if (!this.menuPanel || !this.mainMenuContent) {
            return;
        }

        const { panelBody, subtitle, footer, controlsButton } = this.mainMenuContent;
        panelBody.innerHTML = '';

        if (mode === 'controls') {
            subtitle.textContent = 'Controls and key bindings';
            footer.textContent = 'Press Escape to go back.';
            const controls = this.scene && typeof this.scene.getControlHelpLines === 'function'
                ? this.scene.getControlHelpLines()
                : [];
            const list = document.createElement('div');
            list.style.display = 'grid';
            list.style.gap = '10px';
            for (const line of controls) {
                const item = document.createElement('div');
                item.textContent = line;
                item.style.padding = '10px 12px';
                item.style.borderRadius = '10px';
                item.style.background = 'rgba(255, 255, 255, 0.05)';
                item.style.border = '1px solid rgba(255, 220, 150, 0.12)';
                list.appendChild(item);
            }
            panelBody.appendChild(list);
            controlsButton.style.display = 'none';
        } else {
            subtitle.textContent = 'A wagon run through dust, hay, and chaos';
            footer.textContent = 'Press Play to enter the game.';
            const intro = document.createElement('div');
            intro.style.display = 'grid';
            intro.style.gap = '12px';
            intro.innerHTML = [
                '<div style="font-size:1.05rem; line-height:1.6;">The game starts with heavier scene initialization. Use this menu to let the world finish loading before entering.</div>',
                '<div style="font-size:0.98rem; opacity:0.9; line-height:1.7;">Controls are available from the button above and match the in-game bindings.</div>',
            ].join('');
            panelBody.appendChild(intro);
            controlsButton.style.display = '';
        }
    }

    showMainMenu() {
        this.menuMode = 'menu';
        if (this.menuOverlay) this.menuOverlay.style.display = 'flex';
        this.renderMenuContent('menu');
        if (this.gui) this.gui.domElement.style.display = 'none';
    }

    showControlsMenu() {
        this.menuMode = 'controls';
        if (this.menuOverlay) this.menuOverlay.style.display = 'flex';
        this.renderMenuContent('controls');
        if (this.gui) this.gui.domElement.style.display = 'none';
    }

    showGameHud() {
        this.menuMode = 'game';
        if (this.menuOverlay) this.menuOverlay.style.display = 'none';
        if (this.gui) this.gui.domElement.style.display = '';
    }

    startGame() {
        if (this.scene && typeof this.scene.startGame === 'function') {
            this.scene.startGame();
        }
    }

    getControlHelpLines() {
        if (this.scene && typeof this.scene.getControlHelpLines === 'function') {
            return this.scene.getControlHelpLines();
        }

        return [
            'W - Accelerate wagon',
            'Double tap W - Faster gear',
            'A/D - Steer wagon',
            'S - Stop wagon',
            'P - Pick up nearest hay bale',
            'L - Drop carried hay bale in barn drop area',
            'SHIFT - Cycle camera mode',
            'N - Snap camera left (90°) / hold to orbit left',
            'M - Snap camera right (90°) / hold to orbit right',
            'Left-click + drag - Orbit camera sideways (hold to prevent snap back)',
            'R - Reset game (when Game Over)',
            'ESC - Resume game',
        ];
    }
}
