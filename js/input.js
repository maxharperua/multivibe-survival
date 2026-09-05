// input.js — единый ввод: десктоп (WASD+мышь) и мобильный (джойстик + drag-обзор)
import { EYE_HEIGHT } from './player.js';

export class InputManager {
  constructor({ player, isMobile, canvas, onLockChange }) {
    this.player = player;
    this.isMobile = isMobile;
    this.canvas = canvas;
    this.onLockChange = onLockChange || (() => {});
    this.state = { fwd: 0, strafe: 0, run: false, locked: false };

    this._keys = new Set();
    this._joy = { active: false, id: null, baseX: 0, baseY: 0, dx: 0, dy: 0 };

    this._bindDesktop();
    if (isMobile) this._bindMobile();
  }

  // ── Десктоп ──
  _bindDesktop() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this._keys.add(e.code);
      this._updateKeys();
      if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this._keys.delete(e.code);
      this._updateKeys();
    });
    window.addEventListener('blur', () => { this._keys.clear(); this._updateKeys(); });

    document.addEventListener('pointerlockchange', () => {
      this.state.locked = document.pointerLockElement === this.canvas;
      this.onLockChange(this.state.locked);
    });
    document.addEventListener('mousemove', (e) => {
      if (this.state.locked) this.player.rotate(e.movementX, e.movementY);
    });
  }

  _updateKeys() {
    const k = this._keys;
    let fwd = 0, strafe = 0, run = false;
    if (k.has('KeyW') || k.has('ArrowUp')) fwd += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) fwd -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) strafe -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) strafe += 1;
    if (k.has('ShiftLeft') || k.has('ShiftRight')) run = true;
    this.state.fwd = fwd;
    this.state.strafe = strafe;
    this.state.run = run;
  }

  requestLock() {
    if (this.isMobile) return true;
    const p = this.canvas.requestPointerLock && this.canvas.requestPointerLock();
    return !!(p && p.then ? true : document.pointerLockElement);
  }

  // ── Мобильный ──
  _bindMobile() {
    const moveZone = document.getElementById('moveZone');
    const lookZone = document.getElementById('lookZone');
    const joystick = document.getElementById('joystick');
    const knob = document.getElementById('joystickKnob');
    const sprintBtn = document.getElementById('sprintBtn');
    const R = 55; // радиус джойстика

    // Левый джойстик — движение
    moveZone.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      this._joy.active = true;
      this._joy.id = t.identifier;
      this._joy.baseX = t.clientX;
      this._joy.baseY = t.clientY;
      this._joy.dx = 0; this._joy.dy = 0;
      joystick.style.display = 'block';
      joystick.style.left = t.clientX + 'px';
      joystick.style.top = t.clientY + 'px';
      knob.style.transform = 'translate(0,0)';
      e.preventDefault();
    }, { passive: false });

    const move = (e) => {
      if (!this._joy.active) return;
      for (const t of e.changedTouches) {
        if (t.identifier !== this._joy.id) continue;
        let dx = t.clientX - this._joy.baseX;
        let dy = t.clientY - this._joy.baseY;
        const len = Math.hypot(dx, dy);
        if (len > R) { dx *= R / len; dy *= R / len; }
        this._joy.dx = dx / R;   // -1..1
        this._joy.dy = dy / R;
        knob.style.transform = `translate(${dx}px,${dy}px)`;
      }
      e.preventDefault();
    };
    moveZone.addEventListener('touchmove', move, { passive: false });

    const endMove = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._joy.id) {
          this._joy.active = false;
          this._joy.dx = 0; this._joy.dy = 0;
          joystick.style.display = 'none';
        }
      }
      e.preventDefault();
    };
    moveZone.addEventListener('touchend', endMove, { passive: false });
    moveZone.addEventListener('touchcancel', endMove, { passive: false });

    // Правая зона — обзор (drag)
    let lookId = null, lastX = 0, lastY = 0;
    lookZone.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      if (lookId === null) { lookId = t.identifier; lastX = t.clientX; lastY = t.clientY; }
      e.preventDefault();
    }, { passive: false });
    lookZone.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== lookId) continue;
        const dx = t.clientX - lastX;
        const dy = t.clientY - lastY;
        lastX = t.clientX; lastY = t.clientY;
        // drag вправо = взгляд вправо (yaw -), sens мобильный
        this.player.rotate(dx * 1.9, dy * 1.9);
      }
      e.preventDefault();
    }, { passive: false });
    const endLook = (e) => {
      for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null;
      e.preventDefault();
    };
    lookZone.addEventListener('touchend', endLook, { passive: false });
    lookZone.addEventListener('touchcancel', endLook, { passive: false });

    // Бег — удержание кнопки
    const sprintOn = (e) => { this.state.run = true; sprintBtn.classList.add('active'); e.preventDefault(); };
    const sprintOff = (e) => { this.state.run = false; sprintBtn.classList.remove('active'); e.preventDefault(); };
    sprintBtn.addEventListener('touchstart', sprintOn, { passive: false });
    sprintBtn.addEventListener('touchend', sprintOff, { passive: false });
    sprintBtn.addEventListener('touchcancel', sprintOff, { passive: false });
  }

  // Слить джойстик + клавиши в состояние игрока, вызывается каждый кадр
  applyToPlayer() {
    const p = this.player;
    if (this.isMobile) {
      const jx = this._joy.dx, jy = this._joy.dy;
      // джойстик вверх (dy<0) = вперёд
      p.keys.fwd = -jy;
      p.keys.strafe = jx;
      p.keys.run = this.state.run;
    } else {
      p.keys.fwd = this.state.fwd;
      p.keys.strafe = this.state.strafe;
      p.keys.run = this.state.run;
    }
  }
}
