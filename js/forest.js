// forest.js — процедурный густой лес из InstancedMesh по чанкам
// Поддерживает НЕСКОЛЬКО моделей деревьев: каждая со своими частями (мешами),
// диапазоном масштаба и весом. У дерева: случайный поворот по Y + лёгкий наклон.
import * as THREE from 'three';

// Параметры леса
const WORLD_RADIUS = 170;      // радиус леса вокруг центра
const CLEAR_RADIUS = 12;       // поляна на старте
const CHUNK_SIZE = 55;         // размер чанка
const VIEW_RADIUS = 120;       // чанки ближе этого радиуса — видимы

// Подготовка геометрии из GLB: возвращает массив {geometry, material} для всех мешей
export function extractMeshes(gltfScene) {
  const parts = [];
  gltfScene.traverse((o) => {
    if (o.isMesh) {
      parts.push({
        geometry: o.geometry,
        material: o.material,
      });
    }
  });
  return parts;
}

// Модель: { parts: [{geometry,material}], weight: относит. частота, sMin, sMax }
export class Forest {
  constructor(scene, models, opts = {}) {
    this.scene = scene;
    this.models = models.map((m) => ({
      parts: m.parts,
      weight: m.weight != null ? m.weight : 1,
      sMin: m.sMin != null ? m.sMin : 0.9,
      sMax: m.sMax != null ? m.sMax : 1.9,
    }));
    const totalW = this.models.reduce((a, m) => a + m.weight, 0) || 1;
    let acc = 0;
    this._cumW = this.models.map((m) => (acc += m.weight / totalW)); // кумулятивные веса
    this.chunks = new Map();      // key -> {x, z, groups: [{model, ims: [], trees: []}]}
    this.trees = [];              // глобальный список деревьев для коллизий: {x,z,r}
    this._dummy = new THREE.Object3D();
    this._count = 0;
    this._gridMap = null;
    this._gridCell = 6;
  }

  // Радиус ствола (в единицах модели) — коллизия масштабируется вместе с деревом
  _trunkRadius() {
    return 0.4;
  }

  _pickModel() {
    const r = Math.random();
    for (let i = 0; i < this._cumW.length; i++) {
      if (r <= this._cumW[i]) return i;
    }
    return this._cumW.length - 1;
  }

  // Получить или создать чанк (группы создаются после сбора деревьев)
  _chunk(cx, cz) {
    const key = cx + ':' + cz;
    let ch = this.chunks.get(key);
    if (!ch) {
      ch = {
        x: cx * CHUNK_SIZE,
        z: cz * CHUNK_SIZE,
        groups: this.models.map(() => ({ ims: [], trees: [] })),
      };
      this.chunks.set(key, ch);
    }
    return ch;
  }

  // Создать InstancedMesh'и для чанка по собранным деревьям (точный capacity)
  _buildChunkMeshes(ch) {
    for (let g = 0; g < ch.groups.length; g++) {
      const group = ch.groups[g];
      const n = group.trees.length;
      const model = this.models[g];
      if (!n) continue;
      const cap = n; // точный capacity: экономим память на мобильных
      for (const p of model.parts) {
        const im = new THREE.InstancedMesh(p.geometry, p.material, Math.max(cap, 1));
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        im.frustumCulled = false;
        im.castShadow = true;
        im.receiveShadow = false;
        im.count = n;
        im.visible = false;
        this.scene.add(im);
        group.ims.push(im);
      }
      // матрицы
      for (let i = 0; i < n; i++) {
        const t = group.trees[i];
        this._dummy.position.set(t.x, 0, t.z);
        this._dummy.rotation.set(t.tiltX, t.rotY, t.tiltZ);
        this._dummy.scale.setScalar(t.s);
        this._dummy.updateMatrix();
        for (const im of group.ims) {
          im.setMatrixAt(i, this._dummy.matrix);
        }
      }
      for (const im of group.ims) im.instanceMatrix.needsUpdate = true;
      group.trees = []; // больше не нужны (коллизии уже в this.trees)
    }
  }

