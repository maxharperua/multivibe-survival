// player.js — FPS-контроллер: камера, движение, коллизии
import * as THREE from 'three';

export const EYE_HEIGHT = 1.7;
const WALK_SPEED = 4.2;
const RUN_SPEED = 7.5;
const PLAYER_RADIUS = 0.45;
const PITCH_LIMIT = Math.PI / 2 - 0.06;

export class Player {
  constructor(camera, forest) {
    this.camera = camera;
    this.forest = forest;
    this.yaw = 0;
    this.pitch = 0;
    this.pos = new THREE.Vector3(0, EYE_HEIGHT, 0);
    this.vel = new THREE.Vector3();
    this.keys = { fwd: 0, strafe: 0, run: false };
    this.teleport(0, 0, Math.PI / 4); // смотрим в лес, а не в пустоту поляны... поляна со всех сторон
  }

  teleport(x, z, yaw, pitch) {
    this.pos.set(x, EYE_HEIGHT, z);
    if (yaw !== undefined) this.yaw = yaw;
    if (pitch !== undefined) this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
    this._apply();
  }

  // Добавить поворот от мыши/тача
  rotate(dx, dy) {
    const sens = 0.0022;
    this.yaw -= dx * sens;
    this.pitch -= dy * sens;
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch));
    this._apply();
  }

  _apply() {
    this.camera.position.copy(this.pos);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  update(dt) {
    const speed = this.keys.run ? RUN_SPEED : WALK_SPEED;
    // направление движения относительно взгляда
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let mx = 0, mz = 0;
    if (this.keys.fwd !== 0) { mx += -sin * this.keys.fwd; mz += -cos * this.keys.fwd; }
    if (this.keys.strafe !== 0) { mx += cos * this.keys.strafe; mz += -sin * this.keys.strafe; }
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len; mz /= len;
      const next = this.pos.clone();
      next.x += mx * speed * dt;
      next.z += mz * speed * dt;
      // коллизия с деревьями
      this.forest.collide(next, PLAYER_RADIUS);
      this.pos.x = next.x;
      this.pos.z = next.z;
    }
    this._apply();
  }

  // Для камеры, следящей за светом — отдаём позицию глаз
  get eye() { return this.pos; }
}
