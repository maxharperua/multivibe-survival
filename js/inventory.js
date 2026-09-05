// inventory.js — инвентарь и хотбар (стаки по 64, как в Minecraft)
// 36 слотов: 0..8 — хотбар, 9..35 — рюкзак. Рендер UI через колбэк.
import { ITEMS } from './items.js';

export const HOTBAR_SIZE = 9;
export const INVENTORY_SIZE = 36; // 9 (хотбар) + 27 (рюкзак)
const MAX_STACK = 64;

export class Inventory {
  constructor() {
    // слот: { id, count } | null
    this.slots = new Array(INVENTORY_SIZE).fill(null);
    this.active = 0;            // активный слот хотбара
    this.onChange = null;       // () => void — перерисовать UI
    this.onActiveChange = null; // () => void
  }

  // ── Добавление ──
  // Пытается сложить count предметов id. Возвращает, сколько НЕ влезло.
  add(id, count) {
    let rest = count;
    const stack = ITEMS[id] ? ITEMS[id].stack : MAX_STACK;

    // 1) в уже существующие стаки того же предмета
    for (let i = 0; i < this.slots.length && rest > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id && s.count < stack) {
        const take = Math.min(rest, stack - s.count);
        s.count += take;
        rest -= take;
      }
    }
    // 2) в пустые слоты (сначала хотбар, потом рюкзак)
    for (let i = 0; i < this.slots.length && rest > 0; i++) {
      if (!this.slots[i]) {
        const take = Math.min(rest, stack);
        this.slots[i] = { id, count: take };
        rest -= take;
      }
    }
    this._changed();
    return rest;
  }

  // Взять count предметов из инвентаря (из любых слотов). Вернёт сколько взяли.
  remove(id, count) {
    let need = count;
    for (let i = this.slots.length - 1; i >= 0 && need > 0; i--) {
      const s = this.slots[i];
      if (s && s.id === id) {
        const take = Math.min(need, s.count);
        s.count -= take;
        need -= take;
        if (s.count <= 0) this.slots[i] = null;
      }
    }
    this._changed();
    return count - need;
  }

  countOf(id) {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.count;
    return n;
  }

  // ── Хотбар ──
  get activeSlot() { return this.slots[this.active] || null; }

  setActive(i) {
    if (i < 0 || i >= HOTBAR_SIZE || i === this.active) return;
    this.active = i;
    if (this.onActiveChange) this.onActiveChange();
  }

  // Перенос/обмен предмета из рюкзака в активный слот хотбара (или обратно)
  // usedSlot — индекс слота рюкзака; возвращает true, если что-то изменилось
  moveToHotbar(usedSlot) {
    if (usedSlot < HOTBAR_SIZE) return false; // слот хотбара — не сюда
    const src = this.slots[usedSlot];
    if (!src) return false;
    const dst = this.slots[this.active];
    if (!dst) {
      this.slots[this.active] = src;
      this.slots[usedSlot] = null;
    } else if (dst.id === src.id) {
      // объединение стаков (с учётом лимита)
      const cap = ITEMS[dst.id] ? ITEMS[dst.id].stack : MAX_STACK;
      const move = Math.min(src.count, cap - dst.count);
      if (move > 0) {
        dst.count += move;
        src.count -= move;
        if (src.count <= 0) this.slots[usedSlot] = null;
      }
    } else {
      // обмен
      this.slots[this.active] = src;
      this.slots[usedSlot] = dst;
    }
    this._changed();
    return true;
  }

  // Свап двух слотов (drag'n'drop между ячейками инвентаря)
  swap(a, b) {
    const tmp = this.slots[a];
    this.slots[a] = this.slots[b];
    this.slots[b] = tmp;
    this._changed();
  }

  // Переключить активный слот на следующий/предыдущий (колесо мыши)
  cycle(dir) {
    let i = this.active + dir;
    if (i < 0) i = HOTBAR_SIZE - 1;
    if (i >= HOTBAR_SIZE) i = 0;
    this.setActive(i);
  }

  _changed() {
    if (this.onChange) this.onChange();
  }
}