  // Сгенерировать лес: jittered-сетка с поляной в центре
  generate(countPerArea) {
    const rTrunk = this._trunkRadius();
    const step = Math.sqrt(1 / countPerArea);
    const half = Math.ceil(WORLD_RADIUS / step);
    for (let gi = -half; gi <= half; gi++) {
      for (let gj = -half; gj <= half; gj++) {
        const x = gi * step + (Math.random() - 0.5) * step * 0.9;
        const z = gj * step + (Math.random() - 0.5) * step * 0.9;
        const dist = Math.hypot(x, z);
        if (dist > WORLD_RADIUS) continue;      // за краем
        if (dist < CLEAR_RADIUS) continue;       // поляна
        if (dist > WORLD_RADIUS * 0.75 && Math.random() < 0.35) continue;
        if (Math.random() < 0.12) continue;      // лёгкая неравномерность

        // выбор модели и масштаб: разные модели дают ярусы высот
        const mi = this._pickModel();
        const m = this.models[mi];
        const s = m.sMin + Math.random() * (m.sMax - m.sMin);
        const rotY = Math.random() * Math.PI * 2;
        // лёгкий наклон ствола (±~1.5°) — деревья не «идеально ровные»
        const tiltX = (Math.random() - 0.5) * 0.05;
        const tiltZ = (Math.random() - 0.5) * 0.05;

        const cx = Math.floor(x / CHUNK_SIZE);
        const cz = Math.floor(z / CHUNK_SIZE);
        const ch = this._chunk(cx, cz);
        ch.groups[mi].trees.push({ x, z, s, rotY, tiltX, tiltZ });
        this.trees.push({ x, z, r: rTrunk * s });
      }
    }

    for (const ch of this.chunks.values()) this._buildChunkMeshes(ch);
    this._count = this.trees.length;
  }

  // Обновление видимости чанков по позиции камеры
  update(cameraPos) {
    const px = cameraPos.x, pz = cameraPos.z;
    for (const ch of this.chunks.values()) {
      const dx = ch.x + CHUNK_SIZE / 2 - px;
      const dz = ch.z + CHUNK_SIZE / 2 - pz;
      const visible = (dx * dx + dz * dz) < VIEW_RADIUS * VIEW_RADIUS;
      for (const group of ch.groups) {
        for (const im of group.ims) im.visible = visible;
      }
    }
  }

  // Пространственная сетка для коллизий
  _grid() {
    if (!this._gridMap) {
      const cell = 6;
      this._gridMap = new Map();
      this._gridCell = cell;
      for (const t of this.trees) {
        const key = Math.floor(t.x / cell) + ':' + Math.floor(t.z / cell);
        let arr = this._gridMap.get(key);
        if (!arr) { arr = []; this._gridMap.set(key, arr); }
        arr.push(t);
      }
    }
    return this._gridMap;
  }

  // Разрешение коллизии: позиция не может войти в стволы
  collide(pos, playerRadius) {
    const cell = this._gridCell || 6;
    const grid = this._grid();
    const x0 = Math.floor((pos.x - playerRadius) / cell), x1 = Math.floor((pos.x + playerRadius) / cell);
    const z0 = Math.floor((pos.z - playerRadius) / cell), z1 = Math.floor((pos.z + playerRadius) / cell);
    for (let gx = x0; gx <= x1; gx++) {
      for (let gz = z0; gz <= z1; gz++) {
        const arr = grid.get(gx + ':' + gz);
        if (!arr) continue;
        for (const t of arr) {
          const dx = pos.x - t.x, dz = pos.z - t.z;
          const minD = t.r + playerRadius;
          const d2 = dx * dx + dz * dz;
          if (d2 < minD * minD && d2 > 1e-8) {
            const d = Math.sqrt(d2);
            const push = (minD - d) / d;
            pos.x += dx * push;
            pos.z += dz * push;
          }
        }
      }
    }
    // Границы мира
    const limit = WORLD_RADIUS - 1;
    const dist = Math.hypot(pos.x, pos.z);
    if (dist > limit) {
      pos.x *= limit / dist;
      pos.z *= limit / dist;
    }
    return pos;
  }

  get count() { return this._count; }
}
