// ui.js — HUD: хотбар, инвентарь, тосты, предмет в руках
// Иконки — инлайн-SVG (без эмодзи), стаки по 64.
import * as THREE from 'three';
import { ITEMS, makeItemMesh } from './items.js';

const SWING_TIME = 0.3; // длительность замаха при атаке, сек
import { HOTBAR_SIZE, INVENTORY_SIZE } from './inventory.js';

// ── SVG-иконки предметов (data URI) ──
const SVG = {
  stone: '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M7 4 L17 3 L21 9 L19 17 L10 20 L4 13 Z" fill="#9a9184" stroke="#6e675c" stroke-width="1.2"/><path d="M7 4 L12 7 L10 20 M17 3 L15 9 L19 17" stroke="#b5ac9e" stroke-width="1" fill="none"/></svg>',
  stick: '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 19 C8 14 12 10 20 5" stroke="#8a6a45" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M11 13 L14 9 M14 10 L18 8 M8 15 L5 13" stroke="#a8844f" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  fiber: '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M5 20 C8 13 16 11 19 4" stroke="#c8b98a" stroke-width="3.4" fill="none" stroke-linecap="round"/><path d="M3 17 C6 10 14 8 17 1" stroke="#a8985f" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>',
  wood: '<svg viewBox="0 0 24 24" width="26" height="26"><rect x="4" y="9" width="16" height="7" rx="2" fill="#6b4f2e" stroke="#4a341a" stroke-width="1.2"/><ellipse cx="4.5" cy="12.5" rx="2" ry="3.5" fill="#8a6a45" stroke="#4a341a" stroke-width="1"/><path d="M12 9 v7 M16 9 v7 M8 9 v7" stroke="#5a4022" stroke-width="1" fill="none"/></svg>',
  berry: '<svg viewBox="0 0 24 24" width="26" height="26"><circle cx="9" cy="14" r="3.2" fill="#b33030" stroke="#7a1f1f" stroke-width="1"/><circle cx="15" cy="12" r="3.2" fill="#cc3d3d" stroke="#7a1f1f" stroke-width="1"/><circle cx="12" cy="18" r="2.6" fill="#9e2929" stroke="#7a1f1f" stroke-width="1"/><path d="M12 11 C12 9 13 8 14 6" stroke="#4a7a2f" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>',
  rope: '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 12 Q9 6 14 12 T24 12" stroke="#d9c48a" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M4 15 Q9 9 14 15 T24 15" stroke="#b8a265" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>',
  plank: '<svg viewBox="0 0 24 24" width="26" height="26"><rect x="3" y="10" width="18" height="4" rx="1" fill="#9a7448" stroke="#6b4f2e" stroke-width="1.2"/><path d="M3 11 h18 M3 13 h18" stroke="#7a5a34" stroke-width="0.7" fill="none"/></svg>',
  axe: '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M6 21 L13 14" stroke="#8a6a45" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M12 13 L20 8 L19 4 L15 5 L10 11 Z" fill="#9a9184" stroke="#5c554b" stroke-width="1"/></svg>',
  spear: '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 20 L17 7" stroke="#8a6a45" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M17 4 L20 7 L16 9 Z" fill="#b5ac9e" stroke="#5c554b" stroke-width="1"/><path d="M12 12 L14 10" stroke="#c8b98a" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>',
  campfire_kit: '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M8 18 L4 22 M16 18 L20 22 M12 18 L8 22 M12 18 L16 22" stroke="#8a6a45" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="12" cy="12" r="4" fill="#d97a2b" stroke="#a04e12" stroke-width="1"/><path d="M12 8 C11 6 12 5 12 3 C14 5 14 6 13 8" fill="#ffb84d" stroke="none"/></svg>',
  shelter_kit: '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 17 L12 6 L20 17 Z" fill="none" stroke="#6b4f2e" stroke-width="2.4" stroke-linejoin="round"/><path d="M3 17 h18" stroke="#8a6a45" stroke-width="2.6" stroke-linecap="round"/><path d="M9 17 L11 14 M15 17 L13 14 M12 14 L12 17" stroke="#a8844f" stroke-width="1.4" fill="none"/></svg>',
  cooked_meat: '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M5 13 C5 8 8 5 13 4 C18 5 19 9 18 13 C17 17 14 19 11 19 C7 19 5 17 5 13 Z" fill="#8a5a2b" stroke="#5c3a16" stroke-width="1.2"/><path d="M8 9 C10 11 11 8 13 10" stroke="#ffd9a0" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>',
};

export function itemIcon(id) {
  return SVG[id] || '';
}

// ── HUD: хотбар ──
export class HotbarUI {
  constructor(inventory, el) {
    this.inv = inventory;
    this.el = el;
    this.slots = [];
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const s = document.createElement('div');
      s.className = 'hb-slot';
      s.innerHTML = `<span class="slot-num">${i + 1}</span>`;
      s.addEventListener('click', (e) => {
        e.stopPropagation();
        this.inv.setActive(i);
        // после клика по хотбару не открываем инвентарь
      });
      el.appendChild(s);
      this.slots.push(s);
    }
    inventory.onChange = () => this.render();
    inventory.onActiveChange = () => this.renderActive();
    this.render();
  }

  render() {
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const s = this.inv.slots[i];
      const el = this.slots[i];
      el.classList.toggle('active', i === this.inv.active);
      if (s) {
        el.innerHTML = `<span class="slot-num">${i + 1}</span>` +
          `<span class="slot-icon">${itemIcon(s.id)}</span>` +
          `<span class="slot-count">${s.count}</span>`;
      } else {
        el.innerHTML = `<span class="slot-num">${i + 1}</span>`;
      }
    }
  }

  renderActive() {
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      this.slots[i].classList.toggle('active', i === this.inv.active);
    }
  }
}

