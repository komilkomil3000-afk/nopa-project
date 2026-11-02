// Run after `npm run build`:  npm test   (uses Node's built-in test runner, no extra dependencies)
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const D = path.resolve(__dirname, '..', process.env.TEST_DIST || 'dist');
const load = (p) => require(path.join(D, p));

function runMiddleware(mw, role, method, p) {
  let status = 200, passed = false;
  const req = { user: role ? { role } : undefined, method, path: p };
  const res = { status(c) { status = c; return this; }, json() { return this; } };
  mw(req, res, () => { passed = true; });
  return { passed, status };
}

test('mentor allowlist: default deny', () => {
  const { restrictNonAdmins } = load('middleware/adminAccess.js');
  // allowed for mentors
  assert.ok(runMiddleware(restrictNonAdmins, 'mentor', 'GET', '/users').passed);
  assert.ok(runMiddleware(restrictNonAdmins, 'SUPER_MENTOR', 'POST', '/tickets/abc/reply').passed);
  assert.ok(runMiddleware(restrictNonAdmins, 'mentor', 'PATCH', '/submissions/s1/review').passed);
  // forbidden for mentors
  for (const [m, p] of [
    ['POST', '/users/u1/zarik'], ['DELETE', '/users/u1'], ['GET', '/users/export'],
    ['PUT', '/rbac/permissions'], ['POST', '/asset-conversions/x/cancel'],
    ['DELETE', '/challenges/c1'], ['POST', '/settings'], ['GET', '/unknown-new-route'],
  ]) {
    const r = runMiddleware(restrictNonAdmins, 'mentor', m, p);
    assert.equal(r.passed, false, `${m} ${p} must be blocked`);
    assert.equal(r.status, 403);
  }
  // admin unrestricted, students/others rejected
  assert.ok(runMiddleware(restrictNonAdmins, 'admin', 'DELETE', '/users/u1').passed);
  assert.equal(runMiddleware(restrictNonAdmins, 'student', 'GET', '/users').passed, false);
  assert.equal(runMiddleware(restrictNonAdmins, undefined, 'GET', '/users').passed, false);
});

test('response scrubber removes credentials', () => {
  const { __scrubForTests: scrub } = load('middleware/responseScrubber.js');
  const out = scrub({ id: 1, passwordHash: 'x', tokenVersion: 3, nested: [{ passwordHash: 'y', name: 'a' }], d: new Date(0) });
  assert.deepEqual(Object.keys(out).sort(), ['d', 'id', 'nested']);
  assert.deepEqual(out.nested, [{ name: 'a' }]);
});

test('5xx internal error text is hidden, Persian messages kept, 4xx untouched', () => {
  const { __hideInternalErrorForTests: hide } = load('middleware/responseScrubber.js');
  const quiet = console.error; console.error = () => {};
  try {
    const req = { method: 'GET', originalUrl: '/x' };
    delete process.env.EXPOSE_ERRORS;
    assert.ok(!/prisma/i.test(hide(req, { statusCode: 500 }, { error: 'Invalid `prisma.user.findMany()` invocation' }).error));
    assert.equal(hide(req, { statusCode: 500 }, { error: 'خطا در حذف استاد' }).error, 'خطا در حذف استاد');
    assert.equal(hide(req, { statusCode: 400 }, { error: 'Bad input' }).error, 'Bad input');
    process.env.EXPOSE_ERRORS = '1';
    assert.match(hide(req, { statusCode: 500 }, { error: 'raw detail' }).error, /raw detail/);
  } finally { console.error = quiet; delete process.env.EXPOSE_ERRORS; }
});

test('answer keys are stripped from quiz payloads', () => {
  const { stripAnswerKeys } = load('utils/answerKeys.js');
  const raw = JSON.stringify([{ q: 'x', options: ['a', 'b'], correct: 1, correctIndex: 1, answer: 'b' }]);
  const out = JSON.parse(stripAnswerKeys(raw));
  assert.deepEqual(out, [{ q: 'x', options: ['a', 'b'] }]);
  assert.equal(stripAnswerKeys('not json {'), null);
});

test('csv writer neutralises formulas and quotes everything', () => {
  const { csvCell, csvRow, escapeHtml } = load('utils/csv.js');
  assert.equal(csvCell('=HYPERLINK("http://evil")'), '"\'=HYPERLINK(""http://evil"")"');
  assert.equal(csvCell('+1+1'), '"\'+1+1"');
  assert.equal(csvCell('-5'), '"-5"');
  assert.equal(csvCell('a,b\nc'), '"a,b\nc"');
  assert.equal(csvRow(['x', null, 3]), '"x","","3"');
  assert.equal(escapeHtml('<img src=x onerror="a">'), '&lt;img src=x onerror=&quot;a&quot;&gt;');
});

