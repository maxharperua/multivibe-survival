// remote.js — отрисовка других игроков (снапшоты с сервера + интерполяция)
import * as THREE from 'three';

export const EYE_HEIGHT = 1.7;

// палитра одежды по id — чтобы игроки различались
const PALETTE = [
  0x4a7c3f, 0x8a5a2b, 0x3f5a7c, 0x7c3f4a,
  0x5a7c3f, 0x7c6a3f, 0x3f6a7c, 0x6a3f7c,
  0x7c3f6a, 0x3f7c6a,
];

export class RemotePlayers {
  constructor(scene) {
    this.scene = scene;
    this.map = new Map(); // id -> {group, target:{x,z,yaw,hp}, prev:{x,z,yaw}, t, lastSeen}
  }

  // Полный снапшот: Map id -> {x,y,z,yaw,hp}
  apply(players) {
    const now = performance.now();
    for (const [id, p] of players) {
      if (id === this.myId) continue; // себя не рисуем
      let r = this.map.get(id);
      if (!r) {
        r = this._create(id);
        r.prev = { x: p.x, z: p.z, yaw: p.yaw };
        this.map.set(id, r);
      } else {
        r.prev = { x: r.target.x, z: r.target.z, yaw: r.target.yaw };
      }
      r.target = { x: p.x, z: p.z, yaw: p.yaw, hp: p.hp };
      r.lastSeen = now;
    }
    // игроки, которых нет в снапшоте (сервер их не видит) — скрываем
    for (const [id, r] of this.map) {
      if (r.lastSeen !== now) {
        this.scene.remove(r.group);
        this.map.delete(id);
      }
    }
  }

  remove(id) {
    const r = this.map.get(id);
    if (r) { this.scene.remove(r.group); this.map.delete(id); }
  }

  clear() {
    for (const r of this.map.values()) this.scene.remove(r.group);
    this.map.clear();
  }

  _create(id) {
    const color = PALETTE[id % PALETTE.length];
    const group = new THREE.Group();

    // туловище
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 1.15, 0.32),
      new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
    );
    body.position.y = EYE_HEIGHT - 0.62;
    group.add(body);

    // голова
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.3, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.85 })
    );
    head.position.y = EYE_HEIGHT + 0.12;
    group.add(head);

    // руки-«палки» (визуально живой)
    const armMat = new THREE.MeshStandardMaterial({ color: 0x2f4a2f, roughness: 0.9 });
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.1), armMat);
      arm.position.set(side * 0.34, EYE_HEIGHT - 0.45, 0);
      group.add(arm);
    }

    // индикатор HP: полоска над головой
    const hpBar = new THREE.Group();
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.07),
      new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.6 })
    );
    const fg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.56, 0.045),
      new THREE.MeshBasicMaterial({ color: 0x4ade80 })
    );
    fg.position.z = 0.001;
    hpBar.add(bg);
    hpBar.add(fg);
    hpBar.position.y = EYE_HEIGHT + 0.5;
    hpBar.rotation.x = -Math.PI / 3.4; // наклон к камере игрока
    group.add(hpBar);

    this.scene.add(group);
    return { group, target: { x: 0, z: 0, yaw: 0, hp: 100 }, prev: { x: 0, z: 0, yaw: 0 }, t: 0, lastSeen: 0, _fg: fg };
  }

  // Вызывается каждый кадр: интерполяция к целевому состоянию
  update(dt) {
    const k = Math.min(1, dt * 12); // быстрая интерполяция (задержка ~80 мс)
    for (const r of this.map.values()) {
      r.group.position.x += (r.target.x - r.group.position.x) * k;
      r.group.position.z += (r.target.z - r.group.position.z) * k;
      // кратчайшая дуга для yaw
      let dy = r.target.yaw - r.group.rotation.y;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      r.group.rotation.y += dy * k;
      // HP-полоска
      const hp = Math.max(0, Math.min(100, r.target.hp || 100));
      r._fg.scale.x = hp / 100;
      r._fg.position.x = -(0.56 * (1 - hp / 100)) / 2;
      r._fg.material.color.setHSL(0.33 * (hp / 100), 0.85, 0.5);
      // труп: hp=0 — заваливаем фигурку
      if (hp <= 0) {
        r.group.rotation.x = Math.min(Math.PI / 2, r.group.rotation.x + dt * 3);
        r.group.position.y = Math.max(-0.9, (r.group.position.y || 0) - dt * 0.6);
      } else {
        r.group.rotation.x = 0;
        r.group.position.y = 0;
      }
    }
  }
}
