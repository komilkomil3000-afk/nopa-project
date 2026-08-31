const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearAllChallenges() {
  await prisma.submission.deleteMany({});
  const result = await prisma.challenge.deleteMany({});
  console.log('✅ Deleted all challenges from database. Total deleted:', result.count);
}

clearAllChallenges()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
