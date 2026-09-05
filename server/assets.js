// server/assets.js
/**
 * assets.js — Параметрические описания 3D-ассетов для Three.js сцены DayZ-lite (game.multivibe.ru).
 * Чистый ESM, 0 сторонних зависимостей. Совместим как с сервером (Node.js), так и с браузерным клиентом.
 *
 * Описывает 7 ключевых объектов открытого мира:
 * 1. pine (сосна)
 * 2. stone (камень)
 * 3. bush (куст)
 * 4. mushroom (гриб)
 * 5. campfire (костёр)
 * 6. shelter (укрытие)
 * 7. boulder (валун)
 */

export const ASSET_TYPES = [
  'pine',
  'stone',
  'bush',
  'mushroom',
  'campfire',
  'shelter',
  'boulder',
];

export const ASSETS = Object.freeze({
  pine: Object.freeze({
    type: 'pine',
    name: 'Сосна',
    dims: Object.freeze({ trunkRadius: 0.25, trunkHeight: 6.0, crownRadius: 2.2, crownHeight: 5.5 }),
    mats: Object.freeze({
      trunk: Object.freeze({ color: '#4a2f13', roughness: 0.9, metalness: 0.0 }),
      foliage: Object.freeze({ color: '#1b3f1f', roughness: 0.7, metalness: 0.0 }),
    }),
    collision: Object.freeze({ shape: 'cylinder', radius: 0.35, height: 6.0, solid: true }),
    interactable: true,
    resource: 'wood',
  }),

  stone: Object.freeze({
    type: 'stone',
    name: 'Камень',
    dims: Object.freeze({ width: 0.6, height: 0.35, depth: 0.5 }),
    mats: Object.freeze({
      surface: Object.freeze({ color: '#7a7672', roughness: 0.85, metalness: 0.05 }),
    }),
    collision: Object.freeze({ shape: 'box', width: 0.6, height: 0.35, depth: 0.5, solid: false }),
    interactable: true,
    resource: 'stone',
  }),

  bush: Object.freeze({
    type: 'bush',
    name: 'Куст',
    dims: Object.freeze({ radius: 1.1, height: 1.4 }),
    mats: Object.freeze({
      leaves: Object.freeze({ color: '#2d6a2e', roughness: 0.65, metalness: 0.0 }),
      branches: Object.freeze({ color: '#3d2b1f', roughness: 0.95, metalness: 0.0 }),
    }),
    collision: Object.freeze({ shape: 'cylinder', radius: 0.9, height: 1.4, solid: false }),
    interactable: true,
    resource: 'sticks',
  }),

  mushroom: Object.freeze({
    type: 'mushroom',
    name: 'Гриб',
    dims: Object.freeze({ stemRadius: 0.04, stemHeight: 0.15, capRadius: 0.12, capHeight: 0.08 }),
    mats: Object.freeze({
      cap: Object.freeze({ color: '#a63328', roughness: 0.4, metalness: 0.0 }),
      stem: Object.freeze({ color: '#eae5d8', roughness: 0.6, metalness: 0.0 }),
    }),
    collision: Object.freeze({ shape: 'box', width: 0.25, height: 0.25, depth: 0.25, solid: false }),
    interactable: true,
    resource: 'food',
  }),

  campfire: Object.freeze({
    type: 'campfire',
    name: 'Костёр',
    dims: Object.freeze({ baseRadius: 0.8, logHeight: 0.4, flameHeight: 1.0 }),
    mats: Object.freeze({
      stones: Object.freeze({ color: '#454341', roughness: 0.9, metalness: 0.0 }),
      logs: Object.freeze({ color: '#2b1d0c', roughness: 0.95, metalness: 0.0 }),
      embers: Object.freeze({ color: '#ff4800', roughness: 0.2, metalness: 0.0, emissive: '#ff2200' }),
    }),
    collision: Object.freeze({ shape: 'cylinder', radius: 0.75, height: 0.6, solid: true }),
    interactable: true,
    resource: 'heat_source',
  }),

  shelter: Object.freeze({
    type: 'shelter',
    name: 'Укрытие',
    dims: Object.freeze({ width: 2.4, height: 1.8, depth: 2.8 }),
    mats: Object.freeze({
      frame: Object.freeze({ color: '#3f2812', roughness: 0.9, metalness: 0.0 }),
      tarp: Object.freeze({ color: '#2b3824', roughness: 0.8, metalness: 0.0 }),
    }),
    collision: Object.freeze({ shape: 'box', width: 2.4, height: 1.8, depth: 2.8, solid: true }),
    interactable: true,
    resource: 'respawn_point',
  }),

  boulder: Object.freeze({
    type: 'boulder',
    name: 'Валун',
    dims: Object.freeze({ width: 2.8, height: 2.2, depth: 2.5 }),
    mats: Object.freeze({
      rock: Object.freeze({ color: '#5e5a55', roughness: 0.9, metalness: 0.05 }),
      moss: Object.freeze({ color: '#384d28', roughness: 0.85, metalness: 0.0 }),
    }),
    collision: Object.freeze({ shape: 'box', width: 2.8, height: 2.2, depth: 2.5, solid: true }),
    interactable: false,
    resource: null,
  }),
});

/**
 * Получить спецификацию ассета по типу.
 * При неизвестном типе возвращает fallback (stone).
 */
export function getAsset(type) {
  if (typeof type === 'string' && ASSETS[type]) {
    return ASSETS[type];
  }
  return ASSETS.stone;
}

/**
 * Проверка на твёрдость (блокирует ли перемещение игрока).
 */
export function isSolid(type) {
  const asset = getAsset(type);
  return Boolean(asset.collision && asset.collision.solid);
}

/**
 * Расчет collision boundary с учетом мировой позиции [x, z].
 */
export function getCollisionBox(type, x = 0, z = 0) {
  const asset = getAsset(type);
  const col = asset.collision;
  if (col.shape === 'cylinder') {
    return {
      shape: 'cylinder',
      x,
      z,
      radius: col.radius,
      height: col.height,
      solid: col.solid,
    };
  }
  return {
    shape: 'box',
    minX: x - col.width / 2,
    maxX: x + col.width / 2,
    minZ: z - col.depth / 2,
    maxZ: z + col.depth / 2,
    height: col.height,
    solid: col.solid,
  };
}

/**
 * Расчет уровня детализации (LOD) по дистанции до камеры:
 * LOD 0: 0 .. 20м (полная геометрия, процедурные детали)
 * LOD 1: 20 .. 50м (упрощенная форма, без суб-мешей)
 * LOD 2: > 50м (импостор / билборд / базовый примитив)
 */
export function getLOD(type, distance) {
  if (distance < 20) return 0;
  if (distance < 50) return 1;
  return 2;
}

