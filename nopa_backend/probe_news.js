const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const news = await prisma.newsArticle.findMany();
  console.log('Total News Articles in DB:', news.length);
  if (news.length === 0) {
    console.log('Creating initial sample news articles...');
    await prisma.newsArticle.createMany({
      data: [
        {
          title: 'آغاز رسمی چالش‌های منزلگاه اول نپا',
          subtitle: 'دانش‌آموزان گرامی می‌توانند پس از تماشای ویدیوها در آزمونک‌ها شرکت نمایند',
          body: 'کلیه مخاطبان عزیز نپا با ورود به منزلگاه اول و تماشای پارت‌های آموزشی می‌توانند در آزمونک‌های هر پارت شرکت کرده و پاداش زریک دریافت نمایند.',
          reporter: 'ستاد آموزش نپا',
          category: 'اطلاعیه مهم',
          targetAudience: 'ALL',
          isPublished: true,
          publishDate: new Date(),
        },
        {
          title: 'مسابقه بزرگ تولید پادکست و محتوای صوتی',
          subtitle: 'جوایز ویژه برای کاروان‌های برتر دوره نپا',
          body: 'کاروان‌هایی که بهترین پروژه‌های صوتی با نرم‌افزار آدیشن را تولید کنند، مشمول دریافت بیرق‌های طلایی و مدال‌های افتخار خواهند شد.',
          reporter: 'واحد رسانه نپا',
          category: 'رویداد و مسابقه',
          targetAudience: 'STUDENTS',
          isPublished: true,
          publishDate: new Date(),
        }
      ]
    });
    console.log('Sample news created successfully!');
  }
}

main().finally(() => prisma.$disconnect());
