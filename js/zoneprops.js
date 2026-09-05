// zoneprops.js — «контент» локаций: пни, валуны, кочки, брёвна.
// Каждая зона из zones.js получает свои процедурные объекты (InstancedMesh),
// чтобы локации отличались визуально, а не только HUD-тегом.
import * as THREE from 'three';
import { ZONES } from './zones.js';

// Случайная точка в круге зоны (с отступом от края)
function pointInZone(zone, margin = 2) {
  const r = Math.max(0.5, zone.radius - margin) * Math.sqrt(Math.random());
  const a = Math.random() * Math.PI * 2;
  return { x: zone.x + Math.cos(a) * r, z: zone.z + Math.sin(a) * r };
}

function makeInstanced(scene, geo, mat, count) {
  const im = new THREE.InstancedMesh(geo, mat, count);
  im.castShadow = true;
  im.receiveShadow = true;
  im.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  scene.add(im);
  return im;
}

function fillInstances(im, items) {
  const dummy = new THREE.Object3D();
  items.forEach((it, i) => {
    dummy.position.set(it.x, it.y, it.z);
    dummy.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
    dummy.scale.set(it.sx || 1, it.sy || 1, it.sz || 1);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
  });
  im.instanceMatrix.needsUpdate = true;
}

// ── Старая вырубка: пни ──
function spawnStumps(scene, zone, n = 14) {
  const geo = new THREE.CylinderGeometry(0.14, 0.2, 0.4, 7, 1);
  const mat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const im = makeInstanced(scene, geo, mat, n);
  const items = [];
  for (let i = 0; i < n; i++) {
    const p = pointInZone(zone, 3);
    items.push({
      x: p.x, y: 0.18, z: p.z,
      ry: Math.random() * Math.PI * 2,
      sx: 0.8 + Math.random() * 0.7, sy: 0.7 + Math.random() * 0.8, sz: 0.8 + Math.random() * 0.7,
    });
  }
  fillInstances(im, items);
  return im;
}

// ── Ручей / холм: валуны ──
function spawnBoulders(scene, zone, n, minS, maxS) {
  const geo = new THREE.IcosahedronGeometry(0.55, 0);
  const mat = new THREE.MeshLambertMaterial({ color: 0x8a8a8a });
  const im = makeInstanced(scene, geo, mat, n);
  const items = [];
  for (let i = 0; i < n; i++) {
    const p = pointInZone(zone, 3);
    const s = minS + Math.random() * (maxS - minS);
    items.push({ x: p.x, y: 0.28 * s, z: p.z, ry: Math.random() * Math.PI, sx: s, sy: s * 0.8, sz: s });
  }
  fillInstances(im, items);
  return im;
}

// ── Топь: тёмные кочки ──
function spawnHummocks(scene, zone, n = 22) {
  const geo = new THREE.CylinderGeometry(0.55, 0.75, 0.16, 7, 1);
  const mat = new THREE.MeshLambertMaterial({ color: 0x2e4a2a });
  const im = makeInstanced(scene, geo, mat, n);
  const items = [];
  for (let i = 0; i < n; i++) {
    const p = pointInZone(zone, 2);
    items.push({
      x: p.x, y: 0.05, z: p.z,
      ry: Math.random() * Math.PI * 2,
      sx: 0.6 + Math.random() * 0.9, sy: 0.6 + Math.random() * 0.8, sz: 0.6 + Math.random() * 0.9,
    });
  }
  fillInstances(im, items);
  return im;
}

// ── Поляна: поваленные брёвна (сушняк) ──
function spawnLogs(scene, zone, n = 5) {
  const geo = new THREE.CylinderGeometry(0.09, 0.11, 1.6, 6, 1);
  const mat = new THREE.MeshLambertMaterial({ color: 0x5a3d22 });
  const im = makeInstanced(scene, geo, mat, n);
  const items = [];
  for (let i = 0; i < n; i++) {
    const p = pointInZone(zone, 4);
    items.push({
      x: p.x, y: 0.12, z: p.z,
      rz: Math.PI / 2, ry: Math.random() * Math.PI,
      sx: 0.8 + Math.random() * 0.6, sy: 0.8 + Math.random() * 0.6, sz: 1,
    });
  }
  fillInstances(im, items);
  return im;
}

// Разложить объекты по всем зонам. Возвращает список созданных InstancedMesh.
export function spawnZoneProps(scene) {
  const created = [];
  for (const zone of ZONES) {
    switch (zone.type) {
      case 'felling':
        created.push(spawnStumps(scene, zone));
        break;
      case 'creek':
        created.push(spawnBoulders(scene, zone, 6, 0.6, 1.0));
        break;
      case 'highland':
        created.push(spawnBoulders(scene, zone, 5, 1.1, 1.9));
        break;
      case 'swamp':
        created.push(spawnHummocks(scene, zone));
        break;
      case 'clearing':
        created.push(spawnLogs(scene, zone));
        break;
      default:
        break; // thicket, valley — без объектов (лес и так плотный)
    }
  }
  return created;
}
