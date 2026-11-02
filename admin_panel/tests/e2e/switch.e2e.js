const { assert, prisma, ROOT, jwt, run, chromePath, hasChrome } = require('./harness');
const path = require('path');
const bcrypt = require('bcryptjs');
const { io } = require('socket.io-client');

run(async () => {
  const { origin, mk: mkUser, call: callApi, stop, wait: pause, realtime } = await require('./harness').start(5090);
  const base = origin + '/api/v1';
  const OUT = process.env.E2E_OUT;

  const mk = mkUser;
  const call = callApi;

  const admin = await mk('admin');
  const sub = await mk('sub_admin');
  const mentor = await mk('mentor');
  const manager = await mk('channel_manager');
  const a = await prisma.caravan.create({ data: { name: 'کاروان آزمایشی', mentorId: mentor.id } });
  const b = await prisma.caravan.create({ data: { name: 'کاروان دوم', mentorId: mentor.id } });
  const inPilot = await mk('student', { caravanId: a.id });
  const outside = await mk('student', { caravanId: b.id });
  const chatFlag = async u => (await call(u, 'GET', '/users/me')).body.features.chat;
  const set = async body => { const r = await call(admin, 'PUT', '/admin/chat-settings', body); await new Promise(x => setTimeout(x, 3100)); return r; };

  // migration + default state
  const row = await prisma.rolePermission.findUnique({ where: { roleName: 'channel_manager' } });
  assert.equal(row.canLoginPanel, true); console.log('role row seeded OK');
  assert.equal(await chatFlag(inPilot), false);
  assert.equal((await call(inPilot, 'GET', '/chat/status')).body.code, 'CHAT_DISABLED'); console.log('off by default OK');

  // the switch
  assert.equal((await call(admin, 'PUT', '/admin/chat-settings', { mode: 'pilot', pilotCaravanIds: [] })).status, 400);
  assert.equal((await call(admin, 'PUT', '/admin/chat-settings', { mode: 'x' })).status, 400);
  assert.equal((await call(admin, 'PUT', '/admin/chat-settings', { mode: 'pilot', pilotCaravanIds: ['nope'] })).status, 400);
  assert.equal((await set({ mode: 'pilot', pilotCaravanIds: [a.id] })).status, 200);
  assert.equal(await chatFlag(inPilot), true);
  assert.equal(await chatFlag(outside), false);
  assert.equal(await chatFlag(mentor), true);
  assert.equal((await call(inPilot, 'GET', '/chat/status')).status, 200);
  assert.equal((await call(outside, 'GET', '/chat/status')).status, 403); console.log('pilot OK');
  await set({ mode: 'on', pilotCaravanIds: [] });
  assert.equal(await chatFlag(outside), true);
  await set({ mode: 'off', pilotCaravanIds: [] });
  assert.equal((await call(mentor, 'GET', '/chat/status')).status, 403); console.log('on and off apply within seconds OK');

  for (const who of [sub, mentor, manager, inPilot]) {
    assert.equal((await call(who, 'PUT', '/admin/chat-settings', { mode: 'on' })).status, 403);
  }
  console.log('switch is super-admin only OK');

  // channel manager is confined at the API
  for (const [m, p] of [['GET', '/challenges'], ['GET', '/economy'], ['GET', '/leagues/wealthiest'], ['GET', '/support/tickets'], ['GET', '/admin/users'], ['GET', '/admin/economy'], ['GET', '/admin/rewards/ledger'], ['PUT', '/admin/chat-settings'], ['POST', '/mentor/messages']]) {
    assert.equal((await call(manager, m, p, m === 'GET' ? undefined : {})).status, 403, m + ' ' + p);
  }
  assert.equal((await call(manager, 'GET', '/users/me')).status, 200);
  assert.equal((await call(manager, 'GET', '/notifications')).status, 200);
  const me = await call(manager, 'GET', '/admin/panel/me');
  assert.deepEqual(me.body.sections, { chat: 'edit' });
  assert.equal(me.body.chatPermissions.privateChats, false); console.log('channel manager confined OK');

  // role assignment
  const created = await call(admin, 'POST', '/admin/users', { name: 'مسئول', phoneNumber: '09139999999', password: 'Passw0rd!', role: 'channel_manager' });
  console.log('create via panel status', created.status);
  assert.equal((await call(mentor, 'POST', '/admin/users', { name: 'x', phoneNumber: '09139999998', password: 'Passw0rd!', role: 'channel_manager' })).status, 403);

  // browser
  await set({ mode: 'pilot', pilotCaravanIds: [a.id] });
  if (!hasChrome()) { console.log('no Chrome: panel checks skipped'); await stop(); return; }
  const puppeteer = require('puppeteer-core');
  const browser = await puppeteer.launch({ executablePath: chromePath, headless: 'new', args: ['--no-sandbox'] });
  const open = async (user, hash) => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    const problems = [];
    page.on('pageerror', e => problems.push('pageerror: ' + e.message));
    page.on('response', r => { if (r.url().includes('/api/') && r.status() >= 400) problems.push(r.status() + ' ' + r.url().replace(origin, '')); });
    await page.evaluateOnNewDocument((key, value, u) => { localStorage.setItem(key, value); sessionStorage.setItem(key, value); localStorage.setItem('nopa_admin_user', u); },
      'nopa_admin_token', user.token, JSON.stringify({ id: user.id, role: user.role, name: user.name }));
    await page.goto(origin + '/admin/' + hash, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    return { page, problems };
  };

  const s1 = await open(admin, '#chat');
  await s1.page.screenshot({ path: path.join(OUT, 'panel-chat-admin.png') });
  const state = await s1.page.evaluate(() => ({
    mode: document.querySelector('input[name="chat-mode"]:checked')?.value,
    caravans: document.querySelectorAll('.chat-pilot-caravan').length,
    perms: document.querySelectorAll('.chat-manager-permission').length,
    visible: getComputedStyle(document.getElementById('chat-tab')).display,
  }));
  console.log('panel chat tab', JSON.stringify(state), 'problems', JSON.stringify(s1.problems));
  assert.equal(state.mode, 'pilot'); assert.equal(state.caravans, 2); assert.equal(state.perms, 7);

  await s1.page.evaluate(() => { document.querySelector('input[name="chat-mode"][value="on"]').click(); document.querySelector('[data-click="saveChatSettings"]').click(); });
  await new Promise(r => setTimeout(r, 800));
  assert.equal((await prisma.systemSetting.findUnique({ where: { key: 'chat_mode' } })).value, 'on'); console.log('panel save OK');

  const s2 = await open(admin, '#assets');
  await s2.page.screenshot({ path: path.join(OUT, 'panel-assets.png'), fullPage: true });
  const rates = await s2.page.evaluate(() => document.getElementById('economy-nakhPerFarsh')?.value);
  assert.equal(rates, '10');
  await s2.page.evaluate(() => document.querySelector('[data-click="previewEconomy"]').click());
  await new Promise(r => setTimeout(r, 600));
  const preview = await s2.page.evaluate(() => document.getElementById('economy-preview').textContent);
  console.log('panel economy preview:', preview, 'problems', JSON.stringify(s2.problems));
  assert.ok(preview.length > 10);

  const s3 = await open(manager, '');
  await s3.page.screenshot({ path: path.join(OUT, 'panel-chat-manager.png') });
  const nav = await s3.page.evaluate(() => ({
    adminBox: getComputedStyle(document.getElementById('chat-settings-admin')).display,
    managerBox: getComputedStyle(document.getElementById('chat-settings-manager')).display,
    text: document.body.innerText.slice(0, 400),
  }));
  console.log('manager panel', JSON.stringify(nav), 'problems', JSON.stringify(s3.problems));
  await browser.close();
  await stop();
});
