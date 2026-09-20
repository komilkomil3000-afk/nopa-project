const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const stations = await prisma.station.findMany({
    orderBy: { orderIndex: 'asc' },
    select: {
      id: true,
      title: true,
      orderIndex: true,
      categories: {
        select: {
          id: true,
          title: true,
          orderIndex: true,
          sessions: {
            select: {
              id: true,
              title: true,
              sessionDate: true,
              sessionTime: true,
              instructor: true,
              orderIndex: true
            }
          }
        }
      }
    }
  });
  console.log(JSON.stringify(stations, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
