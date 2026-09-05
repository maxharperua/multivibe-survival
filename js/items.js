// items.js — определения предметов и их 3D-модели.
// Камень и палка — готовые CC0 GLB-модели:
//   stone  — rockflat.glb (Kenney, CC0, плоский булыжник 1.8м)
//   stick  — twig.glb (Quaternius, CC0, ветка 0.17м)
// Волокно, бревно, ягоды — процедурные (без GLB).
// Модели загружаются асинхронно через loadItemModels() до разброса пикапов.
// Если загрузка не удалась — процедурный fallback (геометрии ниже).
import * as THREE from 'three';
import { GLTFLoader } from '../lib/jsm/loaders/GLTFLoader.js';

// ── Процедурный fallback (если GLB не загрузился) ──
const _geoCache = new Map();

function stoneGeometry(seed = 1) {
  const key = 'stone' + seed;
  if (_geoCache.has(key)) return _geoCache.get(key);
  const geo = new THREE.IcosahedronGeometry(0.26, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = 0.78 + Math.abs(Math.sin(i * 12.9898 + seed * 78.233)) * 0.4;
    pos.setXYZ(i, x * n, y * n, z * n);
  }
  geo.computeVertexNormals();
  _geoCache.set(key, geo);
  return geo;
}

function branchGeometry() {
  const key = 'stick';
  if (_geoCache.has(key)) return _geoCache.get(key);
  const geo = new THREE.CylinderGeometry(0.03, 0.05, 0.7, 6, 1);
  geo.translate(0, 0.35, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > 0.25) {
      const t = (y - 0.25) / 0.45;
      pos.setX(i, pos.getX(i) + Math.sin(y * 6.0) * 0.05 * t);
      pos.setZ(i, pos.getZ(i) + Math.cos(y * 5.0) * 0.05 * t);
    }
  }
  geo.computeVertexNormals();
  _geoCache.set(key, geo);
  return geo;
}

// Бревно — толстый цилиндр с обрубками торцов
function logGeometry() {
  const key = 'wood';
  if (_geoCache.has(key)) return _geoCache.get(key);
  const geo = new THREE.CylinderGeometry(0.09, 0.11, 0.55, 7, 1);
  geo.translate(0, 0.27, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i);
    const n = 0.92 + Math.abs(Math.sin(x * 17.0 + z * 13.0 + y * 3.0)) * 0.16;
    pos.setXYZ(i, x * n, y, z * n);
  }
  geo.computeVertexNormals();
  _geoCache.set(key, geo);
  return geo;
}

// Волокно — скрученный жгут из двух тонких цилиндров
function fiberGeometry() {
  const key = 'fiber';
  if (_geoCache.has(key)) return _geoCache.get(key);
  const geo = new THREE.CylinderGeometry(0.018, 0.018, 0.5, 5, 1);
  geo.translate(0, 0.25, 0);
  _geoCache.set(key, geo);
  return geo;
}

// Ягоды — гроздь из трёх мелких сфер
function berryGeometry() {
  const key = 'berry';
  if (_geoCache.has(key)) return _geoCache.get(key);
  const geo = new THREE.SphereGeometry(0.055, 8, 6);
  geo.translate(0, 0.05, 0);
  _geoCache.set(key, geo);
  return geo;
}

const matStone = new THREE.MeshStandardMaterial({ color: 0x9a9184, roughness: 0.95, metalness: 0.02 });
const matBranch = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.9, metalness: 0.0 });
const matLog = new THREE.MeshStandardMaterial({ color: 0x6b4f2e, roughness: 0.95, metalness: 0.0 });
const matFiber = new THREE.MeshStandardMaterial({ color: 0xc8b98a, roughness: 1.0, metalness: 0.0 });
const matBerry = new THREE.MeshStandardMaterial({ color: 0xb33030, roughness: 0.6, metalness: 0.05 });

// ── Загруженные GLB-модели ──
const _models = new Map(); // id -> { geometry, material }

// Загрузить все GLB-модели предметов (до создания пикапов)
export async function loadItemModels() {
  const jobs = Object.entries(ITEMS).map(([id, def]) =>
    new Promise((res) => {
      if (!def.model) return res(); // нет модели — процедурная
      new GLTFLoader().load(def.model, (gltf) => {
        const src = extractMesh(gltf.scene);
        if (src) {
          // применяем мировые трансформации узлов (scale/rotation из GLB)
          src.updateWorldMatrix(true, false);
          const geo = src.geometry.clone();
          geo.applyMatrix4(src.matrixWorld);
          // «укладываем» на землю: ветка в GLB стоит вертикально (длина по Y),
          // поворачиваем, чтобы лежала вдоль земли; камень и так плоский.
          const lieFlat = ITEMS[id]?.lieFlat || 0;
          if (lieFlat) geo.rotateX(lieFlat);
          // центрируем, чтобы предмет «сидел» на земле, а не торчал из неё
          geo.computeBoundingBox();
          const bb = geo.boundingBox;
          const cy = (bb.min.y + bb.max.y) / 2;
          geo.translate(0, -cy, 0);
          _models.set(id, { geometry: geo, material: src.material });
          res();
        } else {
          res();
        }
      }, undefined, () => res()); // ошибка — остаёмся на процедурной
    })
  );
  await Promise.all(jobs);
}

