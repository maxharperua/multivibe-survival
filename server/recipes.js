// recipes.js — DayZ-lite Crafting Engine (0 deps, pure ESM)
export const ITEMS = [
  "stick", "stone", "fiber", "berry", "meat",
  "wood", "plank", "rope", "axe", "spear",
  "campfire_kit", "shelter_kit", "cooked_meat"
];

export const RECIPES = [
  { id: "rope", in: { fiber: 3 }, out: { rope: 1 } },
  { id: "stick", in: { wood: 1 }, out: { stick: 4 } },
  { id: "plank", in: { wood: 1 }, out: { plank: 4 } },
  { id: "axe", in: { stick: 2, stone: 2, rope: 1 }, out: { axe: 1 } },
  { id: "spear", in: { stick: 3, rope: 1, stone: 1 }, out: { spear: 1 } },
  { id: "campfire_kit", in: { stick: 4, stone: 4, fiber: 2 }, out: { campfire_kit: 1 } },
  { id: "shelter_kit", in: { wood: 4, plank: 4, rope: 2 }, out: { shelter_kit: 1 } },
  { id: "cooked_meat", in: { meat: 1, stick: 2 }, out: { cooked_meat: 1 } }
];

export function craft(recipeId, inv = {}) {
  const recipe = RECIPES.find(r => r.id === recipeId);
  if (!recipe) {
    return { ok: false, error: "UNKNOWN_RECIPE", inv: { ...inv } };
  }

  // Check inputs
  for (const [item, qty] of Object.entries(recipe.in)) {
    if ((inv[item] || 0) < qty) {
      return { ok: false, error: "INSUFFICIENT_MATERIALS", inv: { ...inv } };
    }
  }

  // Immutable state transition
  const nextInv = { ...inv };
  for (const [item, qty] of Object.entries(recipe.in)) {
    nextInv[item] -= qty;
    if (nextInv[item] <= 0) delete nextInv[item];
  }
  for (const [item, qty] of Object.entries(recipe.out)) {
    nextInv[item] = (nextInv[item] || 0) + qty;
  }

  return { ok: true, out: { ...recipe.out }, inv: nextInv };
}

// ================= TEST SUITE (node --test) =================
if (process.argv[1]?.endsWith("recipes.js") || process.env.TEST) {
  const { test } = await import("node:test");
  const assert = (await import("node:assert/strict")).default;

  test("recipes: invariants & validation", () => {
    assert.ok(RECIPES.length >= 8, "Must have >= 8 recipes");
    for (const r of RECIPES) {
      const inKeys = Object.keys(r.in);
      const outKeys = Object.keys(r.out);
      assert.ok(inKeys.length > 0, "Inputs > 0");
      assert.ok(outKeys.length > 0, "Outputs > 0");
      for (const k of inKeys) {
        assert.ok(ITEMS.includes(k), `Invalid input item: ${k}`);
        assert.ok(r.in[k] > 0, "Input quantity must be positive");
      }
      for (const k of outKeys) {
        assert.ok(ITEMS.includes(k), `Invalid output item: ${k}`);
        assert.ok(r.out[k] > 0, "Output quantity must be positive");
        assert.ok(!inKeys.includes(k), "No self-crafting allowed");
      }
    }
  });

  test("craft: execution, deduction and failures", () => {
    // 1. Success path
    const r1 = craft("rope", { fiber: 5, stone: 1 });
    assert.deepEqual(r1, { ok: true, out: { rope: 1 }, inv: { fiber: 2, stone: 1, rope: 1 } });

    // 2. Exact match (clean deletion)
    const r2 = craft("rope", { fiber: 3 });
    assert.deepEqual(r2, { ok: true, out: { rope: 1 }, inv: { rope: 1 } });

    // 3. Insufficient materials
    const r3 = craft("axe", { stick: 2, stone: 1 });
    assert.equal(r3.ok, false);
    assert.deepEqual(r3.inv, { stick: 2, stone: 1 });

    // 4. Unknown recipe
    const r4 = craft("laser_gun", { stick: 10 });
    assert.equal(r4.ok, false);
  });
}
