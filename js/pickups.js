// pickups.js — собираемые предметы на земле (камни, ветки)
// InstancedMesh: 2 draw-call'а на все предметы. Предметы ЛЕЖАТ на земле
// (без вращения/покачивания). Подбор — только кнопкой при подходе:
//   nearest(pos, radius) — ближайший предмет рядом (для подсказки),
//   collect(pos)         — собрать ближайший предмет (вызывается по кнопке).
import * as THREE from 'three';
import { ITEMS, makeItemMesh } from './items.js';

const WORLD_RADIUS = 170;   // как лес
const CLEAR_RADIUS = 6;     // на стартовой поляне пусто
const PICK_RADIUS = 2.2;    // дистанция подбора (подошёл + кнопка)
const COUNT = 700;          // всего предметов на карте

export class Pickups {
  constructor(scene) {
    this.scene = scene;
    this.items = [];        // { id, x, y, z, rot, tilt, scale, taken }
    this._dummy = new THREE.Object3D();
    this._meshes = new Map(); // id -> InstancedMesh
    this._taken = 0;
    this.onPick = null;       // (id, count) => void
  }

  // Разбросать предметы по карте (случайные типы: 55% камней, 45% веток)
  scatter(rng = Math.random) {
    const types = [];
    for (let i = 0; i < COUNT; i++) types.push(rng() < 0.55 ? 'stone' : 'branch');

    for (let i = 0; i < COUNT; i++) {
      let x = 0, z = 0, attempts = 0;
      do {
        const a = rng() * Math.PI * 2;
        const r = CLEAR_RADIUS + Math.sqrt(rng()) * (WORLD_RADIUS - CLEAR_RADIUS - 2);
        x = Math.cos(a) * r;
        z = Math.sin(a) * r;
        attempts++;
      } while (attempts < 12 && this._tooClose(x, z, i));

      const id = types[i];
      const def = ITEMS[id];
      // чуть над землёй (не тонет в рельефе), без покачивания
      const y = 0.06 + rng() * 0.08;
      this.items.push({
        id, x, y, z,
        rot: rng() * Math.PI * 2,       // поворот вокруг Y
        tilt: (rng() - 0.5) * 0.25,     // лёгкий наклон, чтобы лежали естественно
        scale: def.pickScale * (0.85 + rng() * 0.3),
        taken: false,
      });
    }
    this._buildMeshes();
  }

  _tooClose(x, z, upto) {
    for (let i = 0; i < upto; i++) {
      const it = this.items[i];
      if (!it) continue;
      const dx = it.x - x, dz = it.z - z;
      if (dx * dx + dz * dz < 2.2) return true;
    }
    return false;
  }

  _buildMeshes() {
    const byType = new Map();
    for (const it of this.items) {
      if (!byType.has(it.id)) byType.set(it.id, []);
      byType.get(it.id).push(it);
    }
    for (const [id, list] of byType) {
      const mesh = makeItemMesh(id);
      if (!mesh) continue;
      const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, list.length);
      im.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      im.castShadow = true;
      im.receiveShadow = false;
      this.scene.add(im);
      this._meshes.set(id, im);
      list.forEach((it, i) => { it.instance = i; });
    }
    this._layout();
  }

  // Статичная расстановка: предметы лежат на земле (наклон + поворот), без анимации
  _layout() {
    for (const [id, im] of this._meshes) {
      for (const it of this.items) {
        if (it.id !== id || it.taken) continue;
        this._dummy.position.set(it.x, it.y, it.z);
        this._dummy.rotation.set(it.tilt, it.rot, 0);
        this._dummy.scale.setScalar(it.scale);
        this._dummy.updateMatrix();
        im.setMatrixAt(it.instance, this._dummy.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
    }
  }

  // Ближайший неподобранный предмет в радиусе от pos; null, если рядом пусто
  nearest(pos, radius = PICK_RADIUS) {
    let best = null, bestD = radius * radius;
    for (const it of this.items) {
      if (it.taken) continue;
      const dx = it.x - pos.x, dz = it.z - pos.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = it; }
    }
    return best;
  }

  // Собрать ближайший предмет (по кнопке). Возвращает {id,count} | null
  collect(pos) {
    const it = this.nearest(pos);
    if (!it) return null;
    it.taken = true;
    this._hideInstance(it);
    this._taken++;
    const res = { id: it.id, count: 1 };
    if (this.onPick) this.onPick(it.id, 1);
    return res;
  }

  _hideInstance(it) {
    const im = this._meshes.get(it.id);
    if (!im) return;
    this._dummy.position.set(it.x, -50, it.z);
    this._dummy.rotation.set(0, 0, 0);
    this._dummy.scale.setScalar(1e-6);
    this._dummy.updateMatrix();
    im.setMatrixAt(it.instance, this._dummy.matrix);
    im.instanceMatrix.needsUpdate = true;
  }

  get remaining() { return this.items.length - this._taken; }
  get total() { return this.items.length; }
}
