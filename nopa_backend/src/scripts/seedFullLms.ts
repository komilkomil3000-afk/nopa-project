import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function seedLms() {
  console.log('Seeding 5 full LMS stations...');
  
  // Clean previous test stations if needed
  await prisma.station.deleteMany({});
  
  for (let i = 1; i <= 5; i++) {
    const station = await prisma.station.create({
      data: {
        title: `منزلگاه ${i}`,
        orderIndex: i,
        description: `توضیحات و سرفصل‌های آموزشی منزلگاه شماره ${i}`,
        releaseDate: new Date()
      }
    });

    // 2 Categories
    const catTypes = [
      { title: 'کلاس‌های مهارتی (شنبه و دوشنبه)', order: 1 },
      { title: 'کلاس‌های رسانه‌ای (پنجشنبه و جمعه)', order: 2 }
    ];

    for (const ct of catTypes) {
      const category = await prisma.classCategory.create({
        data: {
          stationId: station.id,
          title: ct.title,
          orderIndex: ct.order
        }
      });

      // 2 Classes per category
      for (let c = 1; c <= 2; c++) {
        const session = await prisma.classSession.create({
          data: {
            categoryId: category.id,
            title: `کلاس ${c} - ${ct.title.split(' ')[1]}`,
            orderIndex: c,
            minWatchThreshold: 70,
            description: `جلسه آموزشی شماره ${c}`
          }
        });

        // 6 Clips per class with per-part Quizzes
        for (let p = 1; p <= 6; p++) {
          await prisma.videoClip.create({
            data: {
              sessionId: session.id,
              title: `پارت ${p}: سرفصل موضوعی`,
              videoUrl: 'https://www.aparat.com/v/fye6j10',
              duration: 1200,
              clipOrder: p
            }
          });

          // 4-Option Quiz after each part
          await prisma.quiz.create({
            data: {
              sessionId: session.id,
              title: `آزمون پارت ${p}`,
              orderIndex: p,
              rewardZarik: 5,
              questionsJson: JSON.stringify([
                {
                  question: `سوال مربوط به پارت ${p} چیست؟`,
                  options: ['گزینه ۱ (صحیح)', 'گزینه ۲', 'گزینه ۳', 'گزینه ۴'],
                  correctIndex: 0
                }
              ])
            }
          });
        }
      }
    }
  }
  console.log('✅ 5 Full Stations with 20 Classes, 120 Clips, and Quizzes seeded successfully!');
}

seedLms().catch((e) => {
    console.error(e);
    process.exit(1);
}).finally(() => {
    prisma.$disconnect();
});
