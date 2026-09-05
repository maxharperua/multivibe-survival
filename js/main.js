// main.js — точка входа: загрузка, сборка мира, цикл
import * as THREE from 'three';
import { GLTFLoader } from '../lib/jsm/loaders/GLTFLoader.js';
import { createWorld, createGround } from './world.js';
import { Forest, extractMeshes } from './forest.js';
import { Player } from './player.js';
import { InputManager } from './input.js';
import { DayNight } from './daynight.js';
import { SkyDome } from './skydome.js';
import { Inventory } from './inventory.js';
import { Pickups } from './pickups.js';
import { HotbarUI, InventoryUI, HandItem, showToast, syncHandItem } from './ui.js';
import { ITEMS, loadItemModels } from './items.js';

const params = new URLSearchParams(location.search);
const IS_MOBILE = params.get('mobile') === '1' ||
  (matchMedia && matchMedia('(pointer: coarse)').matches) ||
  (navigator.maxTouchPoints && navigator.maxTouchPoints > 1);

document.body.classList.toggle('mobile', IS_MOBILE);
const hintDesktop = document.getElementById('hintDesktop');
const hintMobile = document.getElementById('hintMobile');
if (IS_MOBILE) { hintDesktop.style.display = 'none'; hintMobile.style.display = 'inline'; }

const canvas = document.getElementById('game');
const loadingEl = document.getElementById('loading');
const loadingText = document.getElementById('loadingText');
const startScreen = document.getElementById('startScreen');
const pauseScreen = document.getElementById('pauseScreen');
const startBtn = document.getElementById('startBtn');
const resumeBtn = document.getElementById('resumeBtn');
const crosshair = document.getElementById('crosshair');
const fpsEl = document.getElementById('fps');

const world = createWorld(canvas, { isMobile: IS_MOBILE });
const { renderer, scene, camera, sun, hemi, amb } = world;

// lite=1 — отключить тени (для слабых устройств и автотестов)
if (params.get('lite') === '1' && sun) {
  sun.castShadow = false;
  renderer.shadowMap.enabled = false;
}

// Цикл дня и ночи: hour= — стартовый час (0-23), day= — длительность суток в секундах
const dayNight = new DayNight({
  scene, sun, hemi, amb,
  startHour: parseFloat(params.get('hour') || '9.5'),
  dayLength: parseFloat(params.get('day') || '600'),
});
scene.add(sun.target); // цель солнца нужна в сцене для корректного направления света

let player = null;
let forest = null;
let started = false;
let skyDome = null;
let inventory = null;
let pickups = null;
let handItem = null;
let inventoryOpen = false;
let invUI = null;

// Небесный купол: фото-панорама (Skyrim-style) днём, растворяется к ночи
// (текстуры ≤1024px для мобильных, 2048 для десктопа)
{
  const tex = IS_MOBILE
    ? './assets/textures/sky_day_1k.jpg'
    : './assets/textures/sky_day_2k.jpg';
  skyDome = new SkyDome(scene, tex);
}

