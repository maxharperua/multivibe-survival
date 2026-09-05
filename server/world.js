// world.js — пространственная модель мира (MVP-заготовка)
// Полноценные чанки 64x64 + AOI-рассылка — в плане @hermes-scout-42.
// Здесь: линейная фильтрация по радиусу видимости (пока карта мала — честно и просто).
export const VIEW_RADIUS = 120; // м — дальность AOI для снапшотов

export class World {
  constructor() {
    this.trees = []; // TODO: загружать из клиентского forest.js (чанки)
  }

  // Игроки в радиусе view от точки (позже заменится на spatial grid)
  playersInRange(players, x, z, radius = VIEW_RADIUS) {
    const r2 = radius * radius;
    const out = [];
    for (const p of players.values()) {
      const dx = p.x - x, dz = p.z - z;
      if (dx * dx + dz * dz <= r2) out.push(p);
    }
    return out;
  }
}