test('jwt secrets: no fallbacks, weak or leaked values rejected', () => {
  const { getJwtSecret, getJwtRefreshSecret } = load('config/secrets.js');
  const save = { a: process.env.JWT_SECRET, b: process.env.JWT_REFRESH_SECRET };
  try {
    delete process.env.JWT_SECRET; delete process.env.JWT_REFRESH_SECRET;
    assert.throws(() => getJwtSecret(), /required/);
    process.env.JWT_SECRET = 'short';
    assert.throws(() => getJwtSecret(), /at least 32/);
    process.env.JWT_SECRET = 'nopa_super_secret_jwt_key_2026'; // old fallback (too short as well)
    assert.throws(() => getJwtSecret());
    process.env.JWT_SECRET = 'a'.repeat(40);
    process.env.JWT_REFRESH_SECRET = 'nopa_super_secret_refresh_jwt_key_2026';
    assert.throws(() => getJwtRefreshSecret(), /publicly known/);
    process.env.JWT_SECRET = 'a'.repeat(40);
    process.env.JWT_REFRESH_SECRET = 'a'.repeat(40);
    assert.throws(() => getJwtRefreshSecret(), /differ/);
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(40);
    assert.equal(getJwtRefreshSecret(), 'b'.repeat(40));
  } finally {
    for (const [k, v] of [['JWT_SECRET', save.a], ['JWT_REFRESH_SECRET', save.b]]) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
});

test('admin SPA escaping helpers (safe.js)', () => {
  const vm = require('node:vm'), fs = require('node:fs');
  const ctx = { window: {} }; ctx.window = ctx;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'safe.js'), 'utf8'), ctx);
  assert.equal(ctx.esc('<script>"\'&`'), '&lt;script&gt;&quot;&#39;&amp;&#96;'.replace('&#96;', ctx.esc('`')));
  assert.ok(!/[<>"']/.test(ctx.esc('<b onclick="x">')));
  const js = ctx.escJs("');alert(1);//");
  assert.ok(!js.includes("'") && !js.includes('"'));
});

test('four-level roles: super admin always passes, sub admin routes map to sections', () => {
  const { restrictNonAdmins, sectionForPath } = load('middleware/adminAccess.js');
  // Super admin never depends on any DB lookup
  assert.ok(runMiddleware(restrictNonAdmins, 'admin', 'PUT', '/users/u1/role').passed);
  assert.ok(runMiddleware(restrictNonAdmins, 'admin', 'PUT', '/roles').passed);
  // students never reach the panel
  assert.equal(runMiddleware(restrictNonAdmins, 'student', 'GET', '/panel/me').passed, false);
  // a mentor switched off by the super admin is rejected
  const off = { user: { role: 'mentor', panelAccess: false }, method: 'GET', path: '/users' };
  let st = 200; restrictNonAdmins(off, { status(c) { st = c; return this; }, json() { return this; } }, () => { st = 'passed'; });
  assert.equal(st, 403);
  // section mapping: sensitive routes are never mapped (super admin only)
  assert.equal(sectionForPath('/lms/stations'), 'lms');
  assert.equal(sectionForPath('/news/1'), 'content');
  assert.equal(sectionForPath('/levels-and-certificates'), 'users');
  for (const p of ['/roles', '/security/revoke', '/settings/x', '/audit/logs', '/export', '/users/export',
                   '/users/u1/role', '/users/u1/panel-access', '/users/u1/override-password', '/unknown-new-route']) {
    assert.equal(sectionForPath(p), undefined, `${p} must be super-admin only`);
  }
});

test('section grants parser drops unknown sections and levels', () => {
  const { parseSectionGrants } = load('utils/roles.js');
  assert.deepEqual(parseSectionGrants('{"lms":"edit","users":"view","roles":"edit","news":"root"}'), { lms: 'edit', users: 'view' });
  assert.deepEqual(parseSectionGrants('not json'), {});
  assert.deepEqual(parseSectionGrants(null), {});
});

test('admin panel CSP: no inline scripts or handlers, stylesheets same-origin only', () => {
  const { cspDirectives, cspHeader } = load('config/csp.js');
  assert.deepEqual(cspDirectives.scriptSrc, ["'self'"]);
  assert.deepEqual(cspDirectives.scriptSrcAttr, ["'none'"]);
  assert.deepEqual(cspDirectives.styleSrc, ["'self'"]);
  assert.deepEqual(cspDirectives.connectSrc, ["'self'"]);
  assert.deepEqual(cspDirectives.objectSrc, ["'none'"]);
  const header = cspHeader();
  assert.match(header, /(^|;)script-src 'self'(;|$)/);
  assert.match(header, /(^|;)script-src-attr 'none'(;|$)/);
  // 'unsafe-inline' only for style attributes, nowhere else
  assert.deepEqual(header.split(';').filter(d => d.includes('unsafe-inline')), ["style-src-attr 'unsafe-inline'"]);
  assert.ok(!header.includes('unsafe-eval'));
});

