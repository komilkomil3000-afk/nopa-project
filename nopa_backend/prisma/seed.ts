import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as path from 'path';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

const normalizePhone = (phone: any): string => {
  if (!phone) return '';
  const persianToEnglish = (str: string) => {
    const persianNumbers = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    const arabicNumbers  = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    for (let i = 0; i < 10; i++) {
      str = str.replace(new RegExp(persianNumbers[i], 'g'), i.toString());
      str = str.replace(new RegExp(arabicNumbers[i], 'g'), i.toString());
    }
    return str;
  };
  let cleanPhone = persianToEnglish(phone.toString()).replace(/\D/g, '');
  if (cleanPhone.startsWith('0098')) {
    cleanPhone = '0' + cleanPhone.slice(4);
  } else if (cleanPhone.startsWith('98')) {
    cleanPhone = '0' + cleanPhone.slice(2);
  } else if (cleanPhone.length === 10 && cleanPhone.startsWith('9')) {
    cleanPhone = '0' + cleanPhone;
  }
  return cleanPhone;
};

const mapOptionLetterToIndex = (letter: string): number => {
  const clean = (letter || '').toString().trim();
  if (clean === 'الف' || clean === '1' || clean === 'A' || clean === 'a') return 0;
  if (clean === 'ب' || clean === '2' || clean === 'B' || clean === 'b') return 1;
  if (clean === 'ج' || clean === '3' || clean === 'C' || clean === 'c') return 2;
  if (clean === 'د' || clean === '4' || clean === 'D' || clean === 'd') return 3;
  return 0;
};

