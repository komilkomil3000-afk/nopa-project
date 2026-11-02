// One-off repair for class categories whose orderIndex was reset to 0 when only their title was saved in the
// admin panel (fixed in createOrUpdateCategory). For every station whose categories have a 0 or a duplicate
// orderIndex, the categories are renumbered 1..n by their creation time, which is the order they were created in.
//
// Dry run (prints what would change):   npx ts-node src/scripts/repairCategoryOrder.ts
// Apply:                                npx ts-node src/scripts/repairCategoryOrder.ts --apply

import prisma from '../config/db';

async function main() {
  const apply = process.argv.includes('--apply');
  const stations = await prisma.station.findMany({
    select: { id: true, title: true, categories: { select: { id: true, title: true, orderIndex: true, createdAt: true } } },
    orderBy: { orderIndex: 'asc' },
  });

  let changed = 0;
  for (const st of stations) {
    const orders = st.categories.map(c => c.orderIndex);
    const broken = orders.some(o => !o || o < 1) || new Set(orders).size !== orders.length;
    if (!broken) continue;

    const sorted = [...st.categories].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    console.log(`\n${st.title}`);
    for (let i = 0; i < sorted.length; i++) {
      const cat = sorted[i];
      const next = i + 1;
      console.log(`  ${cat.title}: ${cat.orderIndex} -> ${next}`);
      if (apply && cat.orderIndex !== next) {
        await prisma.classCategory.update({ where: { id: cat.id }, data: { orderIndex: next } });
        changed++;
      }
    }
  }
  console.log(apply ? `\nUpdated ${changed} categories.` : '\nDry run only. Re-run with --apply to save.');
}

main()
  .catch(e => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
