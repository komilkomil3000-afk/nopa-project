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
