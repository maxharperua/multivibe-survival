// daynight.js — цикл дня и ночи: орбита солнца, сумерки, луна, звёзды
import * as THREE from 'three';

const SUN_R = 150;      // радиус орбиты солнца (для направления света)
const MOON_R = 330;     // расстояние до диска луны
const STAR_R = 340;     // радиус небесной сферы звёзд

// Цвета ключевых состояний
const C = {
  daySky:   new THREE.Color(0xa9c8d8),
  nightSky: new THREE.Color(0x0a1428),
  warmSky:  new THREE.Color(0xff9a5e),
  dayFog:   new THREE.Color(0x9db3a8),
  nightFog: new THREE.Color(0x141f33),
  warmFog:  new THREE.Color(0xb07a5a),
  sunHigh:  new THREE.Color(0xfff4e0),   // солнце в зените
  sunLow:   new THREE.Color(0xffc9a0),   // солнце у горизонта
  hemiDayTop:  new THREE.Color(0xd6e8f2),
  hemiNightTop:new THREE.Color(0x2a3a5e),
  hemiDayBot:  new THREE.Color(0x4a5d38),
  hemiNightBot:new THREE.Color(0x0e1820),
  ambDay:   new THREE.Color(0x9fb4a4),
  ambNight: new THREE.Color(0x2a3550),
};

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function clampC(c) {
  c.r = Math.min(1, Math.max(0, c.r));
  c.g = Math.min(1, Math.max(0, c.g));
  c.b = Math.min(1, Math.max(0, c.b));
  return c;
}

