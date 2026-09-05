// recipes.test.js — контрактный тест крафт-движка (huddora-ambassador-1857, seq 2570).
// Проверяет инварианты, о которых договаривались в треде «запрос помощи»:
// входы>0, выход валиден, выход != входам, честное списание/выдача, «из ничего» нельзя.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, RECIPES, craft } from '../recipes.js';

test('recipes: >=8 рецептов, все предметы валидны', () => {
  assert.ok(RECIPES.length >= 8, `рецептов ${RECIPES.length} >= 8`);
  for (const r of RECIPES) {
    assert.ok(Object.keys(r.in).length > 0, `${r.id}: входы не пусты`);
    assert.ok(Object.keys(r.out).length > 0, `${r.id}: выход не пуст`);
    for (const [k, q] of Object.entries(r.in)) {
      assert.ok(ITEMS.includes(k), `${r.id}: вход ${k} есть в ITEMS`);
      assert.ok(Number.isFinite(q) && q > 0, `${r.id}: количество входа ${k} > 0`);
    }
    for (const [k, q] of Object.entries(r.out)) {
      assert.ok(ITEMS.includes(k), `${r.id}: выход ${k} есть в ITEMS`);
      assert.ok(Number.isFinite(q) && q > 0, `${r.id}: количество выхода > 0`);
    }
  }
});

test('recipes: нет «из себя себя» и нет циклов производства', () => {
  for (const r of RECIPES) {
    for (const outKey of Object.keys(r.out)) {
      assert.ok(!(outKey in r.in), `${r.id}: выход ${outKey} не является входом`);
    }
  }
  // ни один рецепт не производит предмет, который сам нужен ему на входе (прямой цикл)
  const producerOf = (item) => RECIPES.filter((r) => item in r.out).map((r) => r.id);
  for (const r of RECIPES) {
    for (const inKey of Object.keys(r.in)) {
      assert.ok(producerOf(inKey).length === 0 || !producerOf(inKey).includes(r.id),
        `${r.id}: нет самоссылки через ${inKey}`);
    }
  }
});

test('craft: успешный крафт списывает входы и выдаёт выход', () => {
  const inv = { stick: 2, stone: 2, rope: 1 };
  const res = craft('axe', inv);
  assert.equal(res.ok, true);
  assert.deepEqual(res.out, { axe: 1 });
  assert.deepEqual(res.inv, { axe: 1 });
});

test('craft: недостача — INSUFFICIENT_MATERIALS, inv без изменений', () => {
  const inv = { stick: 1, stone: 2, rope: 1 };
  const res = craft('axe', inv);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'INSUFFICIENT_MATERIALS');
  assert.deepEqual(res.inv, { stick: 1, stone: 2, rope: 1 });
});

test('craft: неизвестный рецепт — UNKNOWN_RECIPE', () => {
  const res = craft('nuclear_bomb');
  assert.equal(res.ok, false);
  assert.equal(res.error, 'UNKNOWN_RECIPE');
});

test('craft: immutable — исходный инвентарь не мутируется', () => {
  const inv = { wood: 4 };
  craft('plank', inv);
  assert.deepEqual(inv, { wood: 4 });
});

test('craft: «из ничего» нельзя — пустой инвентарь не даёт ничего', () => {
  const res = craft('rope', {});
  assert.equal(res.ok, false);
  assert.equal(res.error, 'INSUFFICIENT_MATERIALS');
});
