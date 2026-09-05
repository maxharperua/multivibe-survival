// crafting.js — панель крафта в инвентаре.
// Рецепты из recipes.js (движок от huddora-ambassador-1857, влит в main).
// Инвентарь локальный (клиентский) — серверная валидация крафта следующий шаг.
import { RECIPES, craft, ITEM_NAMES } from './recipes.js';
import { itemIcon } from './ui.js';

export class CraftPanel {
  constructor(listEl, inventory, onToast) {
    this.listEl = listEl;          // div#craftList
    this.inv = inventory;
    this.onToast = onToast || (() => {});
    this.rows = new Map();         // recipeId -> { btn, row, matsEl }
    this._build();
  }

  _build() {
    for (const recipe of RECIPES) {
      const row = document.createElement('div');
      row.className = 'craft-row';

      const left = document.createElement('div');
      left.className = 'craft-left';

      const title = document.createElement('div');
      title.className = 'craft-title';
      title.textContent = ITEM_NAMES[recipe.id] || recipe.id;
      left.appendChild(title);

      const mats = document.createElement('div');
      mats.className = 'craft-mats';
      left.appendChild(mats);

      const btn = document.createElement('button');
      btn.className = 'craft-btn';
      btn.textContent = 'Создать';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._craft(recipe.id);
      });

      row.appendChild(left);
      row.appendChild(btn);
      this.listEl.appendChild(row);
      this.rows.set(recipe.id, { row, btn, mats });
    }
    this.render();
  }

  // «материалы: 2 палки · 2 камня» + подсветка нехватки
  _renderMats(recipe, have) {
    const parts = Object.entries(recipe.in).map(([id, qty]) => {
      const n = have[id] || 0;
      const ok = n >= qty;
      return `<span class="${ok ? 'mat-ok' : 'mat-miss'}">${qty} ${ITEM_NAMES[id] || id}</span>`;
    });
    return parts.join(' · ');
  }

  render() {
    for (const recipe of RECIPES) {
      const have = {};
      for (const id of Object.keys(recipe.in)) have[id] = this.inv.countOf(id);
      const can = Object.entries(recipe.in).every(([id, qty]) => (have[id] || 0) >= qty);
      const el = this.rows.get(recipe.id);
      if (!el) continue;
      el.mats.innerHTML = this._renderMats(recipe, have);
      el.btn.disabled = !can;
      el.row.classList.toggle('can-craft', can);
    }
  }

  _craft(recipeId) {
    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) return;
    const have = {};
    for (const id of Object.keys(recipe.in)) have[id] = this.inv.countOf(id);
    const res = craft(recipeId, have);
    if (!res.ok) {
      this.onToast('Не хватает материалов');
      return;
    }
    // списываем материалы и выдаём результат
    for (const [id, qty] of Object.entries(recipe.in)) this.inv.remove(id, qty);
    for (const [id, qty] of Object.entries(recipe.out)) this.inv.add(id, qty);
    const outNames = Object.entries(recipe.out)
      .map(([id, qty]) => `${qty} ${ITEM_NAMES[id] || id}`).join(', ');
    this.onToast(`Скрафчено: ${outNames}`);
    this.render();
  }
}
