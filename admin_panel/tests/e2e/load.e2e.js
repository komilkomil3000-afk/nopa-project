// Load check for chat: 10 caravans with a mentor and 11 students each (120 users) connected at once.
// Not part of the default run (it takes about a minute): npm run test:e2e -- load
const { assert, prisma, run } = require('./harness');
const { io } = require('socket.io-client');

const CARAVANS = 10, STUDENTS = 11;
const PHASES = [
  { name: 'normal', seconds: 20, everyMs: 10000 },  // each user posts once every 10 s, about 12 messages/s in all
  { name: 'peak', seconds: 15, everyMs: 3000 },     // a class just ended: about 40 messages/s
];

const pct = (list, p) => {
  if (!list.length) return 0;
  const sorted = [...list].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]);
};
const summary = list => `p50 ${pct(list, 0.5)} ms, p95 ${pct(list, 0.95)} ms, p99 ${pct(list, 0.99)} ms, max ${pct(list, 1)} ms`;

run(async () => {
  const { origin, mk, call, stop, wait } = await require('./harness').start(5095);
  const admin = await mk('admin');
  await call(admin, 'PUT', '/admin/chat-settings', { mode: 'on', pilotCaravanIds: [] });
  await wait(3100);

  const users = [];
  for (let c = 0; c < CARAVANS; c++) {
    const mentor = await mk('mentor');
    const caravan = await prisma.caravan.create({ data: { name: `کاروان ${c + 1}`, mentorId: mentor.id } });
    users.push({ ...mentor, caravan: caravan.id });
    for (let s = 0; s < STUDENTS; s++) users.push({ ...(await mk('student', { caravanId: caravan.id })), caravan: caravan.id });
  }
  console.log(`${users.length} users created`);

  // Everyone opens the app at once: the space list, then the socket
  let t0 = Date.now();
  const lists = await Promise.all(users.map(async u => {
    const start = Date.now();
    const res = await call(u, 'GET', '/chat/spaces');
    assert.equal(res.status, 200);
    u.space = res.body.find(s => s.type === 'caravan').id;
    u.announce = res.body.find(s => s.type === 'announcements').id;
    return Date.now() - start;
  }));
  console.log(`space list, ${users.length} at once: ${summary(lists)} (all in ${Date.now() - t0} ms)`);

  const sent = new Map();          // body -> time it was sent
  const delivery = [];             // ms from send to arrival on each other member's socket
  t0 = Date.now();
  const connectTimes = await Promise.all(users.map(u => new Promise((resolve, reject) => {
    const start = Date.now();
    const socket = io(origin, { auth: { token: u.token }, transports: ['websocket'], reconnection: false, forceNew: true });
    socket.on('message:new', m => { const at = sent.get(m.body); if (at !== undefined) delivery.push(Date.now() - at); });
    socket.on('ready', () => { u.socket = socket; resolve(Date.now() - start); });
    socket.on('connect_error', reject);
  })));
  console.log(`socket connect, ${users.length} at once: ${summary(connectTimes)} (all in ${Date.now() - t0} ms)`);

  // One announcement reaches every connected user
  const before = delivery.length;
  const announceBody = `اطلاعیه ${Date.now()}`;
  sent.set(announceBody, Date.now());
  assert.equal((await call(admin, 'POST', `/chat/spaces/${users[0].announce}/messages`, { body: announceBody, clientMessageId: 'announce-load' })).status, 201);
  await wait(2000);
  assert.equal(delivery.length - before, users.length, 'announcement reached everyone');
  console.log(`announcement to ${users.length}: ${summary(delivery.slice(before))}`);

  const memory = [];
  const sample = setInterval(() => memory.push(process.memoryUsage().rss), 1000);
  const cpuStart = process.cpuUsage();
  const wallStart = Date.now();
  const report = [];
  let counter = 0;
  for (const phase of PHASES) {
    const sendTimes = [], errors = [];
    const fromDelivery = delivery.length;
    const end = Date.now() + phase.seconds * 1000;
    await Promise.all(users.map(async u => {
      await wait(Math.random() * phase.everyMs);
      while (Date.now() < end) {
        const body = `پیام ${++counter} از ${u.name}`;
        const start = Date.now();
        sent.set(body, start);
        const res = await call(u, 'POST', `/chat/spaces/${u.space}/messages`, { body, clientMessageId: `load-${counter}` });
        sendTimes.push(Date.now() - start);
        if (res.status !== 201) errors.push(res.status);
        await wait(phase.everyMs);
      }
    }));
    await wait(1500);
    const got = delivery.slice(fromDelivery);
    const expected = sendTimes.length * (STUDENTS + 1); // every caravan member, the sender's own echo included
    const rate = (sendTimes.length / phase.seconds).toFixed(1);
    console.log(`${phase.name}: ${sendTimes.length} messages (${rate}/s), errors ${errors.length}${errors.length ? ' ' + [...new Set(errors)].join(',') : ''}`);
    console.log(`  send: ${summary(sendTimes)}`);
    console.log(`  delivery: ${got.length}/${expected} arrived, ${summary(got)}`);
    report.push({ phase: phase.name, sendTimes, errors, got, expected });
  }
  clearInterval(sample);
  const cpu = process.cpuUsage(cpuStart);
  const busy = ((cpu.user + cpu.system) / 1000 / (Date.now() - wallStart) * 100).toFixed(0);
  console.log(`server and the ${users.length} clients in one process (one core = 100%): CPU ${busy}%, memory max ${Math.round(Math.max(...memory) / 1048576)} MB`);

  // Reading history while the room is busy
  const historyTimes = await Promise.all(users.map(async u => {
    const start = Date.now();
    assert.equal((await call(u, 'GET', `/chat/spaces/${u.space}/messages`)).status, 200);
    return Date.now() - start;
  }));
  console.log(`history, ${users.length} at once: ${summary(historyTimes)}`);

  for (const r of report) {
    assert.equal(r.errors.length, 0, `${r.phase}: no failed sends`);
    assert.ok(r.got.length >= r.expected * 0.999, `${r.phase}: messages arrive`);
    assert.ok(pct(r.sendTimes, 0.95) < 1000, `${r.phase}: 95% of sends under one second`);
  }
  users.forEach(u => u.socket.close());
  await stop();
  console.log('load OK');
});
