import test from "node:test";
import assert from "node:assert/strict";
import { ZONES, WORLD_BOUNDS, SPAWN_POINT, SURVIVOR_GUIDE, getZoneAt } from "../locations.js";

test("Лес: количество зон не менее 6", () => {
  assert.ok(ZONES.length >= 6, `Ожидалось >= 6 зон, получено ${ZONES.length}`);
});

test("Лес: все зоны лежат строго внутри границ мира [-150..150]", () => {
  for (const z of ZONES) {
    assert.ok(z.radius > 5, `Радиус зоны ${z.id} должен быть > 5`);
    assert.ok(z.x - z.radius >= WORLD_BOUNDS.minX, `Зона ${z.id} выходит за minX`);
    assert.ok(z.x + z.radius <= WORLD_BOUNDS.maxX, `Зона ${z.id} выходит за maxX`);
    assert.ok(z.z - z.radius >= WORLD_BOUNDS.minZ, `Зона ${z.id} выходит за minZ`);
    assert.ok(z.z + z.radius <= WORLD_BOUNDS.maxZ, `Зона ${z.id} выходит за maxZ`);
  }
});

test("Лес: спавн (0,0) полностью свободен и безопасен", () => {
  for (const z of ZONES) {
    const distToSpawn = Math.hypot(z.x - SPAWN_POINT.x, z.z - SPAWN_POINT.z);
    assert.ok(
      distToSpawn > z.radius + SPAWN_POINT.safeRadius,
      `Зона ${z.id} накладывается на спавн! Дистанция: ${distToSpawn}, радиус зоны: ${z.radius}`
    );
  }
  assert.equal(getZoneAt(0, 0), null, "Точка спавна не должна принадлежать ни одной зоне");
});

test("Лес: зоны взаимно не пересекаются с буфером > 5 метров", () => {
  for (let i = 0; i < ZONES.length; i++) {
    for (let j = i + 1; j < ZONES.length; j++) {
      const z1 = ZONES[i];
      const z2 = ZONES[j];
      const dist = Math.hypot(z1.x - z2.x, z1.z - z2.z);
      const minAllowedDist = z1.radius + z2.radius + 5;
      assert.ok(
        dist > minAllowedDist,
        `Зоны ${z1.id} и ${z2.id} пересекаются! Дистанция: ${dist.toFixed(2)}, требуется > ${minAllowedDist.toFixed(2)}`
      );
    }
  }
});

test("Лес: getZoneAt точно определяет вхождение в зону", () => {
  for (const z of ZONES) {
    const inside = getZoneAt(z.x, z.z);
    assert.ok(inside, `Центр зоны ${z.id} должен определяться getZoneAt`);
    assert.equal(inside.id, z.id);
  }
});

test("Лес: путеводитель лаконичен (<= 200 слов) и содержит все ключевые зоны", () => {
  const words = SURVIVOR_GUIDE.trim().split(/\s+/).filter(Boolean);
  assert.ok(words.length <= 200, `Путеводитель превышает 200 слов: ${words.length}`);
  assert.ok(words.length > 30, `Путеводитель слишком короткий: ${words.length}`);
  for (const z of ZONES) {
    assert.ok(
      SURVIVOR_GUIDE.includes(z.name),
      `Путеводитель не упоминает зону: ${z.name}`
    );
  }
});
