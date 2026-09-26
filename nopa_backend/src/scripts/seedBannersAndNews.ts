import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function seed() {
  // Clear existing banners & news to ensure fresh state
  await prisma.banner.deleteMany();
  await prisma.newsArticle.deleteMany();

  // 1. Seed Banners matching app sections
  const banners = [
    { title: 'رویداد سراسری نوپا', imageUrl: '/uploads/banner1.jpg', position: 'home_top', targetRoute: 'news', isActive: true, orderIndex: 1 },
    { title: 'کارگاه مهارت‌آموزی نپا', imageUrl: '/uploads/banner1.jpg', position: 'home_top', targetRoute: 'lms', isActive: true, orderIndex: 2 },
    { title: 'چالش‌های ویژه منزلگاه', imageUrl: '/uploads/banner1.jpg', position: 'home_top', targetRoute: 'challenges', isActive: true, orderIndex: 3 },
    { title: 'بازارچه زرین نوپا', imageUrl: '/uploads/banner1.jpg', position: 'bazaar_top', targetRoute: 'bazaar', isActive: true, orderIndex: 1 },
    { title: 'تبدیل دارایی‌های کاروان', imageUrl: '/uploads/banner1.jpg', position: 'bazaar_top', targetRoute: 'bazaar', isActive: true, orderIndex: 2 },
    { title: 'معرفی دوره‌ها و منزلگاه‌های آموزشی', imageUrl: '/uploads/banner1.jpg', position: 'general', targetRoute: 'lms', isActive: true, orderIndex: 1 },
  ];
  for (const b of banners) {
    await prisma.banner.create({ data: b });
  }

  // 2. Seed News
  const news = [
    { title: 'آغاز مرحله ارزیابی کاروانها', body: 'مرحله اول ارزیابی کاروانها با حضور راهبران آغاز شد.', category: 'اطلاعیه', reporter: 'روابط عمومی', targetAudience: 'ALL', isPublished: true },
    { title: 'جوایز جدید بازارچه زرین', body: 'جوایز نفیس جدید در فروشگاه زریک اضافه گردید.', category: 'رویداد', reporter: 'واحد مالی', targetAudience: 'ALL', isPublished: true },
    { title: 'شروع دوره جدید کاروان نخبگان', body: 'ثبت‌نام دوره جدید آموزش‌های تخصصی و مهارتی کاروان‌ها باز شد.', category: 'آموزش', reporter: 'واحد آموزش', targetAudience: 'STUDENT', isPublished: true }
  ];
  for (const n of news) {
    await prisma.newsArticle.create({ data: n });
  }
  console.log('✅ Banners and News seeded successfully into DB!');
}
seed().finally(() => (prisma as any).$disconnect());

