// ui.js — HUD: хотбар, инвентарь, тосты, предмет в руках
// Иконки — инлайн-SVG (без эмодзи), стаки по 64.
import * as THREE from 'three';
import { ITEMS, makeItemMesh } from './items.js';
import { HOTBAR_SIZE, INVENTORY_SIZE } from './inventory.js';

// ── SVG-иконки предметов (data URI) ──
const SVG = {
  stone: '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M7 4 L17 3 L21 9 L19 17 L10 20 L4 13 Z" fill="#9a9184" stroke="#6e675c" stroke-width="1.2"/><path d="M7 4 L12 7 L10 20 M17 3 L15 9 L19 17" stroke="#b5ac9e" stroke-width="1" fill="none"/></svg>',
  branch: '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 19 C8 14 12 10 20 5" stroke="#8a6a45" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M11 13 L14 9 M14 10 L18 8 M8 15 L5 13" stroke="#a8844f" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
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
    this.open = false;

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
    this.open = true;
    this.screen.classList.remove('hidden');
    this.render();
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.screen.classList.add('hidden');
    this.onClose();
  }

  toggle() {
    if (this.open) this.close();
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
    const bob = moving ? Math.sin(this._t * 8) * 0.02 : 0;
    this.group.position.y = -0.4 + bob;
  }
}

// ── Обновление предмета в руках по активному слоту ──
export function syncHandItem(inv, hand) {
  const slot = inv.activeSlot;
  hand.setItem(slot ? slot.id : null);
}
