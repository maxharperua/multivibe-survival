// campfires.js — костры: процедурная 3D-группа (камни, поленья, пламя, свет).
// place(x,z) ставит горящий костёр; update(dt) анимирует пламя и свет.
// Пока костры локальные (не синхронизируются по сети).
import * as THREE from 'three';

const MAX_LIGHTS = 2; // не больше двух костров с реальным светом (для FPS)

export class Campfires {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this._lightCount = 0;
  }

  place(x, z) {
    const g = new THREE.Group();

    // кольцо камней
    const stoneGeo = new THREE.IcosahedronGeometry(0.16, 0);
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x777777 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.random() * 0.35;
      const r = 0.5 + Math.random() * 0.14;
      const s = new THREE.Mesh(stoneGeo, stoneMat);
      s.position.set(Math.cos(a) * r, 0.07 + Math.random() * 0.05, Math.sin(a) * r);
      s.scale.setScalar(0.7 + Math.random() * 0.7);
      s.castShadow = true;
      g.add(s);
    }

    // поленья крест-накрест
    const logGeo = new THREE.CylinderGeometry(0.045, 0.055, 0.75, 6, 1);
    const logMat = new THREE.MeshLambertMaterial({ color: 0x4a2f17 });
    for (let i = 0; i < 4; i++) {
      const l = new THREE.Mesh(logGeo, logMat);
      const a = (i / 4) * Math.PI * 2 + 0.4;
      l.rotation.z = Math.PI / 2;
      l.rotation.y = a;
      l.position.set(Math.cos(a) * 0.22, 0.1, Math.sin(a) * 0.22);
      l.castShadow = true;
      g.add(l);
    }

    // пламя: два конуса (оранжевый + жёлтое ядро), MeshBasic — светится всегда
    const f1 = new THREE.Mesh(
      new THREE.ConeGeometry(0.17, 0.55, 8),
      new THREE.MeshBasicMaterial({ color: 0xff7722 })
    );
    f1.position.y = 0.42;
    const f2 = new THREE.Mesh(
      new THREE.ConeGeometry(0.1, 0.34, 8),
      new THREE.MeshBasicMaterial({ color: 0xffdd44 })
    );
    f2.position.y = 0.4;
    g.add(f1, f2);

    // свет (не более MAX_LIGHTS одновременно)
    let light = null;
    if (this._lightCount < MAX_LIGHTS) {
      light = new THREE.PointLight(0xff8833, 1.4, 11, 2);
      light.position.y = 0.9;
      g.add(light);
      this._lightCount++;
    }

    g.position.set(x, 0, z);
    this.scene.add(g);
    this.items.push({ g, f1, f2, light, t: Math.random() * 10 });
    return g;
  }

  update(dt) {
    for (const it of this.items) {
      it.t += dt;
      const pulse = 1 + Math.sin(it.t * 9) * 0.18 + Math.sin(it.t * 23) * 0.07;
      it.f1.scale.setScalar(pulse);
      it.f1.position.y = 0.4 + pulse * 0.05;
      it.f2.scale.setScalar(pulse * 0.9);
      if (it.light) it.light.intensity = 1.2 + Math.sin(it.t * 12) * 0.25;
    }
  }

  count() { return this.items.length; }
}