function extractMesh(root) {
  let mesh = null;
  root.traverse((o) => { if (!mesh && o.isMesh) mesh = o; });
  return mesh;
}

// Вернуть меш предмета для руки/пикапов (из GLB или процедурный)
export function makeItemMesh(id) {
  const m = _models.get(id);
  if (m) return new THREE.Mesh(m.geometry, m.material);
  const def = ITEMS[id];
  if (def && def.makeMesh) return def.makeMesh();
  return null;
}

// ── Описания предметов ──
export const ITEMS = {
  stone: {
    id: 'stone',
    name: 'Камень',
    stack: 64,
    color: '#9a9184',
    size: 1,
    model: './assets/models/rockflat.glb',
    // масштаб модели для пикапа на земле (rockflat 1.8м -> ~0.5м булыжник)
    pickScale: 0.28,
    // масштаб/поза в руке
    handScale: 0.3,
    handRot: [0, 0, 0],
    makeMesh: () => new THREE.Mesh(stoneGeometry(1), matStone),
  },
  stick: {
    id: 'stick',
    name: 'Палка',
    stack: 64,
    color: '#a8844f',
    size: 1,
    model: './assets/models/twig.glb',
    // twig в GLB стоит вертикально (длина 0.17 по Y) — поворачиваем, чтобы лежала
    lieFlat: -Math.PI / 2,
    pickScale: 1.2,     // twig 0.17м -> ~0.2м палка
    handScale: 1.6,
    handRot: [0.6, 0, 0.15],
    makeMesh: () => new THREE.Mesh(branchGeometry(), matBranch),
  },
  fiber: {
    id: 'fiber',
    name: 'Волокно',
    stack: 64,
    color: '#c8b98a',
    size: 1,
    pickScale: 0.9,
    handScale: 1.4,
    handRot: [0, 0.4, 0],
    makeMesh: () => new THREE.Mesh(fiberGeometry(), matFiber),
  },
  wood: {
    id: 'wood',
    name: 'Бревно',
    stack: 32,
    color: '#6b4f2e',
    size: 1,
    pickScale: 0.55,
    handScale: 0.55,
    handRot: [0, 0, 0],
    makeMesh: () => new THREE.Mesh(logGeometry(), matLog),
  },
  berry: {
    id: 'berry',
    name: 'Ягоды',
    stack: 64,
    color: '#b33030',
    size: 1,
    pickScale: 1.0,
    handScale: 1.1,
    handRot: [0, 0, 0],
    makeMesh: () => new THREE.Mesh(berryGeometry(), matBerry),
  },
  // ── Крафтовые предметы (появляются через крафт, на земле не лежат) ──
  rope: {
    id: 'rope',
    name: 'Верёвка',
    stack: 32,
    color: '#d9c48a',
    size: 1,
    handScale: 1.0,
    handRot: [0, 0, 0],
    makeMesh: () => {
      const g = new THREE.Group();
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.028, 6, 12), matFiber);
      m.rotation.x = Math.PI / 2;
      g.add(m);
      const m2 = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.028, 6, 12), matFiber);
      m2.rotation.set(Math.PI / 2, 0, Math.PI / 3);
      g.add(m2);
      return g;
    },
  },
  plank: {
    id: 'plank',
    name: 'Доска',
    stack: 32,
    color: '#9a7448',
    size: 1,
    handScale: 0.7,
    handRot: [0, 0, 0],
    makeMesh: () => new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.14), matLog),
  },
  axe: {
    id: 'axe',
    name: 'Топор',
    stack: 1,
    color: '#9a9184',
    size: 1,
    handScale: 0.9,
    handRot: [0.3, 0.4, 0],
    makeMesh: () => {
      const g = new THREE.Group();
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.55, 6), matBranch);
      handle.position.y = 0.27;
      g.add(handle);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.05), matStone);
      head.position.set(0.09, 0.52, 0);
      g.add(head);
      return g;
    },
  },
  spear: {
    id: 'spear',
    name: 'Копьё',
    stack: 1,
    color: '#b5ac9e',
    size: 1,
    handScale: 1.0,
    handRot: [0, 0, 0],
    makeMesh: () => {
      const g = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 1.1, 6), matBranch);
      shaft.position.y = 0.55;
      g.add(shaft);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 6), matStone);
      tip.position.y = 1.18;
      g.add(tip);
      return g;
    },
  },
  campfire_kit: {
    id: 'campfire_kit',
    name: 'Костровой набор',
    stack: 1,
    color: '#d97a2b',
    size: 1,
  },
  shelter_kit: {
    id: 'shelter_kit',
    name: 'Набор для шалаша',
    stack: 1,
    color: '#6b4f2e',
    size: 1,
  },
  cooked_meat: {
    id: 'cooked_meat',
    name: 'Жареное мясо',
    stack: 32,
    color: '#8a5a2b',
    size: 1,
  },
};

export const ITEM_LIST = Object.values(ITEMS);
