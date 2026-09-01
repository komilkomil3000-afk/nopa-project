const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectCaravans() {
  const totalCaravans = await prisma.caravan.count();
  console.log('Total Caravans in DB:', totalCaravans);

  // Group by name to see duplicates
  const grouped = await prisma.caravan.groupBy({
    by: ['name'],
    _count: {
      id: true
    },
    having: {
      name: {
        _count: {
          gt: 1
        }
      }
    }
  });

  console.log('Caravans with duplicate names:', grouped.length);
  if (grouped.length > 0) {
    console.log('Top duplicates:', grouped.slice(0, 10));
  }

  // Also check all caravans
  const allCaravans = await prisma.caravan.findMany({
    select: {
      id: true,
      name: true,
      mentorId: true,
      _count: {
        select: {
          members: true,
          chatMessages: true,
          assetConversions: true
        }
      }
    }
  });

  console.log('Detailed list of all caravans in DB:');
  console.log(JSON.stringify(allCaravans, null, 2));
}

inspectCaravans().catch(console.error).finally(() => prisma.$disconnect());
