import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as os from 'os';

function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]!) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial data (upserting to avoid data loss)...');

  // Hard delete obsolete user and dummy mentor records
  try {
    // Delete child records first to avoid foreign key constraints (if any)
    await prisma.mentorEvaluation.deleteMany({
      where: {
        OR: [
          { student: { name: { contains: 'سارا عارف' } } },
          { student: { name: { contains: 'کمیل عارف' } } },
          { student: { name: { contains: 'تستی' } } },
          { mentor: { name: { contains: 'تستی' } } },
          { mentor: { phoneNumber: { in: ['09122222222', '09200000001', '09200000002'] } } }
        ]
      }
    });
    
    await prisma.supportTicket.deleteMany({
      where: { 
        OR: [
          { student: { name: { contains: 'سارا عارف' } } },
          { student: { name: { contains: 'کمیل عارف' } } },
          { student: { name: { contains: 'تستی' } } }
        ]
      }
    });

    await prisma.user.deleteMany({
      where: {
        OR: [
          { name: { contains: 'سارا عارف' } },
          { name: { contains: 'کمیل عارف' } },
          { name: { contains: 'تستی' } },
          { name: { contains: 'تست' } },
          { phoneNumber: { in: ['09122222222', '09200000001', '09200000002', '09121111111'] } }
        ]
      }
    });
  } catch (e: any) {
    console.log('Cleanup error (might be expected if records do not exist):', e.message);
  }

  const passwordHash = await bcrypt.hash('123456', 10);
  const localIp = getLocalIp();

  const seedUsers = [
    {
      name: 'رضا جلالی',
      role: 'mentor',
      phoneNumber: '09199840686',
      passwordHash,
      mentorLevel: 3,
      zarikBalance: 0,
      levelFrame: 1,
      identityVerified: true,
      userCode: 110102,
    },
    {
      name: 'مدیر ارشد',
      role: 'admin',
      phoneNumber: '09120000001',
      passwordHash,
      zarikBalance: 0,
      levelFrame: 1,
      identityVerified: true,
      userCode: 110103,
    },
    {
      name: 'علیرضا خوشمنظر',
      role: 'admin',
      phoneNumber: '09196657042',
      passwordHash,
      zarikBalance: 0,
      levelFrame: 1,
      identityVerified: true,
      userCode: 110105,
    },
    {
      name: 'محمد کویتی',
      role: 'mentor',
      phoneNumber: '09191604524',
      passwordHash,
      mentorLevel: 3,
      zarikBalance: 0,
      levelFrame: 1,
      identityVerified: true,
      userCode: 110106,
    },
    {
      name: 'حسینعلی',
      role: 'student',
      phoneNumber: '09036658547',
      passwordHash,
      zarikBalance: 50,
      levelFrame: 2,
      identityVerified: true,
      userCode: 110107,
    },
    {
      name: 'طیب',
      role: 'student',
      phoneNumber: '09121111112',
      passwordHash,
      zarikBalance: 20,
      levelFrame: 1,
      identityVerified: true,
      userCode: 110108,
    },
  ];

  for (const user of seedUsers) {
    const existing = await prisma.user.findFirst({
      where: { phoneNumber: user.phoneNumber },
    });
    
    if (!existing) {
      console.log(`Seeding User: ${user.name} (${user.phoneNumber})...`);
      await prisma.user.create({
        data: user,
      });
    } else {
      console.log(`Updating existing User: ${existing.name} (${existing.phoneNumber})...`);
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: user.name,
          role: user.role,
        },
      });
    }
  }

  console.log('Seeding complete for Users!');

  console.log('Seeding Caravans...');
  let caravanKuwaiti = await prisma.caravan.findFirst({ where: { name: 'کاروان کویتی' } });
  if (!caravanKuwaiti) {
    const mentorKuwaiti = await prisma.user.findFirst({ where: { phoneNumber: '09191604524' } });
    caravanKuwaiti = await prisma.caravan.create({
      data: {
        name: 'کاروان کویتی',
        mentorId: mentorKuwaiti?.id,
        status: 'active',
        memberCount: 0,
      }
    });
    console.log('Created کاروان کویتی');
  } else {
    const mentorKuwaiti = await prisma.user.findFirst({ where: { phoneNumber: '09191604524' } });
    await prisma.caravan.update({ where: { id: caravanKuwaiti.id }, data: { mentorId: mentorKuwaiti?.id } });
  }

  let caravanJalali = await prisma.caravan.findFirst({ where: { name: 'کاروان جلالی' } });
  if (!caravanJalali) {
    const mentorJalali = await prisma.user.findFirst({ where: { phoneNumber: '09199840686' } });
    caravanJalali = await prisma.caravan.create({
      data: {
        name: 'کاروان جلالی',
        mentorId: mentorJalali?.id,
        status: 'active',
        memberCount: 0,
      }
    });
    console.log('Created کاروان جلالی');
  } else {
    const mentorJalali = await prisma.user.findFirst({ where: { phoneNumber: '09199840686' } });
    await prisma.caravan.update({ where: { id: caravanJalali.id }, data: { mentorId: mentorJalali?.id } });
  }

  console.log('Assigning students to Caravans...');
  const studentHossein = await prisma.user.findFirst({ where: { phoneNumber: '09036658547' } });
  if (studentHossein && caravanKuwaiti) {
    await prisma.user.update({ where: { id: studentHossein.id }, data: { caravanId: caravanKuwaiti.id } });
    console.log('Assigned حسینعلی to کاروان کویتی');
  }

  const studentTayeb = await prisma.user.findFirst({ where: { phoneNumber: '09121111112' } });
  if (studentTayeb && caravanJalali) {
    await prisma.user.update({ where: { id: studentTayeb.id }, data: { caravanId: caravanJalali.id } });
    console.log('Assigned طیب to کاروان جلالی');
  }



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

  // Category 1
  let category1 = await prisma.classCategory.findFirst({ where: { title: 'کلاسهای مهارتی', stationId: station1.id } });
  if (!category1) {
    category1 = await prisma.classCategory.create({
      data: {
        stationId: station1.id,
        title: 'کلاسهای مهارتی',
        orderIndex: 1,
      }
    });
    console.log('Created Category 1: کلاسهای مهارتی');
  }

  // Category 2
  let category2 = await prisma.classCategory.findFirst({ where: { title: 'کلاسهای رسانه‌ای', stationId: station2.id } });
  if (!category2) {
    category2 = await prisma.classCategory.create({
      data: {
        stationId: station2.id,
        title: 'کلاسهای رسانه‌ای',
        orderIndex: 1,
      }
    });
    console.log('Created Category 2: کلاسهای رسانه‌ای');
  }

  const sampleQuestions = JSON.stringify([
    {
      question: "مفهوم اصلی مطرح شده در این بخش چیست؟",
      options: ["تمرکز", "مدیریت زمان", "هدف‌گذاری", "هیچکدام"],
      correctIndex: 2
    },
    {
      question: "کدام گزینه صحیح است؟",
      options: ["الف", "ب", "ج", "د"],
      correctIndex: 1
    }
  ]);

  const generateSession = async (categoryId: string, sessionIndex: number, categoryTitle: string) => {
    const sessionTitle = `جلسه ${sessionIndex}: ${categoryTitle}`;
    let session = await prisma.classSession.findFirst({ where: { title: sessionTitle, categoryId } });
    if (!session) {
      session = await prisma.classSession.create({
        data: {
          categoryId,
          title: sessionTitle,
          description: `توضیحات ${sessionTitle}`,
          instructor: 'استاد علی',
          orderIndex: sessionIndex,
          maxZarikReward: 500,
        }
      });
      console.log(`Created ${sessionTitle}`);

      // Create exactly 3 Video Clips
      for (let i = 1; i <= 3; i++) {
        await prisma.videoClip.create({
          data: {
            sessionId: session.id,
            title: `بخش ${i}`,
            videoUrl: `http://${localIp}:5000/uploads/test_video.mp4`,
            clipOrder: i,
            duration: 1200,
          }
        });
      }

      // Create 2 Quizzes (after Part 1, after Part 2)
      await prisma.quiz.create({
        data: {
          sessionId: session.id,
          title: `آزمون بین‌قسمتی ۱ (پس از بخش ۱)`,
          orderIndex: 1,
          questionsJson: sampleQuestions,
          rewardZarik: 100,
        }
      });

      await prisma.quiz.create({
        data: {
          sessionId: session.id,
          title: `آزمون بین‌قسمتی ۲ (پس از بخش ۲)`,
          orderIndex: 2,
          questionsJson: sampleQuestions,
          rewardZarik: 150,
        }
      });
    }
  };

  // Category 1 -> 2 Class Sessions
  for (let i = 1; i <= 2; i++) {
    await generateSession(category1.id, i, 'مهارتی');
  }

  // Category 2 -> 4 Class Sessions
  for (let i = 1; i <= 4; i++) {
    await generateSession(category2.id, i, 'رسانه‌ای');
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
