// world.js — сцена, рендерер, свет, туман, земля
import * as THREE from 'three';

export function createWorld(canvas, { isMobile }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isMobile,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.75 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  // Цвета неба/тумана задаёт цикл дня и ночи (daynight.js), здесь — стартовые
  const skyColor = new THREE.Color(0xa9c8d8);
  const fogColor = new THREE.Color(0x9db3a8);
  scene.background = skyColor;
  scene.fog = new THREE.FogExp2(fogColor, 0.011);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 1.7, 0);

  // Свет: холодный верх + тёплое "солнце сквозь кроны"
  const hemi = new THREE.HemisphereLight(0xd6e8f2, 0x4a5d38, 0.9);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffe3b8, 3.0);
  sun.position.set(60, 90, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 260;
  const s = isMobile ? 45 : 70;
  sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
  sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s;
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.5;
  scene.add(sun);

  // Слабый заполняющий свет для читаемости теневых сторон
  const amb = new THREE.AmbientLight(0x8aa08e, 0.35);
  scene.add(amb);

  return { renderer, scene, camera, sun, hemi, amb, isMobile };
}

// Земля: большой круг с повторяющейся текстурой
export async function createGround(scene, textureBase) {
  const loader = new THREE.TextureLoader();
  const [map, normalMap, roughMap] = await Promise.all([
    loader.loadAsync(textureBase + 'forest_ground_diff_1k.jpg'),
    loader.loadAsync(textureBase + 'forest_ground_nor_1k.jpg'),
    loader.loadAsync(textureBase + 'forest_ground_rough_1k.jpg'),
  ]);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  roughMap.wrapS = roughMap.wrapT = THREE.RepeatWrapping;
  const rep = 90;
  map.repeat.set(rep, rep);
  normalMap.repeat.set(rep, rep);
  roughMap.repeat.set(rep, rep);
  map.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.MeshStandardMaterial({
    map,
    normalMap,
    roughnessMap: roughMap,
    roughness: 1, metalness: 0,
  });
  const geo = new THREE.CircleGeometry(320, 64);
  geo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(geo, mat);
  ground.receiveShadow = true;
  scene.add(ground);
  return ground;
}