test('access tokens: expired and forged tokens are a 401, so clients refresh them', async () => {
  const jwt = require('jsonwebtoken');
  const save = process.env.JWT_SECRET;
  const secret = 'k3Y'.repeat(14);
  process.env.JWT_SECRET = secret;
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
  try {
    const { verifyAccessToken } = load('middleware/auth.js');
    const expired = jwt.sign({ id: 'u1', role: 'student' }, secret, { expiresIn: -10 });
    const forged = jwt.sign({ id: 'u1', role: 'admin' }, 'x'.repeat(40));
    for (const token of [expired, forged, 'not-a-token']) {
      const result = await verifyAccessToken(token, '127.0.0.1');
      assert.equal(result.ok, false);
      assert.equal(result.status, 401);
    }
  } finally {
    if (save === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = save;
  }
});

test('economy: ranking capital, exchanges and policy validation', () => {
  const { DEFAULT_ECONOMY: c, capitalValue, conversionRule, nakhValue, parseEconomyConfig } = load('services/economy.js');
  assert.equal(nakhValue(c), 5000);
  assert.equal(capitalValue({ zarikBalance: 100, nakh: 3, farsh: 2 }, c), 100 + 15000 + 100000);

  // converting or selling must not move anyone in the ranking
  assert.equal(capitalValue({ nakh: 10 }, c), capitalValue({ farsh: 1 }, c));
  assert.equal(capitalValue({ farsh: 1 }, c), capitalValue({ zarikBalance: 50000 }, c));

  assert.deepEqual(conversionRule('nakh', 'farsh', c), { step: 10, pays: 1 });
  assert.deepEqual(conversionRule('farsh', 'zarik', c), { step: 1, pays: 50000 });
  assert.equal(conversionRule('zarik', 'nakh', c), null, 'nakh cannot be bought');
  assert.deepEqual(conversionRule('zarik', 'nakh', { ...c, allowBuyNakh: true }), { step: 500, pays: 1 });
  assert.equal(conversionRule('zarik', 'farsh', c), null);

  assert.ok('config' in parseEconomyConfig(c));
  assert.ok('error' in parseEconomyConfig({ ...c, nakhPerFarsh: 0 }));
  assert.ok('error' in parseEconomyConfig({ ...c, farshSalePrice: 1.5 }));
  assert.ok('error' in parseEconomyConfig({ ...c, interGroup: { ...c.interGroup, rankWeights: { judges: 50, coverage: 25, delivery: 15 } } }));
  assert.ok('error' in parseEconomyConfig({ ...c, interGroup: { ...c.interGroup, prizes: { gold: 1, silver: 2, bronze: 1, cloth: 1 } } }));
  assert.ok('error' in parseEconomyConfig(null));
});

test('economy: changing the money rules is super-admin only', () => {
  const { sectionForPath } = load('middleware/adminAccess.js');
  assert.equal(sectionForPath('/economy'), undefined);
});

test('channel manager: only chat areas of the API, private chats off by default', () => {
  const { channelManagerMayCall, parseChatPermissions, DEFAULT_CHAT_PERMISSIONS } = load('utils/roles.js');
  for (const ok of ['/users/me', '/auth/logout', '/notifications', '/assets', '/chat/status', '/admin/panel/me']) {
    assert.equal(channelManagerMayCall(ok), true, ok);
  }
  for (const no of ['/challenges', '/economy', '/users/mentor/1', '/leagues/wealthiest', '/caravans/submit-exchange', '/support/tickets', '/assets/x']) {
    assert.equal(channelManagerMayCall(no), false, no);
  }
  assert.equal(DEFAULT_CHAT_PERMISSIONS.privateChats, false);
  assert.equal(parseChatPermissions('{"chat":{"export":true,"unknown":true}}').export, true);
  assert.equal(parseChatPermissions('{"chat":{"export":true,"unknown":true}}').unknown, undefined);
  assert.deepEqual(parseChatPermissions('not json'), DEFAULT_CHAT_PERMISSIONS);
});

test('chat switch: off for all, pilot for staff and chosen caravans, on for all', () => {
  const { canUseChat } = load('services/chatSettings.js');
  const student = c => ({ role: 'student', caravanId: c });
  const off = { mode: 'off', pilotCaravanIds: ['a'] };
  const pilot = { mode: 'pilot', pilotCaravanIds: ['a'] };
  const on = { mode: 'on', pilotCaravanIds: [] };
  assert.equal(canUseChat({ role: 'admin' }, off), false);
  assert.equal(canUseChat(student('a'), off), false);
  assert.equal(canUseChat(student('a'), pilot), true);
  assert.equal(canUseChat(student('b'), pilot), false);
  assert.equal(canUseChat(student(null), pilot), false);
  for (const role of ['admin', 'sub_admin', 'mentor', 'SUPER_MENTOR', 'channel_manager']) {
    assert.equal(canUseChat({ role }, pilot), true, role);
  }
  assert.equal(canUseChat(student(null), on), true);
});
