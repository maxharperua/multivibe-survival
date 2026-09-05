// server.test.js — интеграционный тест: поднимает сервер на случайном порту,
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
    stdio: 'pipe',
  });
  child.once('exit', (code, signal) => {
    if (code !== 0 && signal !== 'SIGKILL') throw new Error(`server exited early: ${code}/${signal}`);
  });
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('server did not start')), 5000);
    child.stdout.on('data', (d) => {
      if (d.toString().includes('server on')) { clearTimeout(t); res(); }
    });
    child.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));
  });
});

after(() => { if (child) child.kill('SIGKILL'); });

// Подключение + ожидание первого сообщения по предикату.
// ВАЖНО: message-слушатель вешается ДО open — welcome приходит в тот же тик,
// что и open, и при поздней подписке сообщение теряется (гонка).
function connectWelcome(timeout = 3000) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
    const t = setTimeout(() => { ws.close(); rej(new Error('connect timeout')); }, timeout);
    ws.on('message', function onMsg(d) {
      if (d.toString().startsWith('{')) {
        clearTimeout(t);
        ws.removeListener('message', onMsg);
        res(ws);
      }
    });
    ws.once('error', rej);
  });
}

function waitMessage(ws, pred, timeout = 3000) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => { ws.removeListener('message', onMsg); rej(new Error('message timeout')); }, timeout);
    function onMsg(d) {
      if (pred(d)) { clearTimeout(t); res(d); }
    }
    ws.on('message', onMsg);
  });
}

function join(name) {
  return Buffer.concat([Buffer.from([0x01]), Buffer.from(JSON.stringify({ name }))]);
}

function inputVector(dx, dz, yawRad, flags) {
  const b = Buffer.alloc(12);
  b[0] = 0x02;
  b.writeFloatLE(dx, 1);
  b.writeFloatLE(dz, 5);
  b.writeInt16LE(Math.round(yawRad * (32767 / Math.PI)), 9);
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

test('snapshot frame: 3 + N*20 bytes, позиция меняется, hp в кадре', async () => {
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
    // формат: 1 (тип) + 2 (count uint16) + N*20
    assert.ok(frameA.length >= 3 + 20, `frameA len ${frameA.length}`);
    assert.equal((frameA.length - 3) % 20, 0, 'кратно 20');
    assert.ok(frameA.readUInt32LE(3) > 0, 'tick ненулевой');

    const frameB = await waitMessage(b, (d) => d[0] === 0x03);
    assert.equal(frameB.length % 20, 3 % 20, 'кратно 20');

    // hp в кадре (байт 19 первого игрока) — должен быть 100 и не undefined
    const hp = frameA.readUInt8(3 + 19);
    assert.equal(hp, 100, 'hp=100 на старте');

    await new Promise((r) => setTimeout(r, 400));
    const frameA2 = await waitMessage(a, (d) => d[0] === 0x03 && d.readUInt32LE(3) > 10);
    const x = frameA2.readFloatLE(3 + 4);
    const z = frameA2.readFloatLE(3 + 12);
    // за 400 мс бега со спринтом бот должен сместиться заметно (>1 м)
    assert.ok(Math.abs(x) > 0.5 || Math.abs(z) > 0.5,
      `позиция изменилась (x=${x.toFixed(2)}, z=${z.toFixed(2)})`);
  } finally {
    clearInterval(ivA);
    clearInterval(ivB);
    a.close();
    b.close();
  }
});

test('анти-спидхак: dx=1000 не телепортирует, NaN не отравляет координаты', async () => {
  const a = await connectWelcome();
  a.send(join('CHEATER'));
  const ivHack = inputVector(1000, 0, 0, 1 << 0); // спидхак-вектор
  const ivNaN = Buffer.alloc(12);
  ivNaN[0] = 0x02;
  ivNaN.writeFloatLE(NaN, 1);
  ivNaN.writeFloatLE(0, 5);
  ivNaN.writeInt16LE(0, 9);
  ivNaN[11] = 0;

  const ticker = setInterval(() => a.send(ivHack), 50);
  try {
    await new Promise((r) => setTimeout(r, 300));
    clearInterval(ticker);
    // NaN-пакет
    a.send(ivNaN);
    await new Promise((r) => setTimeout(r, 150));

    const frame = await waitMessage(a, (d) => d[0] === 0x03 && d.readUInt32LE(3) > 10);
    const x = frame.readFloatLE(3 + 4);
    const z = frame.readFloatLE(3 + 12);
    // скорость спринта 4.5 м/с: за ~450 мс с клиппингом |v|<=1 уедет < 3 м,
    // без клиппинга dx=1000 дал бы ~225 м
    assert.ok(Number.isFinite(x) && Number.isFinite(z), `координаты конечны (x=${x}, z=${z})`);
    assert.ok(Math.abs(x) < 10 && Math.abs(z) < 10,
      `спидхак ограничен: x=${x.toFixed(2)} z=${z.toFixed(2)}`);
  } finally {
    clearInterval(ticker);
    a.close();
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
  assert.equal(typeof j.id, 'number');
  b.close();
});
