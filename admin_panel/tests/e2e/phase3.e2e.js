// Phase 3 of docs/specs/chat-access-matrix.md: the challenge taxonomy («فرهنگ اصطلاحات») and the admin creating
// «چالش فراگروهی» only. With Chrome present, also opens the panel's challenges tab (SHOT_DIR keeps screenshots).
const path = require('path');
const { assert, prisma, start, run, chromePath, hasChrome } = require('./harness');

run(async () => {
  const { origin, mk, call, stop, wait } = await start(5099);
  const admin = await mk('admin');
  const mA = await mk('mentor');
  const cA = await prisma.caravan.create({ data: { name: 'الف', mentorId: mA.id } });
  const a1 = await mk('student', { caravanId: cA.id });
  await call(admin, 'PUT', '/admin/chat-settings', { mode: 'on', pilotCaravanIds: [] });
  await wait(3100);

  // ---- The taxonomy: defaults, read by the app, edited by the admin only ----
  const first = await call(a1, 'GET', '/challenge-taxonomy');
  assert.equal(first.status, 200);
  assert.deepEqual(first.body.map(t => t.key), ['individual', 'intra_group', 'inter_group']);
  assert.deepEqual(first.body.map(t => t.label), ['چالش شخصی', 'چالش گروهی', 'چالش فراگروهی']);
  assert.ok(first.body[2].replaces.includes('چالش میان‌گروهی'));
  assert.equal((await call(mA, 'PUT', '/admin/challenge-taxonomy', {})).status, 403, 'mentors do not edit it');
  const edited = Object.fromEntries(first.body.map(t => [t.key, { label: t.label, shortLabel: t.shortLabel, definition: t.definition, target: t.target, icon: t.icon, color: t.color }]));
  assert.equal((await call(admin, 'PUT', '/admin/challenge-taxonomy', { ...edited, intra_group: { ...edited.intra_group, color: 'red' } })).status, 400, 'colour format');
  assert.equal((await call(admin, 'PUT', '/admin/challenge-taxonomy', { ...edited, intra_group: { ...edited.intra_group, shortLabel: 'شخصی' } })).status, 400, 'two categories, one name');
  const saved = await call(admin, 'PUT', '/admin/challenge-taxonomy', { ...edited, intra_group: { ...edited.intra_group, shortLabel: 'کاروانی', creator: 'مدیر' } });
  assert.equal(saved.status, 200);
  assert.equal(saved.body[1].shortLabel, 'کاروانی');
  assert.equal(saved.body[1].creator, 'راهبر', 'who creates a category cannot be edited');
  assert.equal((await call(a1, 'GET', '/challenge-taxonomy')).body[1].shortLabel, 'کاروانی', 'the app reads the edit');
  console.log('taxonomy OK');

  // ---- Chat cards carry the configured name ----
  const made = await call(mA, 'POST', '/challenges', { title: 'گروهی', description: 'd', type: 'skill', allMembers: true });
  await wait(500);
  const topic = await prisma.chatTopic.findFirst({ where: { challengeId: made.body.id }, include: { message: true } });
  assert.equal(topic.message.meta.tag, 'کاروانی');
  console.log('card tag OK');

  // ---- The admin creates «چالش فراگروهی» only; older caravan challenges stay editable ----
  assert.equal((await call(admin, 'POST', '/challenges', { title: 'x', description: 'd', type: 'skill', caravanId: cA.id })).status, 400);
  const inter = await call(admin, 'POST', '/challenges', { title: 'همه', description: 'd', type: 'skill' });
  assert.equal(inter.status, 201);
  assert.equal(inter.body.category, 'inter_group', 'no caravan = cross-caravan');
  assert.equal((await call(admin, 'PATCH', `/challenges/${inter.body.id}`, { caravanId: cA.id })).status, 400, 'never moved onto one caravan');
  const old = await prisma.challenge.create({ data: { id: 'OLDADMIN', title: 'قدیمی', description: 'd', type: 'skill', category: 'intra_group', createdByMentorId: admin.id, caravanId: cA.id } });
  assert.equal((await call(admin, 'PATCH', `/challenges/${old.id}`, { title: 'قدیمی ۲', caravanId: cA.id })).status, 200, 'keeps its own caravan');
  assert.equal((await call(admin, 'PATCH', `/challenges/${old.id}`, { caravanId: 'inter_group' })).status, 200, 'may become cross-caravan');
  console.log('admin creates cross-caravan only OK');

  // ---- Panel: the glossary tile and its editor ----
  if (!hasChrome()) { console.log('no Chrome: panel checks skipped'); await stop(); return; }
  const shots = process.env.SHOT_DIR || null;
  const puppeteer = require('puppeteer-core');
  const browser = await puppeteer.launch({ executablePath: chromePath, headless: 'new', args: ['--no-sandbox'] });
  const open = async (width, scheme) => {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900 });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
    const problems = [];
    page.on('pageerror', e => problems.push('pageerror: ' + e.message));
    page.on('response', r => { if (r.url().includes('/api/') && r.status() >= 400) problems.push(r.status() + ' ' + r.url().replace(origin, '')); });
    await page.evaluateOnNewDocument((value, u) => { localStorage.setItem('nopa_admin_token', value); sessionStorage.setItem('nopa_admin_token', value); localStorage.setItem('nopa_admin_user', u); },
      admin.token, JSON.stringify({ id: admin.id, role: admin.role, name: admin.name }));
    await page.goto(origin + '/admin/#submissions', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));
    return { page, problems };
  };
  const wide = await open(1280, 'dark');
  const tile = await wide.page.evaluate(() => ({
    cards: document.querySelectorAll('#chl-gls-grid .chl-gls-card').length,
    names: Array.from(document.querySelectorAll('#chl-gls-grid .chl-gls-name strong')).map(e => e.textContent),
    editVisible: !document.getElementById('chl-gls-edit')?.hidden,
    chips: Array.from(document.querySelectorAll('#admin-challenges-grid .chl-chip')).map(e => e.textContent.trim()),
    newOptions: Array.from(document.querySelectorAll('#new-chal-caravan-id option')).map(o => o.value),
  }));
  console.log('panel glossary', JSON.stringify(tile), 'problems', JSON.stringify(wide.problems));
  assert.equal(tile.cards, 3);
  assert.deepEqual(tile.names, ['چالش شخصی', 'چالش گروهی', 'چالش فراگروهی']);
  assert.ok(tile.editVisible);
  assert.ok(tile.chips.some(c => c.includes('کاروانی')), 'card chips use the configured short name');
  assert.deepEqual(tile.newOptions, ['inter_group'], 'the admin creates cross-caravan only');
  const glsShot = async (page, file) => {
    if (!shots) return;
    const el = await page.$('.chl-gls');
    if (el) await el.screenshot({ path: path.join(shots, file) });
  };
  await glsShot(wide.page, 'gls-dark-1280.png');
  // the editor opens, saves and closes
  await wide.page.evaluate(() => document.getElementById('chl-gls-edit').click());
  await new Promise(r => setTimeout(r, 400));
  if (shots) await wide.page.screenshot({ path: path.join(shots, 'gls-editor.png') });
  await wide.page.evaluate(() => {
    const input = document.querySelector('[data-gls="inter_group.shortLabel"]');
    input.value = 'همه‌ی کاروان‌ها';
    document.querySelector('#chl-gls-modal button[type="submit"]').click();
  });
  await new Promise(r => setTimeout(r, 1200));
  const after = await wide.page.evaluate(() => ({
    modal: getComputedStyle(document.getElementById('chl-gls-modal')).display,
    small: document.querySelectorAll('#chl-gls-grid .chl-gls-name small')[2]?.textContent || '',
  }));
  assert.equal(after.modal, 'none');
  assert.ok(after.small.includes('همه‌ی کاروان‌ها'));
  assert.equal((await call(a1, 'GET', '/challenge-taxonomy')).body[2].shortLabel, 'همه‌ی کاروان‌ها');
  assert.deepEqual(wide.problems.filter(p => !p.includes('/chat/')), []);

  const phone = await open(375, 'light');
  const fit = await phone.page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  await glsShot(phone.page, 'gls-light-375.png');
  assert.ok(fit.scroll <= fit.inner, `no horizontal scroll at 375px (${fit.scroll} > ${fit.inner})`);
  console.log('panel glossary OK');

  await browser.close();
  await stop();
});
