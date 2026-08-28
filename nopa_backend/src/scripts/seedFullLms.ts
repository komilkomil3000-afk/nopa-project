import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function seedLms() {
  console.log('Seeding 5 full LMS stations with Skill & Media classes, sessions, parts, and mini-quizzes...');

  // Clean existing LMS data to build accurate structure
  await prisma.quizSubmission.deleteMany({});
  await prisma.quiz.deleteMany({});
  await prisma.videoClip.deleteMany({});
  await prisma.classSession.deleteMany({});
  await prisma.classCategory.deleteMany({});
  await prisma.station.deleteMany({});

  const stationTitles = [
    { title: 'منزلگاه اول: مبانی و رسانه', subtitle: 'شناخت اولویت‌ها و ابزارهای تولید رسانه', desc: 'منزلگاه ورود به مسیر رشد مهارتی و سواد رسانه‌ای' },
    { title: 'منزلگاه دوم: خودشناسی و پادکست', subtitle: 'تحلیل خویشتن و ساخت محتوای صوتی', desc: 'منزلگاه دوم تمرکز بر توانمندی‌های فردی و تولید پادکست' },
    { title: 'منزلگاه سوم: همراهان و گرافیک', subtitle: 'تیم‌سازی و گرافیک هوشمند', desc: 'منزلگاه سوم توسعه همکاری گروهی و یادگیری ابزارهای گرافیکی' },
    { title: 'منزلگاه چهارم: تفکر انتقادی و کنوا پیشرفته', subtitle: 'نقد رسانه و گرافیک حرفه‌ای', desc: 'منزلگاه چهارم ارتقای سواد تحلیل رسانه و طراحی دیزاین‌های پیچیده' },
    { title: 'منزلگاه پنجم: هدف‌گذاری و فتوشاپ', subtitle: 'برنامه‌ریزی راهبردی و فتوشاپ کامپیوتر', desc: 'منزلگاه پنجم بهینه‌سازی مسیر آینده و مهارت‌های فوتوشاپ' }
  ];

  for (let i = 0; i < 5; i++) {
    const stInfo = stationTitles[i];
    const station = await prisma.station.create({
      data: {
        title: stInfo.title,
        subtitle: stInfo.subtitle,
        description: stInfo.desc,
        orderIndex: i + 1,
        releaseDate: new Date()
      }
    });

    // 2 Categories for each station: Skill & Media
    const categories = [
      { title: 'کلاس‌های مهارتی (مهارت فردی و گروهی)', orderIndex: 1 },
      { title: 'کلاس‌های رسانه‌ای (سواد رسانه و تولید محتوا)', orderIndex: 2 }
    ];

    for (const catData of categories) {
      const category = await prisma.classCategory.create({
        data: {
          stationId: station.id,
          title: catData.title,
          orderIndex: catData.orderIndex
        }
      });

      // 2 Sessions per category
      const sessionCount = 2;
      for (let s = 1; s <= sessionCount; s++) {
        const isSkill = catData.orderIndex === 1;
        const sessionTitle = isSkill 
          ? `جلسه ${s} مهارتی: ${s === 1 ? 'اصول خودپایشی و زمان‌بندی' : 'روش‌های تصمیم‌گیری مؤلفه‌ای'}`
          : `جلسه ${s} رسانه‌ای: ${s === 1 ? 'مبانی تولید ویدیو و تدوین' : 'تکنیک‌های روایتگری متقاعدکننده'}`;

        const session = await prisma.classSession.create({
          data: {
            categoryId: category.id,
            title: sessionTitle,
            orderIndex: s,
            minWatchThreshold: 70.0,
            description: `توضیحات و محتوای آموزشی ${sessionTitle}`
          }
        });

        // 3 Parts (VideoClips) per Session
        const partCount = 3;
        for (let p = 1; p <= partCount; p++) {
          const clip = await prisma.videoClip.create({
            data: {
              sessionId: session.id,
              title: `پارت ${p}: ${sessionTitle} (بخش ${p})`,
              videoUrl: 'https://www.aparat.com/v/fye6j10',
              clipOrder: p,
              duration: 600
            }
          });

          // Mini-Quiz immediately after EACH part (linked to clip.id)
          await prisma.quiz.create({
            data: {
              sessionId: session.id,
              clipId: clip.id,
              title: `آزمونک پارت ${p} - ${sessionTitle}`,
              orderIndex: p,
              rewardZarik: 10,
              questionsJson: JSON.stringify([
                {
                  question: `مفهوم کلیدی مطرح‌شده در پارت ${p} کدام است؟`,
                  options: [
                    `گزینه صحیح برای پارت ${p}`,
                    'گزینه نادرست اول',
                    'گزینه نادرست دوم',
                    'گزینه نادرست سوم'
                  ],
                  correctIndex: 0
                }
              ])
            }
          });
        }
      }
    }
  }

  console.log('✅ 5 Stations successfully created with Skill & Media categories, Sessions, Parts, and per-Part Quizzes!');
}

seedLms()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
