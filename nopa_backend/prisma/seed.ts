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
  console.log('=== Starting Safe LMS Deduplication & Seeding ===');

  // =========================================================================
  // 1. DELETE ONLY LEARNING ENTITIES (User, Caravan, Wallet, Auth REMAIN INTACT)
  // =========================================================================
  console.log('1. Clearing only LMS learning entities...');
  await prisma.userProgress.deleteMany({});
  await prisma.sessionWatchRecord.deleteMany({});
  await prisma.videoBookmark.deleteMany({});
  await prisma.quizSubmission.deleteMany({});
  await prisma.quiz.deleteMany({});
  await prisma.videoClip.deleteMany({});
  await prisma.classSession.deleteMany({});
  await prisma.classCategory.deleteMany({});
  await prisma.station.deleteMany({});
  console.log('LMS learning entities cleanly deleted.');

  // =========================================================================
  // 2. ENSURE ESSENTIAL USERS & CARAVANS EXIST WITHOUT CORRUPTING ACCOUNTS
  // =========================================================================
  console.log('2. Verifying existing users and accounts...');
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

  for (const u of seedUsers) {
    const existing = await prisma.user.findFirst({
      where: { phoneNumber: u.phoneNumber },
    });
    if (!existing) {
      await prisma.user.create({ data: u });
    }
  }

  // Ensure Caravans
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
  }

  // =========================================================================
  // 3. SEED CLEAN SHEET 03 LMS DATA (5 UNIQUE STATIONS & 400 QUIZZES)
  // =========================================================================
  console.log('3. Seeding clean Sheet 03 stations, categories, sessions, clips and 400 quizzes...');

  const sheet03Stations = [
    {
      orderIndex: 1,
      title: 'منزلگاه اول',
      topicsDescription: 'موضوع مهارتی: مبانی شناخت، شوک و هویت فردی | موضوع رسانه‌ای: ویرایش ویدیو با اینشات (InShot)',
      skillTopics: 'مبانی شناخت و هویت فردی',
      mediaTopics: 'ویرایش ویدیو با اینشات',
      skillInstructor: 'علیرضا خوش‌منظر',
      mediaInstructor: 'استاد رسانه',
    },
    {
      orderIndex: 2,
      title: 'منزلگاه دوم',
      topicsDescription: 'موضوع مهارتی: خودشناسی، نقاط قوت و هوش درون‌فردی | موضوع رسانه‌ای: پادکست و ادیت صوت با آدیشن',
      skillTopics: 'خودشناسی و رشد فردی',
      mediaTopics: 'تولید پادکست و ادیت صوت',
      skillInstructor: 'استاد مهارتی نپا',
      mediaInstructor: 'پیراینه‌گر',
    },
    {
      orderIndex: 3,
      title: 'منزلگاه سوم',
      topicsDescription: 'موضوع مهارتی: شناخت همراهان و کار گروهی مؤثر | موضوع رسانه‌ای: طراحی پوستر و گرافیک با کنوا (Canva)',
      skillTopics: 'شناخت همراهان و کار گروهی',
      mediaTopics: 'طراحی پوستر با کنوا',
      skillInstructor: 'پیردیده‌بان',
      mediaInstructor: 'پیرچهره‌تراش',
    },
    {
      orderIndex: 4,
      title: 'منزلگاه چهارم',
      topicsDescription: 'موضوع مهارتی: شناخت هستی و هدفمندی در زندگی | موضوع رسانه‌ای: کنوا پیشرفته و هوش مصنوعی',
      skillTopics: 'شناخت هستی و هدفمندی',
      mediaTopics: 'کنوا پیشرفته و AI',
      skillInstructor: 'پیرمنجم',
      mediaInstructor: 'پیرناخدا',
    },
    {
      orderIndex: 5,
      title: 'منزلگاه پنجم',
      topicsDescription: 'موضوع مهارتی: برنامه‌ریزی، هدف‌گذاری و اقدام عملی | موضوع رسانه‌ای: طراحی حرفه‌ای با فتوشاپ (Photoshop)',
      skillTopics: 'برنامه‌ریزی و هدف‌گذاری',
      mediaTopics: 'طراحی با فتوشاپ',
      skillInstructor: 'حیدری',
      mediaInstructor: 'کمیل زاهدی',
    },
  ];

  let totalQuizzesCreated = 0;
  let totalClipsCreated = 0;
  let totalSessionsCreated = 0;
  let totalCategoriesCreated = 0;

  for (const st of sheet03Stations) {
    const station = await prisma.station.create({
      data: {
        title: st.title,
        description: st.topicsDescription,
        subtitle: `${st.skillInstructor} / ${st.mediaInstructor}`,
        orderIndex: st.orderIndex,
        releaseDate: new Date(),
      }
    });

    console.log(`Created [Station ${st.orderIndex}]: ${station.title}`);

    // Exactly 2 categories per station (Zero duplicates)
    const categoriesConfig = [
      {
        title: 'کلاس‌های مهارتی',
        orderIndex: 1,
        topic: st.skillTopics,
        instructor: st.skillInstructor,
      },
      {
        title: 'کلاس‌های رسانه‌ای',
        orderIndex: 2,
        topic: st.mediaTopics,
        instructor: st.mediaInstructor,
      }
    ];

    for (const catConfig of categoriesConfig) {
      const category = await prisma.classCategory.create({
        data: {
          stationId: station.id,
          title: catConfig.title,
          orderIndex: catConfig.orderIndex,
        }
      });
      totalCategoriesCreated++;

      // 4 Sessions per category (4 sessions * 10 categories = 40 sessions total)
      const sessionTitles = [
        'مفاهیم پایه و اصول بنیادین',
        'تکنیک‌ها و ابزارهای کاربردی',
        'تمرین، تحلیل و کارگاه عملی',
        'پروژه جامع، خروجی و ارزیابی'
      ];

      for (let sIdx = 0; sIdx < 4; sIdx++) {
        const sessionNum = sIdx + 1;
        const session = await prisma.classSession.create({
          data: {
            categoryId: category.id,
            title: `جلسه ${sessionNum} ${catConfig.title}: ${sessionTitles[sIdx]} (${catConfig.topic})`,
            description: `سرفصل‌های جلسه ${sessionNum} ${catConfig.title} - ${sessionTitles[sIdx]} در حوزه ${catConfig.topic}`,
            instructor: catConfig.instructor,
            orderIndex: sessionNum,
            minWatchThreshold: 70.0,
            maxZarikReward: 100,
          }
        });
        totalSessionsCreated++;

        // 10 Video Clips & 10 Quizzes per session (10 * 40 = 400 clips & 400 quizzes)
        for (let p = 1; p <= 10; p++) {
          const clip = await prisma.videoClip.create({
            data: {
              sessionId: session.id,
              title: `پارت ${p}: ${catConfig.topic} (بخش ${p})`,
              videoUrl: 'https://www.aparat.com/v/fye6j10',
              clipOrder: p,
              duration: 600,
            }
          });
          totalClipsCreated++;

          await prisma.quiz.create({
            data: {
              sessionId: session.id,
              clipId: clip.id,
              title: `آزمونک پارت ${p} - جلسه ${sessionNum} (${catConfig.title})`,
              orderIndex: p,
              type: 'MULTIPLE_CHOICE',
              rewardZarik: 10,
              questionsJson: JSON.stringify([
                {
                  question: `در پارت ${p} از جلسه ${sessionNum} (${catConfig.topic})، مهم‌ترین اصل یادگیری چیست؟`,
                  options: [
                    'درک عمیق مفاهیم، تمرین مستمر و پیاده‌سازی کاربردی',
                    'صرفاً حفظ کردن بدون کاربرد عملی',
                    'نادیده گرفتن استانداردهای آموزشی',
                    'تمرکز بدون توجه به بازخورد مربی'
                  ],
                  correctIndex: 0
                }
              ]),
            }
          });
          totalQuizzesCreated++;
        }
      }
    }
  }

  console.log('====================================================');
  console.log(`LMS Seeding Summary:`);
  console.log(`- Unique Stations: ${sheet03Stations.length}`);
  console.log(`- Total Categories: ${totalCategoriesCreated} (Exactly 2 unique per station)`);
  console.log(`- Total Sessions: ${totalSessionsCreated}`);
  console.log(`- Total Video Clips: ${totalClipsCreated}`);
  console.log(`- Total Quizzes: ${totalQuizzesCreated}`);
  console.log('====================================================');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
