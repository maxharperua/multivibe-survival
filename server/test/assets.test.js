// server/test/assets.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ASSET_TYPES,
  ASSETS,
  getAsset,
  isSolid,
  getCollisionBox,
  getLOD,
} from '../assets.js';

test('1. Exactly 7 required asset types are exported', () => {
  const expected = ['pine', 'stone', 'bush', 'mushroom', 'campfire', 'shelter', 'boulder'];
  assert.equal(ASSET_TYPES.length, 7);
  assert.deepEqual([...ASSET_TYPES].sort(), [...expected].sort());
  for (const type of expected) {
    assert.ok(ASSETS[type], `Missing ASSETS[${type}]`);
    assert.equal(ASSETS[type].type, type);
    assert.ok(ASSETS[type].name.length > 0, `Missing name for ${type}`);
  }
});

test('2. Dimensions are positive numbers for all assets', () => {
  for (const type of ASSET_TYPES) {
    const { dims } = ASSETS[type];
    assert.ok(dims && typeof dims === 'object', `${type} dims must be an object`);
    const values = Object.values(dims);
    assert.ok(values.length > 0, `${type} must have dimensions`);
    for (const val of values) {
      assert.equal(typeof val, 'number', `${type} dimension value must be number`);
      assert.ok(val > 0, `${type} dimension value must be positive`);
    }
  }
});

test('3. Material colors are valid hex strings (#RRGGBB)', () => {
  const hexRe = /^#[0-9a-fA-F]{6}$/;
  for (const type of ASSET_TYPES) {
    const { mats } = ASSETS[type];
    assert.ok(mats && typeof mats === 'object');
    for (const [matName, matDef] of Object.entries(mats)) {
      assert.ok(hexRe.test(matDef.color), `${type}.${matName} invalid color: ${matDef.color}`);
      if (matDef.emissive) {
        assert.ok(hexRe.test(matDef.emissive), `${type}.${matName} invalid emissive: ${matDef.emissive}`);
      }
      assert.ok(matDef.roughness >= 0 && matDef.roughness <= 1);
      assert.ok(matDef.metalness >= 0 && matDef.metalness <= 1);
    }
  }
});

test('4. Collision geometry definitions and bounds calculation', () => {
  const box = getCollisionBox('pine', 10, 20);
  assert.equal(box.shape, 'cylinder');
  assert.equal(box.x, 10);
  assert.equal(box.z, 20);
  assert.equal(box.radius, 0.35);
  assert.equal(box.solid, true);

  const bBox = getCollisionBox('shelter', 0, 0);
  assert.equal(bBox.shape, 'box');
  assert.equal(bBox.minX, -1.2);
  assert.equal(bBox.maxX, 1.2);
  assert.equal(bBox.minZ, -1.4);
  assert.equal(bBox.maxZ, 1.4);
  assert.equal(bBox.solid, true);
});

test('5. getAsset fallback behavior', () => {
  const valid = getAsset('campfire');
  assert.equal(valid.type, 'campfire');

  const fallback = getAsset('unknown_alien_artifact');
  assert.equal(fallback.type, 'stone');
});

test('6. isSolid partition', () => {
  // Solid obstacles (stop player movement)
  assert.equal(isSolid('pine'), true);
  assert.equal(isSolid('campfire'), true);
  assert.equal(isSolid('shelter'), true);
  assert.equal(isSolid('boulder'), true);

  // Walk-through / small / pickable items
  assert.equal(isSolid('stone'), false);
  assert.equal(isSolid('bush'), false);
  assert.equal(isSolid('mushroom'), false);
});

test('7. LOD distance bands', () => {
  assert.equal(getLOD('pine', 5), 0);
  assert.equal(getLOD('pine', 19.9), 0);
  assert.equal(getLOD('pine', 20), 1);
  assert.equal(getLOD('pine', 45), 1);
  assert.equal(getLOD('pine', 50), 2);
  assert.equal(getLOD('pine', 120), 2);
});

