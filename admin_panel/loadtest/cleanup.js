// Removes every row the load test created (tag LT- / phone 0900...) from the sandbox DB, in one
// transaction. Schema, _prisma_migrations and anything untagged are left alone.
//   docker compose run --rm cleanup                 delete test data, keep the sandbox marker
//   docker compose run --rm cleanup node loadtest/cleanup.js --dry-run   only count
// Raw SQL on purpose: the Prisma client turns delete/deleteMany on User/Caravan into soft deletes.
const { LT, assertSandboxUrl, assertSandboxData } = require('./sandbox-guard');

const target = assertSandboxUrl();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry-run');

const USERS = `SELECT id FROM "User" WHERE "phoneNumber" LIKE '${LT.PHONE_PREFIX}%' AND "name" LIKE '${LT.NAME_PREFIX}%'`;
const CARAVANS = `SELECT id FROM "Caravan" WHERE "name" LIKE '${LT.NAME_PREFIX}%'`;

// Order matters only for rows that would otherwise be orphaned (SET NULL / no FK); the rest cascade.
const STEPS = [
  ['AuditLog (logins etc. by test users)', `DELETE FROM "AuditLog" WHERE "actorId" IN (${USERS})`],
  ['ChatMessage by test users in shared spaces', `DELETE FROM "ChatMessage" WHERE "senderId" IN (${USERS})`],
  ['ChatSpace of test caravans (+messages, members)', `DELETE FROM "ChatSpace" WHERE "caravanId" IN (${CARAVANS})`],
  ['Challenge (+submissions, events)', `DELETE FROM "Challenge" WHERE "title" LIKE '${LT.NAME_PREFIX}%'`],
  ['Station (+categories, sessions, clips, quizzes)', `DELETE FROM "Station" WHERE "title" LIKE '${LT.NAME_PREFIX}%'`],
  ['Caravan', `DELETE FROM "Caravan" WHERE "name" LIKE '${LT.NAME_PREFIX}%'`],
  ['User (+sessions, memberships, notifications, ...)', `DELETE FROM "User" WHERE id IN (${USERS})`],
];

async function main() {
  console.log(`[cleanup] target ${target.host}/${target.db}${DRY ? ' (dry run)' : ''}`);
  await assertSandboxData(prisma, { allowFresh: false });

  if (DRY) {
    for (const [label, sql] of STEPS) {
      const count = sql.replace(/^DELETE FROM ("\w+") WHERE/, 'SELECT count(*)::int AS n FROM $1 WHERE');
      const [{ n }] = await prisma.$queryRawUnsafe(count);
      console.log(`  ${String(n).padStart(7)}  ${label}`);
    }
    return;
  }

  await prisma.$transaction(async tx => {
    for (const [label, sql] of STEPS) {
      const n = await tx.$executeRawUnsafe(sql);
      console.log(`  ${String(n).padStart(7)}  ${label}`);
    }
  }, { timeout: 120_000 });

  const [{ n }] = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM (${USERS}) u`);
  if (n !== 0) throw new Error(`${n} test users still present`);
  await prisma.$executeRawUnsafe('VACUUM (ANALYZE)');
  console.log('[cleanup] sandbox test data removed; schema and migrations untouched.');
}

main()
  .catch(e => { console.error('[cleanup] failed:', e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