// ── Сборка мира ──
async function build() {
  loadingText.textContent = 'Загрузка леса…';

  const groundP = createGround(scene, './assets/textures/').then(() => {
    loadingText.textContent = 'Земля готова, сажаем сосны…';
  });

  // Две CC0-модели сосен (Quaternius): pine_full — пушистая (основа леса),
  // pine_tall — высокая стройная (ярус выше, «старые» сосны). Параллельная загрузка.
  const [gltfFull, gltfTall] = await Promise.all([
    new Promise((res, rej) => {
      new GLTFLoader().load('./assets/models/pine_full.glb', res, undefined, rej);
    }),
    new Promise((res, rej) => {
      new GLTFLoader().load('./assets/models/pine_tall.glb', res, undefined, rej);
    }),
  ]);
  // fallback: если что-то не загрузилось — лес из одной модели
  const partsFull = extractMeshes(gltfFull.scene);
  const partsTall = gltfTall ? extractMeshes(gltfTall.scene) : null;

  await groundP;

  const models = partsTall
    ? [
        { parts: partsFull, weight: 0.62, sMin: 0.95, sMax: 1.7 },   // пушистая сосна — масса леса
        { parts: partsTall, weight: 0.38, sMin: 1.25, sMax: 2.1 },   // высокая стройная — «старый лес»
      ]
    : [{ parts: partsFull, weight: 1, sMin: 0.9, sMax: 1.9 }];
  forest = new Forest(scene, models, {});

  // density — для тестов/слабых устройств (по умолчанию 0.055)
  const density = Math.max(0.002, parseFloat(params.get('density') || '0.055'));
  forest.generate(density);
  loadingText.textContent = `Посажено сосен: ${forest.count}…`;

  player = new Player(camera, forest);
  player.teleport(0, 0, 0);

  // Инвентарь и собираемые предметы
  inventory = new Inventory();
  // GLB-модели камня/ветки (CC0) — до разброса пикапов
  await loadItemModels();
  pickups = new Pickups(scene);
  pickups.scatter();
  pickups.onPick = (id, count) => {
    inventory.add(id, count);
    showToast(`+${count} ${ITEMS[id].name}`);
  };
  handItem = new HandItem(camera);
  syncHandItem(inventory, handItem);

  // UI хотбара и инвентаря
  const hotbarUI = new HotbarUI(inventory, document.getElementById('hotbar'));
  invUI = new InventoryUI(
    inventory,
    document.getElementById('inventoryScreen'),
    document.getElementById('invGrid'),
    document.getElementById('invHotbarRow'),
    document.getElementById('invCloseBtn'),
    () => {
      inventoryOpen = false;
      // возвращаем захват мыши (если игра запущена и не на мобильном)
      if (started && !IS_MOBILE) input.requestLock();
    }
  );
  inventory.onChange = () => { hotbarUI.render(); invUI.render(); syncHandItem(inventory, handItem); };
  inventory.onActiveChange = () => { hotbarUI.renderActive(); invUI.render(); syncHandItem(inventory, handItem); };

  // следящая тень за игроком (солнце позиционирует daynight)
  if (sun) {
    sun.target.position.set(0, 0, 0);
  }

  scene.add(camera); // чтобы можно было вешать объекты на камеру

  loadingEl.classList.add('hidden');
  startScreen.classList.remove('hidden');

  // Авторежим для тестов: ?auto=1&x=10&z=-20&yaw=2&pitch=-0.3 — сразу в игре в точке
  if (params.get('auto') === '1') {
    const tx = parseFloat(params.get('x') || '0');
    const tz = parseFloat(params.get('z') || '0');
    const tyaw = parseFloat(params.get('yaw') || '0');
    const tpit = params.get('pitch') !== null ? parseFloat(params.get('pitch')) : undefined;
    player.teleport(tx, tz, tyaw, tpit);
    started = true;
    startScreen.classList.add('hidden');
    crosshair.style.display = 'block';
  }

  // отладочный хук для автотестов
  window.__game = { player, forest, scene, camera, IS_MOBILE, inventory, pickups, handItem };
  window.__pauseRender = () => { started = false; cancelAnimationFrame(rafId); };
}

// ── Управление стартом/паузой ──
function startGame() {
  started = true;
  startScreen.classList.add('hidden');
  pauseScreen.style.display = 'none';
  crosshair.style.display = 'block';
  if (IS_MOBILE) {
    // показываем hint ненадолго
  } else {
    input.requestLock();
  }
}

const input = IS_MOBILE
  ? null
  : new InputManager({ player: null, isMobile: false, canvas, onLockChange: (locked) => {
      // при открытом инвентаре мы сами снимаем лок — паузу не показываем
      if (inventoryOpen) return;
      if (started && !locked) {
        pauseScreen.style.display = 'flex';
        crosshair.style.display = 'none';
      } else if (locked) {
        pauseScreen.style.display = 'none';
        crosshair.style.display = 'block';
      }
    }});

startBtn.addEventListener('click', startGame);
resumeBtn.addEventListener('click', () => {
  input && input.requestLock();
});

canvas.addEventListener('click', () => {
  if (started && !IS_MOBILE && !input.state.locked) startGame();
});

// на мобильном input создаём после player (player нужен в конструкторе)
if (IS_MOBILE) {
  build().then(() => {
    window.__input = new InputManager({ player, isMobile: true, canvas, onLockChange: null });
    startBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startGame(); }, { passive: false });
  });
} else {
  build().then(() => {
    input.player = player;
  });
}

// ── Цикл ──
const clock = new THREE.Clock();
let frames = 0, fpsTime = 0;
let rafId = 0;
// once=1 — отрисовать ~10 кадров и остановиться (для headless-скриншотов)
const onceMode = params.get('once') === '1';
let onceCount = 0;

