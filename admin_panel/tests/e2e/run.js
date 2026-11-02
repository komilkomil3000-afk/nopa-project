// End-to-end suites against a throwaway Postgres; nothing here can reach a real database.
// Run after `npm run build`:  npm run test:e2e   (one suite: npm run test:e2e -- fixes)
const EmbeddedPostgres = require('embedded-postgres').default;
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const PORT = 54329;
const only = process.argv[2];
const suites = fs.readdirSync(__dirname).filter(f => f.endsWith('.e2e.js') && (!only || f.startsWith(only)));

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nopa-e2e-'));
  const pg = new EmbeddedPostgres({
    databaseDir: path.join(dir, 'data'), user: 'postgres', password: 'pw', port: PORT, persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'], onLog: () => {},
  });
  await pg.initialise();
  await pg.start();

  let failed = 0;
  for (const [i, suite] of suites.entries()) {
    const db = `nopa_e2e_${i}`;
    await pg.createDatabase(db);
    const url = `postgresql://postgres:pw@localhost:${PORT}/${db}`;
    const env = {
      ...process.env, DATABASE_URL: url, DIRECT_URL: url, NODE_ENV: 'test', E2E_OUT: dir, CHAT_FILES_DIR: path.join(dir, `files-${i}`),
      JWT_SECRET: 'k3Y'.repeat(14), JWT_REFRESH_SECRET: 'r9Z'.repeat(14),
    };
    execSync('npx prisma migrate deploy', { cwd: ROOT, env, stdio: 'pipe' });
    console.log(`\n=== ${suite}`);
    const result = spawnSync(process.execPath, [path.join(__dirname, suite)], { cwd: ROOT, env, stdio: 'inherit' });
    if (result.status !== 0) failed++;
  }
  await pg.stop();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(failed ? `\n${failed} suite(s) FAILED` : `\nall ${suites.length} suites passed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