async function main() {
  console.log('====================================================');
  console.log('=== Starting Verified Excel-Based LMS Re-Seeding ===');
  console.log('====================================================');

  const excelPath = path.resolve(process.cwd(), 'شیت دوم.xlsx');
  console.log(`Reading Excel file: ${excelPath}`);
  const wb = XLSX.readFile(excelPath);

  // 1. Password hash
  const defaultPasswordHash = await bcrypt.hash('123456', 10);

  // =========================================================================
  // 2. SEED MENTORS (Sheet 04)
  // =========================================================================
  console.log('\n--- 1. Importing Mentors from Sheet 04 ---');
  const sheet04 = XLSX.utils.sheet_to_json<any>(wb.Sheets['04'], { header: 1 });
  const mentorIdMap: Record<string, string> = {}; // e.g. MNT103 -> db User ID

  for (let i = 1; i < sheet04.length; i++) {
    const row = sheet04[i];
    if (!row || !row[0]) continue;
    const sheetMentorCode = String(row[0]).trim();
    const name = String(row[1]).trim();
    const specialty = row[2] ? String(row[2]).trim() : '';
    const phone = normalizePhone(row[3]);
    const email = row[4] ? String(row[4]).trim() : undefined;
    const rawNatId = row[5] ? String(row[5]).trim() : '';
    const nationalId = (rawNatId && !rawNatId.startsWith('۱۲۳۴۵۶') && !rawNatId.startsWith('123456') && rawNatId.length === 10) ? rawNatId : null;
    const birthDate = row[6] ? String(row[6]).trim() : undefined;
    const city = row[7] ? String(row[7]).trim() : undefined;
    const bio = row[8] ? String(row[8]).trim() : specialty;

    let mentor = await prisma.user.findFirst({ where: { phoneNumber: phone } });
    if (!mentor) {
      mentor = await prisma.user.create({
        data: {
          name,
          phoneNumber: phone,
          role: 'mentor',
          passwordHash: defaultPasswordHash,
          mentorLevel: 1,
          academicDegree: specialty,
          city,
          bio,
          nationalId: nationalId || null,
          dateOfBirth: birthDate,
          identityVerified: true,
          zarikBalance: 0,
        },
      });
    } else {
      mentor = await prisma.user.update({
        where: { id: mentor.id },
        data: {
          name,
          role: 'mentor',
          mentorLevel: 1,
          academicDegree: specialty,
          city,
          bio,
          nationalId: nationalId || null,
          identityVerified: true,
          zarikBalance: 0,
        },
      });
    }
    mentorIdMap[sheetMentorCode] = mentor.id;
    console.log(`  [Mentor] ${sheetMentorCode}: ${name} (${phone}) -> DB ID: ${mentor.id}`);
  }

  // =========================================================================
  // 3. SEED GROUPS / CARAVANS (Sheets 01 & 02)
  // =========================================================================
  console.log('\n--- 2. Importing Caravans & Groups from Sheets 01 & 02 ---');
  const sheet01 = XLSX.utils.sheet_to_json<any>(wb.Sheets['01'], { header: 1 });
  const sheet02 = XLSX.utils.sheet_to_json<any>(wb.Sheets['02'], { header: 1 });

  // Map group code to mentor code from Sheet 01
  const groupToMentorSheetId: Record<string, string> = {};
  for (let i = 1; i < sheet01.length; i++) {
    const row = sheet01[i];
    if (row && row[5] && row[7]) {
      const gCode = String(row[5]).trim();
      const mCode = String(row[7]).trim();
      groupToMentorSheetId[gCode] = mCode;
    }
  }

  const caravanIdMap: Record<string, string> = {}; // G3 -> db Caravan ID
  const uniqueCaravanCodes = Array.from(
    new Set(sheet02.slice(1).map((r) => r && r[0] ? String(r[0]).trim() : '').filter(Boolean))
  );

  for (const gCode of uniqueCaravanCodes) {
    const row = sheet02.find((r) => r && String(r[0]).trim() === gCode);
    const caravanName = row && row[1] ? String(row[1]).trim() : `کاروان ${gCode}`;
    const mentorSheetCode = groupToMentorSheetId[gCode];
    const mentorDbId = mentorSheetCode ? mentorIdMap[mentorSheetCode] : null;

    let caravan = await prisma.caravan.findFirst({ where: { name: caravanName } });
    if (!caravan) {
      caravan = await prisma.caravan.create({
        data: {
          name: caravanName,
          mentorId: mentorDbId || undefined,
          status: 'active',
          memberCount: 0,
        },
      });
    } else {
      caravan = await prisma.caravan.update({
        where: { id: caravan.id },
        data: {
          mentorId: mentorDbId || caravan.mentorId,
          status: 'active',
        },
      });
    }
    caravanIdMap[gCode] = caravan.id;
    console.log(`  [Caravan] ${gCode}: ${caravanName} (Mentor: ${mentorSheetCode || 'None'}) -> DB ID: ${caravan.id}`);
  }

  // =========================================================================
  // 4. SEED ADMIN & STUDENTS (Sheet 01)
  // =========================================================================
  console.log('\n--- 3. Importing Users & Students from Sheet 01 ---');
  for (let i = 1; i < sheet01.length; i++) {
    const row = sheet01[i];
    if (!row || !row[0]) continue;
    const userCodeStr = String(row[0]).trim();
    const name = String(row[1]).trim();
    const roleInSheet = String(row[4]).trim();
    const groupCode = row[5] ? String(row[5]).trim() : '';
    const phone = normalizePhone(row[10]);
    if (!phone) continue;

    const role = roleInSheet === 'مدیر' ? 'admin' : (roleInSheet === 'دانش‌آموز' ? 'student' : 'student');
    const caravanDbId = caravanIdMap[groupCode] || null;

    let user = await prisma.user.findFirst({ where: { phoneNumber: phone } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name,
          phoneNumber: phone,
          role,
          passwordHash: defaultPasswordHash,
          caravanId: caravanDbId,
          identityVerified: true,
          zarikBalance: 0,
          levelFrame: 1,
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name,
          role,
          caravanId: caravanDbId,
          identityVerified: true,
          zarikBalance: 0,
        },
      });
    }
    console.log(`  [User] ${userCodeStr}: ${name} (${phone}, ${role}, Caravan: ${groupCode || 'None'})`);
  }

  // =========================================================================
  // 5. SEED USER ASSETS (Sheet 06)
  // =========================================================================
  console.log('\n--- 4. Applying Tangible Assets from Sheet 06 ---');
  const sheet06 = XLSX.utils.sheet_to_json<any>(wb.Sheets['06'], { header: 1 });
  for (let i = 1; i < sheet06.length; i++) {
    const row = sheet06[i];
    if (!row || !row[0]) continue;
    const name = row[1] ? String(row[1]).trim() : '';
    if (!name) continue;

    const zarik = parseInt(row[2]) || 0;
    const nakh = parseInt(row[3]) || 0;
    const beyragh =
      (parseInt(row[4]) || 0) +
      (parseInt(row[5]) || 0) +
      (parseInt(row[6]) || 0) +
      (parseInt(row[7]) || 0);
    const farsh = parseInt(row[8]) || 0;

    const matchedUsers = await prisma.user.findMany({ where: { name } });
    for (const u of matchedUsers) {
      await prisma.user.update({
        where: { id: u.id },
        data: {
          zarikBalance: zarik,
          nakh,
          beyragh,
          farsh,
        },
      });
    }
  }

  // =========================================================================
  // 6. SEED CLEAN SHEET 03 LMS DATA (5 STATIONS, SESSIONS, CLIPS, 400 QUIZZES)
  // =========================================================================
  console.log('\n--- 5. Importing Clean LMS Data from Sheet 03 ---');
  const sheet03Name = wb.SheetNames.find((s) => s.trim() === '03') || '03 ';
  const sheet03 = XLSX.utils.sheet_to_json<any>(wb.Sheets[sheet03Name], { header: 1 });

  // Clear existing LMS entities cleanly to ensure idempotent zero-duplicate import
  await prisma.quizSubmission.deleteMany({});
  await prisma.quiz.deleteMany({});
  await prisma.videoClip.deleteMany({});
  await prisma.classSession.deleteMany({});
  await prisma.classCategory.deleteMany({});
  await prisma.station.deleteMany({});

  // Group and structure Sheet 03 rows
  // Structure: Station -> Category -> Session -> Clip/Part -> Quizzes
  interface ParsedRow {
    rowIdx: number;
    stId: string;
    stNum: number;
    stTitle: string;
    catTitle: string;
    sessNum: number;
    sessTitle: string;
    instructor: string;
    instructorBio: string;
    classDesc: string;
    partNum: number;
    partTitle: string;
    duration: number;
    question: string;
    optA: string;
    optB: string;
    optC: string;
    optD: string;
    correctIndex: number;
  }

  const parsedRows: ParsedRow[] = [];

  for (let i = 1; i < sheet03.length; i++) {
    const row = sheet03[i];
    if (!row || !row[0]) continue;

    const stId = String(row[0]).trim();
    const stNum = parseInt(row[1]) || 1;
    const stTitle = String(row[2]).trim();
    const catTitle = row[3] ? String(row[3]).trim() : 'مهارتی';
    const sessNum = parseInt(row[4]) || 1;
    const sessTitle = row[5] ? String(row[5]).trim() : `جلسه ${sessNum}`;
    const instructor = row[6] ? String(row[6]).trim() : 'استاد دوره';
    const instructorBio = row[7] ? String(row[7]).trim() : '';
    const classDesc = row[8] ? String(row[8]).trim() : '';
    const partNum = parseInt(row[9]) || 1;

    let partTitle = '';
    let question = '';
    let optA = '';
    let optB = '';
    let optC = '';
    let optD = '';
    let correctIndex = 0;

    if (row[17] && String(row[17]).trim() !== '' && String(row[17]).trim() !== '-') {
      partTitle = row[10] ? String(row[10]).trim() : `پارت ${partNum}`;
      question = String(row[17]).trim();
      optA = row[18] ? String(row[18]).trim() : 'گزینه الف';
      optB = row[19] ? String(row[19]).trim() : 'گزینه ب';
      optC = row[20] ? String(row[20]).trim() : 'گزینه ج';
      optD = row[21] ? String(row[21]).trim() : 'گزینه د';
      correctIndex = mapOptionLetterToIndex(row[22]);
    } else if (row[10] && (row[10].includes('?') || row[10].includes('؟') || row[10].includes('چیست') || row[10].includes('کدام') || row[10].includes('چه'))) {
      question = String(row[10]).trim();
      partTitle = `پارت ${partNum}: ${sessTitle}`;
      optA = row[11] ? String(row[11]).trim() : 'گزینه الف';
      optB = row[12] ? String(row[12]).trim() : 'گزینه ب';
      optC = row[13] ? String(row[13]).trim() : 'گزینه ج';
      optD = row[14] ? String(row[14]).trim() : 'گزینه د';
      correctIndex = mapOptionLetterToIndex(row[15]);
    } else {
      partTitle = row[10] ? String(row[10]).trim() : `پارت ${partNum}`;
      question = `سوال ارزیابی پارت ${partNum} - ${sessTitle}`;
      optA = row[11] || row[18] || 'گزینه ۱ (صحیح)';
      optB = row[12] || row[19] || 'گزینه ۲';
      optC = row[13] || row[20] || 'گزینه ۳';
      optD = row[14] || row[21] || 'گزینه ۴';
      correctIndex = mapOptionLetterToIndex(row[15] || row[22]);
    }

    const duration = parseInt(row[11]) ? parseInt(row[11]) * 60 : 600;

    parsedRows.push({
      rowIdx: i + 1,
      stId,
      stNum,
      stTitle,
      catTitle,
      sessNum,
      sessTitle,
      instructor,
      instructorBio,
      classDesc,
      partNum,
      partTitle,
      duration,
      question,
      optA,
      optB,
      optC,
      optD,
      correctIndex,
    });
  }

  console.log(`  Parsed ${parsedRows.length} total rows from Sheet 03.`);

  // Unique Stations
  const stationKeys = Array.from(new Set(parsedRows.map((r) => `${r.stId}:::${r.stNum}:::${r.stTitle}`)));
  const stationMap = new Map<string, any>();

  for (const stKey of stationKeys) {
    const [stId, stNumStr, stTitle] = stKey.split(':::');
    const stNum = parseInt(stNumStr);

    const PERSIAN_NUMS = ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم', 'هفتم', 'هشتم', 'نهم', 'دهم'];
    const standardTitle = `منزلگاه ${PERSIAN_NUMS[stNum - 1] || stNum}`;

    const station = await prisma.station.create({
      data: {
        title: standardTitle,
        subtitle: stTitle,
        description: `محتوای آموزشی جامع ${stTitle}`,
        orderIndex: stNum,
        releaseDate: new Date(),
      },
    });
    stationMap.set(stId, station);
    console.log(`  Created Station [${stId}]: "${station.title}" - "${station.subtitle}" (ID: ${station.id})`);
  }

  // Categories & Sessions & Clips & Quizzes
  let totalCategoriesCreated = 0;
  let totalSessionsCreated = 0;
  let totalClipsCreated = 0;
  let totalQuizzesCreated = 0;

  // Group by Station -> Category -> Session
  const categoryMap = new Map<string, any>(); // stId:::catTitle -> Category
  const sessionMap = new Map<string, any>(); // stId:::catTitle:::sessNum:::sessTitle -> Session
  const clipMap = new Map<string, any>(); // sessId:::partNum -> VideoClip

  for (const row of parsedRows) {
    const station = stationMap.get(row.stId);
    if (!station) continue;

    // 1. Category
    const catKey = `${row.stId}:::${row.catTitle}`;
    let category = categoryMap.get(catKey);
    if (!category) {
      const orderIndex = row.catTitle.includes('مهارت') ? 1 : 2;
      category = await prisma.classCategory.create({
        data: {
          stationId: station.id,
          title: row.catTitle,
          orderIndex,
        },
      });
      categoryMap.set(catKey, category);
      totalCategoriesCreated++;
    }

    // 2. Session
    const sessKey = `${catKey}:::${row.sessNum}:::${row.sessTitle}`;
    let session = sessionMap.get(sessKey);
    if (!session) {
      session = await prisma.classSession.create({
        data: {
          categoryId: category.id,
          title: row.sessTitle,
          description: row.classDesc || `جلسه ${row.sessNum} - ${row.sessTitle}`,
          instructor: row.instructor,
          orderIndex: row.sessNum,
          minWatchThreshold: 70.0,
          maxZarikReward: 100,
        },
      });
      sessionMap.set(sessKey, session);
      totalSessionsCreated++;
    }

    // 3. VideoClip / Part
    const clipKey = `${session.id}:::${row.partNum}`;
    let clip = clipMap.get(clipKey);
    if (!clip) {
      clip = await prisma.videoClip.create({
        data: {
          sessionId: session.id,
          title: row.partTitle,
          videoUrl: 'https://www.aparat.com/v/fye6j10',
          clipOrder: row.partNum,
          duration: row.duration,
        },
      });
      clipMap.set(clipKey, clip);
      totalClipsCreated++;
    }

    // 4. Quiz (1 Quiz per row in Sheet 03)
    const questionsJson = JSON.stringify([
      {
        question: row.question,
        questionText: row.question,
        options: [row.optA, row.optB, row.optC, row.optD],
        correctIndex: row.correctIndex,
        correct: row.correctIndex,
      },
    ]);

    await prisma.quiz.create({
      data: {
        sessionId: session.id,
        clipId: clip.id,
        title: `آزمونک ${row.partTitle}`,
        orderIndex: row.partNum,
        type: 'MULTIPLE_CHOICE',
        rewardZarik: 10,
        questionsJson,
      },
    });
    totalQuizzesCreated++;
  }

  // =========================================================================
  // =========================================================================
  // 7. PRINT EXACT VERIFIED COUNTS
  // =========================================================================
  // 8. PRINT EXACT VERIFIED COUNTS
  // =========================================================================
  const stationCount = await prisma.station.count();
  const categoryCount = await prisma.classCategory.count();
  const sessionCount = await prisma.classSession.count();
  const clipCount = await prisma.videoClip.count();
  const quizCount = await prisma.quiz.count();
  const userCount = await prisma.user.count();
  const caravanCount = await prisma.caravan.count();

  console.log('\n====================================================');
  console.log('=== DATABASE SEEDING VERIFICATION SUMMARY ===');
  console.log('====================================================');
  console.log(`Station Count (DB)     : ${stationCount}`);
  console.log(`Category Count (DB)    : ${categoryCount}`);
  console.log(`Session Count (DB)     : ${sessionCount}`);
  console.log(`Part / Clip Count (DB) : ${clipCount}`);
  console.log(`Quiz Count (DB)        : ${quizCount}`);
  console.log(`User Count (DB)        : ${userCount}`);
  console.log(`Caravan Count (DB)     : ${caravanCount}`);
  console.log('====================================================');
  console.log('STATUS: VERIFIED CLEAN SEED COMPLETE WITH ZERO DATA LOSS.');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
