// items.js — определения предметов и их 3D-модели.
// Камень и ветка — готовые CC0 GLB-модели:
//   stone  — rockflat.glb (Kenney, CC0, плоский булыжник 1.8м)
//   branch — twig.glb (Quaternius, CC0, ветка 0.17м)
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
  const key = 'branch';
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

const matStone = new THREE.MeshStandardMaterial({ color: 0x9a9184, roughness: 0.95, metalness: 0.02 });
const matBranch = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.9, metalness: 0.0 });

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
  branch: {
    id: 'branch',
    name: 'Ветка',
    stack: 64,
    color: '#a8844f',
    size: 1,
    model: './assets/models/twig.glb',
    // twig в GLB стоит вертикально (длина 0.17 по Y) — поворачиваем, чтобы лежала
    lieFlat: -Math.PI / 2,
    pickScale: 1.2,     // twig 0.17м -> ~0.2м ветка
    handScale: 1.6,
    handRot: [0.6, 0, 0.15],
    makeMesh: () => new THREE.Mesh(branchGeometry(), matBranch),
  },
};

export const ITEM_LIST = Object.values(ITEMS);
