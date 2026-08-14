import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial data (upserting to avoid data loss)...');

  const passwordHash = await bcrypt.hash('123456', 10);

  const seedUsers = [
    {
      name: 'کمیل عارف',
      role: 'student',
      phoneNumber: '09121111111',
      passwordHash,
      zarikBalance: 0,
      levelFrame: 1,
      identityVerified: true,
    },
    {
      name: 'سارا عارف',
      role: 'student',
      phoneNumber: '09121111111',
      passwordHash,
      zarikBalance: 0,
      levelFrame: 1,
      identityVerified: true,
    },
    {
      name: 'استاد علی',
      role: 'mentor',
      phoneNumber: '09122222222',
      passwordHash,
      mentorLevel: 3,
      zarikBalance: 0,
      levelFrame: 1,
      identityVerified: true,
    },
    {
      name: 'مدیر کل',
      role: 'admin',
      phoneNumber: '09120000001',
      passwordHash,
      zarikBalance: 0,
      levelFrame: 1,
      identityVerified: true,
    },
    {
      name: 'سوپر ادمین',
      role: 'admin',
      phoneNumber: '09380346668',
      passwordHash,
      zarikBalance: 0,
      levelFrame: 1,
      identityVerified: true,
    },
  ];

  for (const user of seedUsers) {
    // We cannot use upsert natively with non-unique fields, so we do a findFirst + create
    const existing = await prisma.user.findFirst({
      where: { phoneNumber: user.phoneNumber, name: user.name },
    });
    
    if (!existing) {
      console.log(`Seeding User: ${user.name} (${user.phoneNumber})...`);
      await prisma.user.create({ data: user });
    } else {
      console.log(`User already exists, skipping: ${user.name} (${user.phoneNumber})`);
    }
  }

  console.log('Seeding complete for Users!');

  // Seed LMS Data
  console.log('Seeding Baseline LMS Data...');
  
  let station1 = await prisma.station.findFirst({ where: { title: 'منزلگاه ۱' } });
  if (!station1) {
    station1 = await prisma.station.create({
      data: {
        title: 'منزلگاه ۱',
        subtitle: 'شروع مسیر خانواده انقلابی',
        description: 'در این منزلگاه با مفاهیم پایه آشنا می‌شوید.',
        orderIndex: 1,
      }
    });
    console.log('Created Station 1');
  }

  let station2 = await prisma.station.findFirst({ where: { title: 'منزلگاه ۲' } });
  if (!station2) {
    station2 = await prisma.station.create({
      data: {
        title: 'منزلگاه ۲',
        subtitle: 'مسیر رشد و تعالی',
        description: 'مباحث پیشرفته‌تر در این منزلگاه قرار دارد.',
        orderIndex: 2,
      }
    });
    console.log('Created Station 2');
  }

  // Add Category to Station 1
  let category1 = await prisma.classCategory.findFirst({ where: { title: 'دوره آموزشی مقدماتی', stationId: station1.id } });
  if (!category1) {
    category1 = await prisma.classCategory.create({
      data: {
        stationId: station1.id,
        title: 'دوره آموزشی مقدماتی',
        orderIndex: 1,
      }
    });
    console.log('Created Category 1');
  }

  // Add Session to Category 1
  let session1 = await prisma.classSession.findFirst({ where: { title: 'جلسه اول: آشنایی', categoryId: category1.id } });
  if (!session1) {
    session1 = await prisma.classSession.create({
      data: {
        categoryId: category1.id,
        title: 'جلسه اول: آشنایی',
        description: 'معرفی اولیه طرح و اهداف',
        instructor: 'استاد علی',
        orderIndex: 1,
      }
    });
    console.log('Created Session 1');
  }

  // Add Video Clip to Session 1
  let clip1 = await prisma.videoClip.findFirst({ where: { title: 'بخش اول: مقدمه', sessionId: session1.id } });
  if (!clip1) {
    clip1 = await prisma.videoClip.create({
      data: {
        sessionId: session1.id,
        title: 'بخش اول: مقدمه',
        videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
        clipOrder: 1,
        duration: 60,
      }
    });
    console.log('Created Video Clip 1');
  }

  console.log('Seeding complete for LMS!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
