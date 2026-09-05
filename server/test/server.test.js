// server.test.js — интеграционный тест: поднимает сервер на тестовом порту,
// гоняет ws-ботов по бинарному протоколу. Запуск: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

const PORT = 26000 + Math.floor(Math.random() * 1000);
let child = null;

before(() => {
  child = spawn(process.execPath, ['server.js'], {
    cwd: new URL('..', import.meta.url).pathname,
    env: { ...process.env, GAME_PORT: String(PORT), GAME_HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.once('exit', (code, signal) => {
    if (code !== 0 && signal !== 'SIGKILL') throw new Error(`server exited early: ${code}/${signal}`);
  });
  return new Promise((res, rej) => {
    child.stdout.on('data', (d) => {
      if (d.toString().includes('server on')) res();
    });
    child.stderr.on('data', (d) => process.stderr.write(`[srv] ${d}`));
    setTimeout(() => rej(new Error('server boot timeout')), 5000);
  });
});

after(() => child.kill('SIGKILL'));

// Подключение + ожидание первого сообщения по предикату.
// ВАЖНО: message-слушатель вешается ДО open — welcome приходит в тот же тик,
// что и open, и при поздней подписке сообщение теряется (гонка).
function connectAndWait(pred, timeout = 3000) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
    const t = setTimeout(() => rej(new Error('message timeout')), timeout);
    ws.on('message', function onMsg(data) {
      if (pred(data)) { clearTimeout(t); res([ws, data]); }
    });
    ws.once('error', (e) => { clearTimeout(t); rej(e); });
  });
}

async function connectWelcome() {
  const [ws, msg] = await connectAndWait((d) => d.toString().startsWith('{'));
  assert.equal(JSON.parse(msg.toString()).type, 'welcome');
  return ws;
}

function waitMessage(ws, pred, timeout = 3000) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('message timeout')), timeout);
    ws.on('message', function onMsg(data) {
      if (pred(data)) { clearTimeout(t); res(data); }
    });
  });
}

function join(name) {
  return Buffer.concat([Buffer.from([0x01]), Buffer.from(JSON.stringify({ name }))]);
}

// InputVector: [0x02][dx f32][dz f32][yaw i16][flags u8] = 12 байт
function inputVector(dx, dz, yaw, flags) {
  const b = Buffer.alloc(12);
  b[0] = 0x02;
  b.writeFloatLE(dx, 1);
  b.writeFloatLE(dz, 5);
  b.writeInt16LE(Math.round(yaw * (32767 / Math.PI)), 9);
  b[11] = flags;
  return b;
}

test('health endpoint', async () => {
  const r = await fetch(`http://127.0.0.1:${PORT}/health`);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.ok, true);
  assert.equal(j.hz, 20);
});

test('join + welcome', async () => {
  const ws = await connectWelcome();
  ws.close();
});

test('snapshot frame: 3 + N*19 bytes, позиция меняется', async () => {
  const a = await connectWelcome();
  a.send(join('BOT-A'));

  const b = await connectWelcome();
  b.send(join('BOT-B'));

  // оба шлют «бег вперёд со спринтом» каждые 50 мс (как настоящие клиенты)
  const iv = inputVector(0, -1, 0, 1 << 0);
  const ivA = setInterval(() => a.send(iv), 50);
  const ivB = setInterval(() => b.send(iv), 50);
  try {
    const frameA = await waitMessage(a, (d) => d[0] === 0x03);
    // формат: 1 (тип) + 2 (count uint16) + N*19
    assert.ok(frameA.length >= 3 + 19, `frameA len ${frameA.length}`);
    assert.equal((frameA.length - 3) % 19, 0, 'кратно 19');
    const frameB = await waitMessage(b, (d) => d[0] === 0x03);
    assert.equal(frameB.length % 19, 3 % 19, 'кратно 19');

    const count = frameA.readUInt16LE(1);
    assert.ok(count >= 2, `в снапшоте оба бота (count=${count})`);

    // раскладка снапшота от offset 3: [tick u32][x f32][y f32][z f32][yaw i16][flags u8]
    await new Promise((r) => setTimeout(r, 600));
    const frameA2 = await waitMessage(a, (d) => d[0] === 0x03 && d.readUInt32LE(3) > 10);
    const x = frameA2.readFloatLE(3 + 4);
    const z = frameA2.readFloatLE(3 + 4 + 8);
    assert.ok(Math.abs(x) > 0.001 || Math.abs(z) > 0.001, `бот движется (${x.toFixed(2)}, ${z.toFixed(2)})`);
  } finally {
    clearInterval(ivA); clearInterval(ivB);
    a.close(); b.close();
  }
});

test('leave-событие приходит другим игрокам', async () => {
  const a = await connectWelcome();
  const b = await connectWelcome();

  const leaveWaiter = waitMessage(b, (d) => d.toString().includes('"type":"leave"'));
  a.close();
  const msg = await leaveWaiter;
  const j = JSON.parse(msg.toString());
  assert.equal(j.type, 'leave');
  b.close();
});
