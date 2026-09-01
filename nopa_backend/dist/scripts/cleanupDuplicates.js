"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function cleanupDatabase() {
    console.log('=== شروع تحلیل و پاکسازی دیتابیس از رکوردهای تکراری و اضافی ===');
    try {
        // 1. پاکسازی سشن‌های منقضی و تکراری (UserSession)
        console.log('1. بررسی و پاکسازی سشن‌های کاربری قدیمی و تکراری...');
        const duplicateSessions = await prisma.$executeRawUnsafe(`
      DELETE FROM UserSession 
      WHERE id NOT IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY userId ORDER BY createdAt DESC) as rn
          FROM UserSession
        ) WHERE rn <= 3
      );
    `);
        console.log(`✅ سشن‌های مازاد حذف شدند. تعداد: ${duplicateSessions}`);
        // 2. پاکسازی رکوردهای تکراری لاگ واچ ویدیوها (SessionWatchRecord)
        console.log('2. بررسی رکوردهای پیشرفت ویدیو (SessionWatchRecord)...');
        const duplicateWatches = await prisma.$executeRawUnsafe(`
      DELETE FROM SessionWatchRecord 
      WHERE id NOT IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY userId, sessionId ORDER BY lastWatchedAt DESC) as rn
          FROM SessionWatchRecord
        ) WHERE rn = 1
      );
    `);
        console.log(`✅ رکوردهای تکراری واچ ویدیو حذف شدند: ${duplicateWatches}`);
        // 3. پاکسازی پیشرفت‌های تکراری کاربر (UserProgress)
        console.log('3. بررسی رکوردهای پیشرفت کلی (UserProgress)...');
        const duplicateProgress = await prisma.$executeRawUnsafe(`
      DELETE FROM UserProgress 
      WHERE id NOT IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY userId, clipId ORDER BY updatedAt DESC) as rn
          FROM UserProgress
        ) WHERE rn = 1
      );
    `);
        console.log(`✅ رکوردهای تکراری پیشرفت کاربر حذف شدند: ${duplicateProgress}`);
        // 4. پاکسازی پارت‌ها/ویدیو کلیپ‌های تکراری بدون محتوا یا داپلیکیت در هر جلسه (VideoClip)
        console.log('4. بررسی و ادغام پارت‌ها و ویدیوکلیپ‌های تکراری در جلسات (VideoClip)...');
        const duplicateClips = await prisma.$executeRawUnsafe(`
      DELETE FROM VideoClip 
      WHERE id NOT IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY sessionId, clipOrder ORDER BY createdAt ASC) as rn
          FROM VideoClip
        ) WHERE rn = 1
      );
    `);
        console.log(`✅ ویدیوکلیپ‌های تکراری جلسه حذف شدند: ${duplicateClips}`);
        // 5. پاکسازی آزمونک‌های تکراری هر پارت/جلسه (Quiz)
        console.log('5. بررسی آزمونک‌های تکراری (Quiz)...');
        const duplicateQuizzes = await prisma.$executeRawUnsafe(`
      DELETE FROM Quiz 
      WHERE id NOT IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY sessionId, orderIndex ORDER BY createdAt ASC) as rn
          FROM Quiz
        ) WHERE rn = 1
      );
    `);
        console.log(`✅ آزمونک‌های تکراری حذف شدند: ${duplicateQuizzes}`);
        // 6. بهینه‌سازی و فشرده‌سازی دیتابیس (Vacuum)
        console.log('6. در حال فشرده‌سازی فایل دیتابیس (VACUUM)...');
        await prisma.$executeRawUnsafe(`VACUUM;`);
        console.log('✅ عملیات VACUUM و بهینه‌سازی دیتابیس با موفقیت پایان یافت.');
    }
    catch (error) {
        console.error('❌ خطا در حین پاکسازی دیتابیس:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
cleanupDatabase();