export class DayNight {
  constructor({ scene, sun, hemi, amb, startHour = 9.5, dayLength = 300 }) {
    this.scene = scene;
    this.sun = sun;
    this.hemi = hemi;
    this.amb = amb;
    this.fog = scene.fog;

    // Игровые сутки: 0..1; восход 06:00, зенит ~13:30, закат 21:00
    this.time = (startHour % 24) / 24;
    this.dayLength = dayLength;  // реальных секунд на полные сутки
    this.timeScale = 1;          // T — ускорение времени

    this._a = new THREE.Color();
    this._b = new THREE.Color();
    this._sky = new THREE.Color();

    // Лунный свет (без теней — мягкая подсветка ночью)
    this.moonLight = new THREE.DirectionalLight(0x9db4d6, 0);
    this.moonLight.position.set(0, 120, 0);
    scene.add(this.moonLight);
    scene.add(this.moonLight.target);

    // Диск луны + мягкое свечение вокруг
    const moonGeo = new THREE.SphereGeometry(13, 24, 24);
    this.moonMat = new THREE.MeshBasicMaterial({
      color: 0xe8eeff, transparent: true, opacity: 0,
      fog: false, depthWrite: false,
    });
    this.moonMesh = new THREE.Mesh(moonGeo, this.moonMat);
    this.moonMesh.renderOrder = 1;
    scene.add(this.moonMesh);

    const glowGeo = new THREE.SphereGeometry(26, 24, 24);
    this.moonGlowMat = new THREE.MeshBasicMaterial({
      color: 0xaac4ff, transparent: true, opacity: 0,
      fog: false, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.moonGlow = new THREE.Mesh(glowGeo, this.moonGlowMat);
    this.moonGlow.renderOrder = 2;
    scene.add(this.moonGlow);

    // Звёзды: случайные точки над горизонтом
    const N = 750;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(1 - Math.random() * 0.96); // 0..~75° над горизонтом
      pos[i * 3]     = STAR_R * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = STAR_R * Math.cos(phi) + 6;
      pos[i * 3 + 2] = STAR_R * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.starMat = new THREE.PointsMaterial({
      color: 0xffffff, size: 2.2, sizeAttenuation: false,
      transparent: true, opacity: 0, fog: false, depthWrite: false,
    });
    this.stars = new THREE.Points(starGeo, this.starMat);
    this.stars.frustumCulled = false;
    this.stars.renderOrder = 1;
    scene.add(this.stars);

    // Игровые часы в HUD
    this.clockEl = document.getElementById('clock');
    this._clockAcc = 0;

    this._sunDir = new THREE.Vector3();
    this._moonDir = new THREE.Vector3();
  }

  setTime(hours) { this.time = (hours % 24) / 24; }

  toggleSpeed() {
    this.timeScale = this.timeScale === 1 ? 40 : 1;
    return this.timeScale;
  }

  update(dt, playerPos) {
    this.time = (this.time + (dt * this.timeScale) / this.dayLength) % 1;

    // Фаза дня: восход 06:00 → закат 21:00 (15 ч света); вне — ночь
    const RISE = 6, SET = 21;
    const dayPhase = (this.time * 24 - RISE) / (SET - RISE);
    const phi = dayPhase * Math.PI;      // угол движения солнца
    const h = Math.sin(phi);             // высота солнца над горизонтом (-1..1)

    const dayF = smoothstep(0.0, 0.18, h);       // 0 ночь → 1 день
    const nightF = 1 - smoothstep(-0.08, 0.06, h); // 1 глубокая ночь
    const dusk = 1 - Math.min(1, Math.abs(h) / 0.3); // сумерки (солнце у горизонта)
    // публичные фазы — для облаков, небесного купола и прочих систем
    this.dayF = dayF;
    this.nightF = nightF;
    this.dusk = dusk;
    this.sunH = h; // высота солнца (-1..1) — для SkyDome и внешних систем

    const cx = playerPos ? playerPos.x : 0;
    const cy = playerPos ? playerPos.y : 0;
    const cz = playerPos ? playerPos.z : 0;

    // ── Солнце: направление и цвет ──
    this._sunDir.set(Math.cos(phi), Math.max(h, -0.15), 0).normalize();
    this.sun.position.set(cx + this._sunDir.x * SUN_R, cy + Math.max(h, -0.15) * SUN_R, cz);
    if (playerPos) this.sun.target.position.set(cx, cy, cz);
    const warm = 1 - smoothstep(0.03, 0.5, h);
    this._a.copy(C.sunLow).lerp(C.sunHigh, 1 - warm * 0.85);
    this.sun.color.copy(this._a);
    this.sun.intensity = dayF * 3.0;

    // ── Луна: противоположная сторона ──
    const moonPhi = phi + Math.PI;
    const mh = Math.sin(moonPhi);
    const moonVis = 1 - smoothstep(-0.12, 0.06, h); // видна ночью и в сумерках
    this._moonDir.set(Math.cos(moonPhi), Math.max(mh, 0.05), 0).normalize();
    this.moonLight.position.set(cx + this._moonDir.x * SUN_R, cy + Math.max(mh, 0.05) * SUN_R, cz);
    if (playerPos) this.moonLight.target.position.set(cx, cy, cz);
    this.moonLight.intensity = moonVis * 0.7;
    // диск луны в мировых координатах (далеко — параллакс незаметен)
    this.moonMesh.position.set(this._moonDir.x * MOON_R, Math.max(mh, 0.02) * MOON_R, this._moonDir.z * MOON_R);
    this.moonMat.opacity = moonVis * 0.95;
    this.moonGlow.position.copy(this.moonMesh.position);
    this.moonGlowMat.opacity = moonVis * 0.35;

    // ── Звёзды ──
    this.starMat.opacity = nightF * 0.95;
    this.stars.visible = this.starMat.opacity > 0.01;

    // ── Небо и туман ──
    this._a.copy(C.nightSky).lerp(C.daySky, dayF);
    this._b.copy(C.warmSky).multiplyScalar(dusk * (1 - nightF * 0.75) * 0.55);
    this._sky.copy(this._a).add(this._b);
    clampC(this._sky);
    this.scene.background.copy(this._sky);
    this._a.copy(C.nightFog).lerp(C.dayFog, dayF);
    this._b.copy(C.warmFog).multiplyScalar(dusk * (1 - nightF * 0.7) * 0.6);
    this.fog.color.copy(this._a).add(this._b);
    clampC(this.fog.color);

    // ── Полусферный и заполняющий свет ──
    this.hemi.intensity = 0.25 + 0.65 * dayF;
    this._a.copy(C.hemiNightTop).lerp(C.hemiDayTop, dayF);
    this.hemi.color.copy(this._a);
    this._b.copy(C.hemiNightBot).lerp(C.hemiDayBot, dayF);
    this.hemi.groundColor.copy(this._b);

    this.amb.intensity = 0.09 + 0.24 * dayF + 0.05 * nightF;
    this._a.copy(C.ambNight).lerp(C.ambDay, dayF);
    this.amb.color.copy(this._a);

    // ── Часы ──
    this._clockAcc += dt;
    if (this._clockAcc >= 0.5) {
      this._clockAcc = 0;
      if (this.clockEl) {
        const mins = Math.floor(this.time * 24 * 60);
        const hh = String(Math.floor(mins / 60) % 24).padStart(2, '0');
        const mm = String(mins % 60).padStart(2, '0');
        const icon = dayF > 0.5 ? '☀' : (nightF > 0.5 ? '☾' : '◐');
        let txt = icon + ' ' + hh + ':' + mm;
        if (this.timeScale > 1) txt += ' ×' + this.timeScale;
        this.clockEl.textContent = txt;
      }
    }
  }
}
