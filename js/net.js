// net.js — сетевой слой: бинарный протокол mvp-2 поверх ws.
// Входящие:
//   JSON welcome {type,id,tick,hz,protocol}      — свой id
//   binary 0x03 + u16 count + N*20               — снапшот игроков
//   JSON leave {type:'leave',id}                 — игрок вышел
// Исходящие:
//   0x01 + JSON {name, skin?}                      — join (skin 0-15, mayfly: живёт пока жив игрок)
//   0x02 + f32 dx + f32 dz + i16 yaw + u8 flags  — input (dx,dz — МИРОВЫЕ)
//   BIT0 спринт, BIT1 крауч, BIT2 атака, BIT3 сбор, BIT4 use
const SNAP_SIZE = 21;

export function wsUrl() {
  const h = location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') {
    return `ws://${h}:${location.port === '' ? '2568' : location.port === '8091' ? '2568' : location.port}/ws`;
  }
  return `wss://${h}/ws`;
}

export class NetClient {
  constructor({ name, room = null, skin = 0, onPlayers, onLeave, onStatus }) {
    this.name = name;
    this.room = room;
    this.skin = skin;
    this.onPlayers = onPlayers || (() => {});
    this.onLeave = onLeave || (() => {});
    this.onStatus = onStatus || (() => {});
    this.ws = null;
    this.myId = null;
    this.connected = false;
    this.retries = 0;
    this._inputAcc = 0;
    this._pendingInput = null; // {dx,dz,yaw,flags}
  }

  connect() {
    try {
      const url = wsUrl();
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        this.retries = 0;
        const payload = { name: this.name, skin: this.skin };
        if (this.room) payload.room = this.room;
        ws.send(this._join(payload));
      };

      ws.onmessage = (ev) => this._onMessage(ev.data);

      ws.onclose = () => {
        this.connected = false;
        this.myId = null;
        this.onStatus({ online: false, players: 0 });
      };

      ws.onerror = () => { try { ws.close(); } catch {} };
    } catch (e) {
      this.onStatus({ online: false, players: 0, error: String(e && e.message || e) });
    }
  }

  _join(payload) {
    const nameBytes = new TextEncoder().encode(JSON.stringify(payload));
    const buf = new Uint8Array(1 + nameBytes.length);
    buf[0] = 0x01;
    buf.set(nameBytes, 1);
    return buf;
  }

  _onMessage(data) {
    if (typeof data === 'string') {
      const j = JSON.parse(data);
      if (j.type === 'welcome') {
        this.myId = j.id;
        this.connected = true;
        this.onStatus({ online: true, players: 1, protocol: j.protocol });
      } else if (j.type === 'leave') {
        this.onLeave(j.id);
      }
      return;
    }
    // бинарный снапшот: 0x03 + u16 count + N*20
    const u8 = new Uint8Array(data);
    if (u8[0] !== 0x03 || u8.length < 3) return;
    const dv = new DataView(data);
    const count = dv.getUint16(1, true);
    const players = new Map();
    let off = 3;
    for (let i = 0; i < count && off + SNAP_SIZE <= u8.length; i++, off += SNAP_SIZE) {
      const id = dv.getUint32(off, true);
      const x = dv.getFloat32(off + 4, true);
      const y = dv.getFloat32(off + 8, true);
      const z = dv.getFloat32(off + 12, true);
      const yaw = dv.getInt16(off + 16, true) / (32767 / Math.PI);
      const flags = dv.getUint8(off + 18);
      const hp = dv.getUint8(off + 19);
      const skin = dv.getUint8(off + 20);
      players.set(id, { id, x, y, z, yaw, flags, hp, skin });
    }
    this.onPlayers(players);
  }

  // Вызывается из цикла: dt в секундах. Шлёт ввод ~20 раз/с.
  update(dt) {
    if (!this.connected || !this.ws || this.ws.readyState !== 1) return;
    this._inputAcc += dt;
    if (this._inputAcc < 0.05 || !this._pendingInput) return;
    this._inputAcc = 0;
    const { dx, dz, yaw, flags } = this._pendingInput;
    const b = new Uint8Array(12);
    b[0] = 0x02;
    const dv = new DataView(b.buffer);
    dv.setFloat32(1, dx, true);
    dv.setFloat32(5, dz, true);
    dv.setInt16(9, Math.round(yaw * (32767 / Math.PI)), true);
    b[11] = flags;
    this.ws.send(b);
  }

  // Мировое направление движения (нормализовано до 1) + флаги действий
  setInput(dx, dz, yaw, flags) {
    const len = Math.hypot(dx, dz);
    if (len > 1) { dx /= len; dz /= len; }
    this._pendingInput = { dx, dz, yaw, flags };
  }

  disconnect() {
    try { this.ws && this.ws.close(); } catch {}
  }
}
