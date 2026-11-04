// Shared safety checks for seed.js and cleanup.js. Every test row is tagged so it can be found and
// removed, and both scripts refuse to run anywhere that is not a disposable load-test database.

const LT = {
  PHONE_PREFIX: '0900',          // 0900 is not an allocated Iranian mobile prefix
  NAME_PREFIX: 'LT-',            // users, caravans, stations, challenges
  MARKER_KEY: 'loadtest_sandbox' // SystemSetting row written by seed.js on a sandbox DB
};

const ALLOWED_HOSTS = new Set(['postgres', 'pgbouncer', 'localhost', '127.0.0.1', '::1',
  ...String(process.env.LT_EXTRA_DB_HOSTS || '').split(',').map(s => s.trim()).filter(Boolean)]);

function fail(msg) {
  console.error(`\n[loadtest guard] REFUSING TO RUN: ${msg}\n`);
  process.exit(2);
}

/** Static checks on the connection string, before any connection is opened. */
function assertSandboxUrl() {
  if (process.env.LOADTEST_SANDBOX !== '1') fail('LOADTEST_SANDBOX=1 is not set');
  const raw = process.env.DATABASE_URL || '';
  let url;
  try { url = new URL(raw); } catch { fail('DATABASE_URL is missing or not a URL'); }
  const host = url.hostname.toLowerCase();
  const db = url.pathname.replace(/^\//, '');
  if (/nopa-app\.ir$|supabase|pooler/.test(host)) fail(`host "${host}" looks like production`);
  if (!ALLOWED_HOSTS.has(host)) fail(`host "${host}" is not a sandbox host (${[...ALLOWED_HOSTS].join(', ')})`);
  if (!db.includes('loadtest')) fail(`database "${db}" must contain "loadtest" in its name`);
  return { host, db };
}

/**
 * Data check: the DB must already carry the sandbox marker, or (seed only) hold no real users at all.
 * A copy of production restored into a "loadtest" database still has real users and no marker: refused.
 */
async function assertSandboxData(prisma, { allowFresh }) {
  const marker = await prisma.systemSetting.findUnique({ where: { key: LT.MARKER_KEY } });
  if (marker) return;
  if (!allowFresh) fail(`marker "${LT.MARKER_KEY}" not found: this DB was not created by seed.js`);
  const [{ n }] = await prisma.$queryRaw`
    SELECT count(*)::int AS n FROM "User"
    WHERE NOT ("phoneNumber" LIKE ${LT.PHONE_PREFIX + '%'} AND "name" LIKE ${LT.NAME_PREFIX + '%'})`;
  if (n > 0) fail(`${n} non-test users found: this is not an empty sandbox`);
  await prisma.systemSetting.create({ data: { key: LT.MARKER_KEY, value: new Date().toISOString() } });
}

module.exports = { LT, assertSandboxUrl, assertSandboxData };
