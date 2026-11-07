/**
 * One-time repair of caravan ↔ mentor links made before the users tab started moving Caravan.mentorId.
 * A mentor is never a caravan member: who leads a caravan is Caravan.mentorId only.
 *
 *   npx ts-node src/scripts/reconcileCaravanMentors.ts           -> report only
 *   npx ts-node src/scripts/reconcileCaravanMentors.ts --apply   -> fix what is unambiguous
 *
 * Fixed with --apply:
 *  - a mentor whose caravanId is the caravan he already leads: caravanId cleared;
 *  - a mentor whose caravanId points to a caravan without a mentor: he becomes its mentor, caravanId cleared.
 * Only reported (the admin decides, by saving the mentor once in the users tab):
 *  - a mentor whose caravanId points to a caravan another mentor leads.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const isMentor = (r: string) => ['mentor', 'supermentor'].includes(String(r || '').toLowerCase().replace(/[\s_-]/g, ''));

async function main() {
  const apply = process.argv.includes('--apply');
  const users = await prisma.user.findMany({
    where: { caravanId: { not: null }, isDeleted: false },
    select: { id: true, name: true, role: true, caravanId: true, caravan: { select: { id: true, name: true, mentorId: true, mentor: { select: { name: true } } } } },
  });
  const mentors = users.filter(u => isMentor(u.role));
  const touched = new Set<string>();
  let fixed = 0;
  const conflicts: string[] = [];

  for (const m of mentors) {
    const c = m.caravan;
    if (!c) continue;
    if (c.mentorId === m.id) {
      console.log(`[member link] ${m.name} → «${c.name}» (already leads it): clear caravanId`);
      if (apply) { await prisma.user.update({ where: { id: m.id }, data: { caravanId: null } }); fixed++; touched.add(c.id); }
    } else if (!c.mentorId) {
      console.log(`[no mentor]   «${c.name}» has no mentor: ${m.name} becomes its mentor`);
      if (apply) {
        await prisma.$transaction([
          prisma.caravan.update({ where: { id: c.id }, data: { mentorId: m.id } }),
          prisma.user.update({ where: { id: m.id }, data: { caravanId: null } }),
        ]);
        fixed++; touched.add(c.id);
      }
    } else {
      conflicts.push(`«${c.name}»: mentor is ${c.mentor?.name || c.mentorId}, but ${m.name} is also linked to it (users tab). Save ${m.name} once in the users tab with the right caravan.`);
    }
  }

  for (const id of touched) {
    const count = await prisma.user.count({ where: { caravanId: id } });
    await prisma.caravan.update({ where: { id }, data: { memberCount: count } });
  }

  console.log(`\nMentors with a caravanId: ${mentors.length}. ${apply ? `Fixed: ${fixed}.` : 'Report only (run with --apply to fix).'}`);
  if (conflicts.length) {
    console.log(`\nConflicts to decide in the panel (${conflicts.length}):`);
    conflicts.forEach(c => console.log(' - ' + c));
  }
}

main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