// ── Инвентарь (полноэкранный) ──
export class InventoryUI {
  constructor(inventory, screenEl, gridEl, hotbarRowEl, closeBtn, onClose) {
    this.inv = inventory;
    this.screen = screenEl;
    this.gridEl = gridEl;
    this.hotbarRowEl = hotbarRowEl;
    this.closeBtn = closeBtn;
    this.onClose = onClose || (() => {});
    this.isOpen = false;

    this._buildGrid();
    this._buildHotbarRow();

    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); this.close(); });
    screenEl.addEventListener('click', (e) => {
      // клик по фону закрывает
      if (e.target === screenEl) this.close();
    });

    inventory.onChange = () => this.render();
    inventory.onActiveChange = () => this.render();
  }

  _buildGrid() {
    this.gridSlots = [];
    for (let i = HOTBAR_SIZE; i < INVENTORY_SIZE; i++) {
      const s = document.createElement('div');
      s.className = 'inv-slot';
      s.dataset.idx = i;
      s.addEventListener('click', (e) => {
        e.stopPropagation();
        this.inv.moveToHotbar(i); // перенос в активный слот хотбара
      });
      this.gridEl.appendChild(s);
      this.gridSlots.push(s);
    }
  }

  _buildHotbarRow() {
    this.hbSlots = [];
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const s = document.createElement('div');
      s.className = 'inv-slot';
      s.dataset.idx = i;
      s.addEventListener('click', (e) => {
        e.stopPropagation();
        this.inv.setActive(i);
      });
      this.hotbarRowEl.appendChild(s);
      this.hbSlots.push(s);
    }
  }

  render() {
    // слоты рюкзака
    for (let i = 0; i < this.gridSlots.length; i++) {
      const idx = HOTBAR_SIZE + i;
      const s = this.inv.slots[idx];
      this._fillSlot(this.gridSlots[i], s, idx === this.inv.active);
    }
    // хотбар
    for (let i = 0; i < this.hbSlots.length; i++) {
      const s = this.inv.slots[i];
      this._fillSlot(this.hbSlots[i], s, i === this.inv.active);
    }
  }

  _fillSlot(el, s, active) {
    el.classList.toggle('active', !!active);
    if (s) {
      el.innerHTML = `<span class="slot-icon">${itemIcon(s.id)}</span>` +
        `<span class="slot-count">${s.count}</span>`;
    } else {
      el.innerHTML = '';
    }
  }

  open() {
    this.isOpen = true;
    this.screen.classList.remove('hidden');
    this.render();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.screen.classList.add('hidden');
    this.onClose();
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }
}

// ── Тосты (подбор) ──
export function showToast(text) {
  const wrap = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = text;
  wrap.appendChild(t);
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 450);
  }, 1800);
}

// ── Предмет в руках ──
// Группа, прикреплённая к камере: показываем 3D-модель выбранного предмета
export class HandItem {
  constructor(camera) {
    this.camera = camera;
    this.group = new THREE.Group();
    this.group.position.set(0.42, -0.4, -0.62);
    this.group.rotation.set(-0.15, 0.35, 0);
    camera.add(this.group);
    this.mesh = null;
    this.currentId = null;
    this._t = 0;
    this._swingT = 0;
  }

  setItem(id) {
    if (id === this.currentId) return;
    this.currentId = id;
    if (this.mesh) {
      this.group.remove(this.mesh);
      this.mesh = null;
    }
    if (id && ITEMS[id]) {
      this.mesh = makeItemMesh(id); // GLB-модель (или процедурный fallback)
      if (this.mesh) {
        // предмет в руке: масштаб и поза из описания
        this.mesh.scale.setScalar(ITEMS[id].handScale || 1);
        this.mesh.rotation.set(...(ITEMS[id].handRot || [0, 0, 0]));
        this.group.add(this.mesh);
      }
    }
  }

  // лёгкое покачивание при движении
  update(dt, moving) {
    this._t += dt;
    // замах (атака): резкий рывок вниз-вперёд и возврат
    if (this._swingT > 0) {
      this._swingT -= dt;
      const k = Math.max(0, this._swingT / SWING_TIME); // 1..0
      const s = Math.sin((1 - k) * Math.PI);            // 0..1..0
      this.group.rotation.x = -0.15 - s * 1.15;
      this.group.position.z = -0.62 + s * 0.38;
      this.group.position.y = -0.4 - s * 0.08;
      return;
    }
    const bob = moving ? Math.sin(this._t * 8) * 0.02 : 0;
    this.group.rotation.x = -0.15;
    this.group.position.z = -0.62;
    this.group.position.y = -0.4 + bob;
  }

  // Анимация удара — вызывает атака (топор/копьё)
  swing() {
    this._swingT = SWING_TIME;
  }
}

// ── Обновление предмета в руках по активному слоту ──
export function syncHandItem(inv, hand) {
  const slot = inv.activeSlot;
  hand.setItem(slot ? slot.id : null);
}