function loop() {
  rafId = requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (player) {
    if (started && !inventoryOpen) {
      if (window.__input) window.__input.applyToPlayer();
      else input && input.applyToPlayer();
      player.update(dt);
    }
    // сбор предметов: подсказка о ближайшем, сбор — только по кнопке (F / кнопка «Собрать»)
    if (pickups) {
      const near = pickups.nearest(player.pos);
      const hint = document.getElementById('pickupHint');
      const btn = document.getElementById('pickupBtn');
      if (near) {
        if (hint) {
          hint.innerHTML = `<span class="kbd">F</span>Подобрать: ${ITEMS[near.id]?.name || near.id}`;
          hint.classList.remove('hidden');
        }
        if (btn) btn.classList.remove('hidden');
      } else {
        if (hint) hint.classList.add('hidden');
        if (btn) btn.classList.add('hidden');
      }
    }
    if (handItem) handItem.update(dt, started && (player.keys.fwd !== 0 || player.keys.strafe !== 0));
    forest.update(player.pos);
    dayNight.update(dt, player.pos);
    if (skyDome) {
      skyDome.follow(player.pos);
      skyDome.update(dayNight, dt);
    }
  } else {
    dayNight.update(dt, null);
    if (skyDome) skyDome.update(dayNight, dt);
  }

  renderer.render(scene, camera);

  // once-режим: после 10 кадров останавливаем цикл
  if (onceMode && ++onceCount >= 10) {
    cancelAnimationFrame(rafId);
  }

  // FPS
  frames++;
  fpsTime += dt;
  if (fpsTime >= 0.5) {
    fpsEl.textContent = Math.round(frames / fpsTime) + ' fps';
    frames = 0; fpsTime = 0;
  }
}

window.addEventListener('keydown', (e) => {
  // T — ускорение/замедление времени (только десктоп, не в чате/инпутах)
  if ((e.key === 't' || e.key === 'T' || e.key === 'к' || e.key === 'К') &&
      !IS_MOBILE && dayNight &&
      !/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName || '')) {
    dayNight.toggleSpeed();
  }
  // F — подобрать ближайший предмет (и русская «а»)
  if ((e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А') &&
      pickups && started && !inventoryOpen) {
    const got = pickups.collect(player.pos);
    // onPick уже добавил в инвентарь и показал тост
  }
  // E — открыть/закрыть инвентарь (и русская раскладка «у»)
  if ((e.key === 'e' || e.key === 'E' || e.key === 'у' || e.key === 'У') && inventory && !inventoryOpen) {
    openInventory();
  } else if (e.key === 'Escape' && inventoryOpen) {
    closeInventory();
  }
  // 1-9 — выбор слота хотбара
  if (inventory && /^[1-9]$/.test(e.key)) {
    inventory.setActive(parseInt(e.key, 10) - 1);
  }
});

// Колесо мыши — переключение слота хотбара (десктоп, когда лок активен)
window.addEventListener('wheel', (e) => {
  if (inventory && !inventoryOpen && input && input.state.locked) {
    inventory.cycle(e.deltaY > 0 ? 1 : -1);
  }
}, { passive: true });

// Мобильная кнопка «РЮКЗАК»
const invBtn = document.getElementById('invBtn');
if (invBtn) {
  invBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (started) toggleInventory();
  }, { passive: false });
  invBtn.addEventListener('click', () => {
    if (started) toggleInventory();
  });
}

// Мобильная кнопка «Собрать» — появляется, когда рядом есть предмет
const pickupBtn = document.getElementById('pickupBtn');
if (pickupBtn) {
  const doPick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (started && pickups) pickups.collect(player.pos);
  };
  pickupBtn.addEventListener('touchstart', doPick, { passive: false });
  pickupBtn.addEventListener('click', doPick);
}

function toggleInventory() {
  if (inventoryOpen) closeInventory();
  else openInventory();
}

function openInventory() {
  if (!inventory || !started) return;
  inventoryOpen = true;
  // на десктопе отпускаем захват мыши, чтобы кликать по UI
  if (input && input.state.locked) {
    document.exitPointerLock();
  }
  if (invUI) invUI.open();
  document.getElementById('invBtn')?.classList.add('active');
}

function closeInventory() {
  if (!inventoryOpen) return;
  inventoryOpen = false;
  if (invUI) invUI.close(); // onClose вернёт захват мыши
  document.getElementById('invBtn')?.classList.remove('active');
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

loop();
