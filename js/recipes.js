// recipes.js (client) — DayZ-lite Crafting Engine.
// Изоморфная копия server/recipes.js (чистый ESM, 0 зависимостей).
// Серверная валидация крафта — следующий шаг (сейчас инвентарь локальный).

export const ITEMS = [
  "stick", "stone", "fiber", "berry", "meat",
  "wood", "plank", "rope", "axe", "spear",
  "campfire_kit", "shelter_kit", "cooked_meat"
];

// Русские названия для UI крафта
export const ITEM_NAMES = {
  stick: "палка", stone: "камень", fiber: "волокно", berry: "ягоды",
  meat: "мясо", wood: "бревно", plank: "доска", rope: "верёвка",
  axe: "топор", spear: "копьё", campfire_kit: "костровой набор",
  shelter_kit: "набор для шалаша", cooked_meat: "жареное мясо",
};

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
  for (const [item, qty] of Object.entries(recipe.in)) {
    if ((inv[item] || 0) < qty) {
      return { ok: false, error: "INSUFFICIENT_MATERIALS", inv: { ...inv } };
    }
  }
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
