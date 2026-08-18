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

  const passwordHash = await bcrypt.hash('123456', 10);
  const localIp = getLocalIp();

  const seedUsers = [
    {
      name: 'کمیل عارف',
      role: 'student',
      phoneNumber: '09121111111',
      passwordHash,
      zarikBalance: 0,
      levelFrame: 1,
      identityVerified: true,
      userCode: 110100,
    },
    {
      name: 'سارا عارف',
      role: 'student',
      phoneNumber: '09121111111',
      passwordHash,
      zarikBalance: 0,
      levelFrame: 1,
      identityVerified: true,
      userCode: 110101,
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
      name: 'مدیر ارشد',
      role: 'admin',
      phoneNumber: '09380346668',
      passwordHash,
      zarikBalance: 0,
      levelFrame: 1,
      identityVerified: true,
      userCode: 110104,
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

  // Fetch created users to use their IDs
  const studentKomeil = await prisma.user.findFirst({ where: { phoneNumber: '09121111111', name: 'کمیل عارف' } });
  const studentSara = await prisma.user.findFirst({ where: { phoneNumber: '09121111111', name: 'سارا عارف' } });
  const mentorAli = await prisma.user.findFirst({ where: { phoneNumber: '09122222222' } });

  if (studentKomeil && studentSara && mentorAli) {
    let caravanYavaran = await prisma.caravan.findFirst({ where: { name: 'کاروان یاوران' } });
    if (!caravanYavaran) {
      caravanYavaran = await prisma.caravan.create({
        data: {
          name: 'کاروان یاوران',
          mentorId: mentorAli.id,
          memberCount: 2,
          capacityLimit: 20,
          overallProgress: 45.5,
        }
      });
      console.log('Created Caravan: کاروان یاوران');
    }

    // Assign students to caravan
    await prisma.user.update({ where: { id: studentKomeil.id }, data: { caravanId: caravanYavaran.id } });
    await prisma.user.update({ where: { id: studentSara.id }, data: { caravanId: caravanYavaran.id } });

    // Seed Evaluations
    const evalExists = await prisma.mentorEvaluation.findFirst({ where: { studentId: studentKomeil.id, mentorId: mentorAli.id } });
    if (!evalExists) {
      await prisma.mentorEvaluation.create({
        data: {
          studentId: studentKomeil.id,
          mentorId: mentorAli.id,
          rating: 4,
          responsivenessScore: 5,
          guidanceScore: 4,
          feedbackText: 'استاد بسیار عالی و پاسخگو هستند.'
        }
      });
      await prisma.mentorEvaluation.create({
        data: {
          studentId: studentSara.id,
          mentorId: mentorAli.id,
          rating: 5,
          responsivenessScore: 5,
          guidanceScore: 5,
          feedbackText: 'بهترین راهبر!'
        }
      });
      console.log('Seeded Mentor Evaluations');
    }

    // Seed Support Tickets
    const ticketExists = await prisma.supportTicket.findFirst({ where: { studentId: studentKomeil.id } });
    if (!ticketExists) {
      const ticket = await prisma.supportTicket.create({
        data: {
          studentId: studentKomeil.id,
          category: 'درخواست راهنمایی تحصیلی',
          subject: 'مشکل در فهم مبحث ریاضیات گسسته',
          status: 'open',
        }
      });
      
      await prisma.supportTicketReply.create({
        data: {
          ticketId: ticket.id,
          mentorId: mentorAli.id,
          message: 'سلام کمیل جان، لطفاً دقیق‌تر بگو کجای مبحث مشکل داری؟'
        }
      });
      console.log('Seeded Support Tickets');
    }
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
