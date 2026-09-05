// skydome.js — небесный купол из equirect-панорамы (Skyrim-style skybox)
// Днём фото-небо с облаками полностью перекрывает цветной фон daynight.
// В сумерках купол плавно растворяется (opacity → 0), открывая тёплый
// градиент заката и ночное звёздное небо со звёздами/луной daynight.
import * as THREE from 'three';

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export class SkyDome {
  constructor(scene, url) {
    this.scene = scene;
    this.visible = 0; // текущая «видимость» купола 0..1

    // Сфера-купол: только верхняя часть (от зенита до ~6° ниже горизонта),
    // чтобы за краем земли (радиус 320) был виден цвет daynight-фона, а не низ текстуры.
    // SphereGeometry(r, w, h, phiStart, phiLen, thetaStart, thetaLen) — theta от зенита.
    const geo = new THREE.SphereGeometry(460, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2 + 0.12);
    // equirect-текстура: ось текстуры — так, чтобы «перед» панорамы смотрел на -Z?
    // Ниже (в update) купол поворачивается, чтобы шов/север панорамы не был виден.

    this.mat = new THREE.MeshBasicMaterial({
      map: null,
      side: THREE.BackSide,
      fog: false,           // небо не должно тонуть в тумане
      transparent: true,
      depthWrite: false,    // не мешать звёздам/луне (рисуются поверх)
      opacity: 0,
    });

    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.renderOrder = -10; // позади звёзд/луны
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);

    // equirect-текстура (тонмапленная CC0-панорама Poly Haven kloppenheim_06)
    const loader = new THREE.TextureLoader();
    loader.load(url, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.mapping = THREE.EquirectangularReflectionMapping;
      // текстура уже «приготовлена»: верх — небо, низ — градиент под цвет тумана
      this.mat.map = tex;
      this.mat.needsUpdate = true;
    });
  }

  // Управление куполом по фазе дня: opacity и тёплый тинт на закате
  // dn — объект DayNight (dayF, nightF, dusk, sunH); dt — реальные секунды
  update(dn, dt) {
    const h = dn.sunH;
    // Купол виден днём; в сумерках держится на остаточном уровне (dusk),
    // чтобы фото-облака подсвечивались закатом, ночью гаснет (звёзды daynight).
    let target = Math.max(dn.dayF, dn.dusk * 0.3);
    target *= 1 - dn.nightF * 0.92; // ночью почти полностью прозрачен
    target = Math.min(1, Math.max(0, target));

    // экспоненциальное сглаживание по dt (не зависит от fps)
    const k = 1 - Math.exp(-(dt || 0.016) * 6);
    this.visible += (target - this.visible) * k;
    this.mat.opacity = this.visible;

    // Закатный тинт: облака панорамы подсвечиваются тёплым, когда солнце у горизонта
    const warm = dn.dusk * (1 - dn.nightF * 0.85);
    this.mat.color.setRGB(1, 1 - warm * 0.25, 1 - warm * 0.45);

    this.mesh.visible = this.visible > 0.01;
  }

  follow(pos) {
    if (!pos) return;
    // Центр купола — под игроком (y=-40): нижняя кромка шапки уходит за край
    // земли (радиус 320) и видимый стык текстуры с фоном не возникает.
    this.mesh.position.set(pos.x, -40, pos.z);
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    if (this.mat.map) this.mat.map.dispose();
    this.mat.dispose();
  }
}
