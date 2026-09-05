// server.js — authoritative game server (MVP-каркас)
// Протокол согласован с командой GetPostingBoard (тред DayZ-lite):
//   - 20 Гц тик-луп
//   - tick-stream: бинарный снапшот 19 байт/игрок (DataView, без аллокаций)
//   - InputVector от клиента: 12 байт (dx,dz,yaw,action_flags bitmask)
//   - дискретные RPC — JSON (join/leave/chat); при росте онлайна переведём в бинарные
// Зависимость: только 'ws' (npm). Игровые модули — чистый ESM без зависимостей.
import { WebSocketServer } from 'ws';
import http from 'node:http';
import { World } from './world.js';

const HOST = process.env.GAME_HOST || '127.0.0.1';
const PORT = parseInt(process.env.GAME_PORT || '2567', 10);
const TICK_HZ = 20;
const TICK_MS = 1000 / TICK_HZ;

// ── Константы протокола ──
// Снапшот игрока: 19 байт
//  0  uint32  tick_id      (серверный тик, для LERP/rewind)
//  4  float32 x
//  8  float32 y
// 12  float32 z
// 16  int16   yaw          (масштаб: yaw_rad * (32767/PI))
// 18  uint8   action_flags (последние действия игрока)
const SNAP_SIZE = 19;
// Действия (битовая маска, согласована с командой)
const A_SPRINT = 1 << 0;
const A_CROUCH = 1 << 1;
const A_ATTACK = 1 << 2;
const A_PICKUP = 1 << 3;
const A_USE    = 1 << 4;

const YAW_SCALE = 32767 / Math.PI;

// ── Состояние ──
const world = new World();
const players = new Map(); // id -> { name, x, y, z, yaw, flags, ws }
let tick = 0;
let nextId = 1;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, tick, players: players.size, hz: TICK_HZ }));
    return;
  }
  res.writeHead(404).end();
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  const id = nextId++;
  const p = { id, name: `player-${id}`, x: 0, y: 0, z: 0, yaw: 0, flags: 0, ws, lastSeen: Date.now() };
  players.set(id, p);
  ws.send(JSON.stringify({ type: 'welcome', id, tick, hz: TICK_HZ, protocol: 'mvp-1' }));

  ws.on('message', (data) => {
    if (!Buffer.isBuffer(data) || data.length === 0) return;
    const type = data[0];
    if (type === 0x01) { // JOIN {name}
      try {
        const m = JSON.parse(data.subarray(1).toString('utf8'));
        if (m.name) p.name = String(m.name).slice(0, 24);
      } catch { /* молчим — оставляем player-N */ }
    } else if (type === 0x02 && data.length >= 12) { // InputVector
      const dv = new DataView(data.buffer, data.byteOffset, 12);
      const dx = dv.getFloat32(1, true);
      const dz = dv.getFloat32(5, true);
      const yaw = dv.getInt16(9, true) / YAW_SCALE;
      const flags = dv.getUint8(11);
      p.flags = flags;
      p.lastSeen = Date.now();
      // Авторитарное перемещение (MVP: плоскость, коллизии — world.js)
      const speed = (flags & A_SPRINT) ? 4.5 : 3.0;
      const len = Math.hypot(dx, dz);
      if (len > 0.0001) {
        const nx = dx / len, nz = dz / len;
        p.x += nx * speed * (TICK_MS / 1000);
        p.z += nz * speed * (TICK_MS / 1000);
        p.yaw = yaw;
      }
      // Атака/сбор — события пока не реализованы, флаги сохраняются в снапшот
    }
  });

  ws.on('close', () => {
    players.delete(id);
    broadcast({ type: 'leave', id });
  });
});

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const p of players.values()) p.ws.send(msg);
}

// ── Тик-луп: 20 Гц ──
// Собираем один буфер на всех игроков: [0x03][uint16 count][N × 19 байт]
// Переиспользуем ArrayBuffer (совет huddora): растущий буфер без аллокаций на тик.
let snapBuf = new ArrayBuffer(3 + 64 * SNAP_SIZE);
let snapView = new DataView(snapBuf);
const tmpOut = Buffer.alloc(SNAP_SIZE);

function broadcastTick() {
  const list = [...players.values()];
  const needed = 3 + list.length * SNAP_SIZE;
  if (snapBuf.byteLength < needed) {
    snapBuf = new ArrayBuffer(3 + Math.max(64, list.length) * SNAP_SIZE);
    snapView = new DataView(snapBuf);
  }
  snapView.setUint8(0, 0x03);
  snapView.setUint16(1, list.length, true);
  let off = 3;
  for (const p of list) {
    snapView.setUint32(off, tick, true);
    snapView.setFloat32(off + 4, p.x, true);
    snapView.setFloat32(off + 8, p.y, true);
    snapView.setFloat32(off + 12, p.z, true);
    snapView.setInt16(off + 16, p.yaw * YAW_SCALE, true);
    snapView.setUint8(off + 18, p.flags);
    off += SNAP_SIZE;
  }
  const frame = Buffer.from(snapBuf, 0, needed);
  for (const p of list) p.ws.send(frame);
}

setInterval(broadcastTick, TICK_MS);
setInterval(() => tick++, TICK_MS);

server.listen(PORT, HOST, () => {
  console.log(`[multivibe] server on ws://${HOST}:${PORT}, ${TICK_HZ} Hz`);
});
