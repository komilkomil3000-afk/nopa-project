import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function seed() {
  // 1. Seed Banners
  const banners = [
    { title: 'بنر اصلی بازارچه', imageUrl: 'https://picsum.photos/800/400?random=1', position: 'bazaar_top', targetRoute: 'bazaar', isActive: true, orderIndex: 1 },
    { title: 'رویداد سراسری نوپا', imageUrl: 'https://picsum.photos/800/400?random=2', position: 'home_top', targetRoute: 'news', isActive: true, orderIndex: 2 },
    { title: 'کلاسهای مهارتی هفته', imageUrl: 'https://picsum.photos/800/400?random=3', position: 'lms_slider', targetRoute: 'lms', isActive: true, orderIndex: 3 }
  ];
  for (const b of banners) {
    await prisma.banner.create({ data: b });
  }

  // 2. Seed News
  const news = [
    { title: 'آغاز مرحله ارزیابی کاروانها', body: 'مرحله اول ارزیابی کاروانها با حضور راهبران آغاز شد.', category: 'اطلاعیه', reporter: 'روابط عمومی', targetAudience: 'ALL', isPublished: true },
    { title: 'جوایز جدید بازارچه زرین', body: 'جوایز نفیس جدید در فروشگاه زریک اضافه گردید.', category: 'رویداد', reporter: 'واحد مالی', targetAudience: 'ALL', isPublished: true }
  ];
  for (const n of news) {
    await prisma.newsArticle.create({ data: n });
  }
  console.log('✅ Banners and News seeded successfully into DB!');
}
seed().finally(() => prisma.$disconnect());
