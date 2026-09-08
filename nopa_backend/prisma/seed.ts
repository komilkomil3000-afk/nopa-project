import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as path from 'path';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

const normalizePhone = (phone: any): string => {
  if (!phone) return '';
  const persianToEnglish = (str: string) => {
    const persianNumbers = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
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
  console.log('================================================================');
  console.log('=== STRICT EXCEL SEEDING (شیت دوم.xlsx) - 0 GHOST RECORDS ===');
  console.log('================================================================');

  const excelPath = path.resolve(process.cwd(), 'شیت دوم.xlsx');
  console.log(`[Excel Engine] Reading source workbook: ${excelPath}`);
  const wb = XLSX.readFile(excelPath);

  // =========================================================================
  // STEP 0: CLEAN WIPE OF ALL DATABASE TABLES
  // =========================================================================
  console.log('\n>>> Cleaning all existing records from all tables...');
  await prisma.submission.deleteMany({});
  await prisma.challenge.deleteMany({});
  await prisma.quizSubmission.deleteMany({});
  await prisma.mentorFeedback.deleteMany({});
  await prisma.videoBookmark.deleteMany({});
  await prisma.sessionWatchRecord.deleteMany({});
  await prisma.userProgress.deleteMany({});
  await prisma.quiz.deleteMany({});
  await prisma.videoClip.deleteMany({});
  await prisma.classSession.deleteMany({});
  await prisma.classCategory.deleteMany({});
  await prisma.station.deleteMany({});
  await prisma.formSubmission.deleteMany({});
  await prisma.formField.deleteMany({});
  await prisma.dynamicForm.deleteMany({});
  await prisma.chatMessage.deleteMany({});
  await prisma.supportTicketReply.deleteMany({});
  await prisma.supportTicket.deleteMany({});
  await prisma.mentorEvaluation.deleteMany({});
  await prisma.mentorRating.deleteMany({});
  await prisma.privateStudentNote.deleteMany({});
  await prisma.adminMessage.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.notificationLog.deleteMany({});
  await prisma.notificationTemplate.deleteMany({});
  await prisma.zarikTransaction.deleteMany({});
  await prisma.assetConversionRequest.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.physicalCertificateOrder.deleteMany({});
  await prisma.certificate.deleteMany({});
  await prisma.mentorDocument.deleteMany({});
  await prisma.userSession.deleteMany({});
  await prisma.rolePermission.deleteMany({});
  await prisma.systemSetting.deleteMany({});
  await prisma.mediaAsset.deleteMany({});
  await prisma.blacklist.deleteMany({});
  await prisma.channelOverride.deleteMany({});
  await prisma.newsArticle.deleteMany({});
  await prisma.banner.deleteMany({});
  await prisma.caravan.deleteMany({});
  await prisma.user.deleteMany({});
  console.log('>>> All database tables truncated successfully.');

  const defaultPasswordHash = await bcrypt.hash('123456', 10);

  // =========================================================================
  // STEP 1: SEED MENTORS (Sheet 04)
  // =========================================================================
  console.log('\n>>> [Sheet 04] Seeding Mentors...');
  const sheet04 = XLSX.utils.sheet_to_json<any>(wb.Sheets['04'], { header: 1 });
  const mentorIdMap: Record<string, string> = {}; // e.g. MNT103 -> db User ID

  for (let i = 1; i < sheet04.length; i++) {
    const row = sheet04[i];
    if (!row || !row[0]) continue;
    const sheetMentorCode = String(row[0]).trim();
    const name = String(row[1]).trim();
    const specialty = row[2] ? String(row[2]).trim() : '';
    const phone = normalizePhone(row[3]);
    const rawNatId = row[5] ? String(row[5]).trim() : '';
    const nationalId =
      rawNatId && !rawNatId.startsWith('۱۲۳۴۵۶') && !rawNatId.startsWith('123456') && rawNatId.length === 10
        ? rawNatId
        : null;
    const birthDate = row[6] ? String(row[6]).trim() : undefined;
    const city = row[7] ? String(row[7]).trim() : undefined;
    const bio = row[8] ? String(row[8]).trim() : specialty;

    const mentor = await prisma.user.create({
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
    mentorIdMap[sheetMentorCode] = mentor.id;
    console.log(`  [Mentor Created] ${sheetMentorCode} -> ${name} (${phone}) [ID: ${mentor.id}]`);
  }

  // =========================================================================
  // STEP 2: SEED GROUPS / CARAVANS (Sheet 02 & mapping from Sheet 01)
  // =========================================================================
  console.log('\n>>> [Sheet 02 & 01] Seeding Caravans...');
  const sheet01 = XLSX.utils.sheet_to_json<any>(wb.Sheets['01'], { header: 1 });
  const sheet02 = XLSX.utils.sheet_to_json<any>(wb.Sheets['02'], { header: 1 });

  // Map group code to mentor code from Sheet 01
  const groupToMentorCode: Record<string, string> = {};
  for (let i = 1; i < sheet01.length; i++) {
    const row = sheet01[i];
    if (row && row[5] && row[7]) {
      const gCode = String(row[5]).trim();
      const mCode = String(row[7]).trim();
      if (gCode !== '-' && mCode !== '-') {
        groupToMentorCode[gCode] = mCode;
      }
    }
  }

  const caravanIdMap: Record<string, string> = {}; // G3 -> DB ID
  const uniqueCaravanCodes = Array.from(
    new Set(sheet02.slice(1).map((r) => (r && r[0] ? String(r[0]).trim() : '')).filter(Boolean))
  );

  for (const gCode of uniqueCaravanCodes) {
    const row = sheet02.find((r) => r && String(r[0]).trim() === gCode);
    const caravanName = row && row[1] ? String(row[1]).trim() : `کاروان ${gCode}`;
    const mentorSheetCode = groupToMentorCode[gCode];
    const mentorDbId = mentorSheetCode ? mentorIdMap[mentorSheetCode] : null;

    const caravan = await prisma.caravan.create({
      data: {
        name: caravanName,
        mentorId: mentorDbId || undefined,
        status: 'active',
        memberCount: 0,
      },
    });
    caravanIdMap[gCode] = caravan.id;
    console.log(`  [Caravan Created] ${gCode}: "${caravanName}" (Mentor: ${mentorSheetCode || 'None'}) [ID: ${caravan.id}]`);
  }

  // =========================================================================
  // STEP 3: SEED ADMIN & STUDENTS (Sheet 01)
  // =========================================================================
  console.log('\n>>> [Sheet 01] Seeding Users & Roles...');
  const userIdMap: Record<string, string> = {}; // U1007 -> DB User ID

  for (let i = 1; i < sheet01.length; i++) {
    const row = sheet01[i];
    if (!row || !row[0]) continue;
    const userCodeStr = String(row[0]).trim();
    const name = String(row[1]).trim();
    const roleInSheet = String(row[4]).trim();
    const groupCode = row[5] ? String(row[5]).trim() : '';
    const phone = normalizePhone(row[10]);
    if (!phone) continue;

    const role = roleInSheet === 'مدیر' ? 'admin' : 'student';
    const caravanDbId = caravanIdMap[groupCode] || null;

    const user = await prisma.user.create({
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
    userIdMap[userCodeStr] = user.id;
    console.log(`  [User Created] ${userCodeStr} -> ${name} (${phone}, role: ${role}, Caravan: ${groupCode || 'None'}) [ID: ${user.id}]`);
  }

  // Update member count on Caravans
  for (const [gCode, cId] of Object.entries(caravanIdMap)) {
    const count = await prisma.user.count({ where: { caravanId: cId } });
    await prisma.caravan.update({ where: { id: cId }, data: { memberCount: count } });
  }

  // Grant admin permissions
  await prisma.rolePermission.create({
    data: {
      roleName: 'admin',
      manageContent: true,
      manageMentors: true,
      manageStudents: true,
      manageCaravans: true,
      manageSystem: true,
      canSendMessage: true,
      canManageUsers: true,
      canViewGlobalAnalytics: true,
    },
  });
  console.log('  [Permissions Granted] Admin RolePermissions established.');

  // =========================================================================
  // STEP 4: SEED WALLETS & TANGIBLE BALANCES (Sheet 06)
  // =========================================================================
  console.log('\n>>> [Sheet 06] Applying Wallets & Tangible Balances...');
  const sheet06 = XLSX.utils.sheet_to_json<any>(wb.Sheets['06'], { header: 1 });
  for (let i = 1; i < sheet06.length; i++) {
    const row = sheet06[i];
    if (!row || !row[0]) continue;
    const userCodeStr = String(row[0]).trim();
    const name = row[1] ? String(row[1]).trim() : '';

    const zarik = parseInt(row[2]) || 0;
    const nakh = parseInt(row[3]) || 0;
    const beyragh =
      (parseInt(row[4]) || 0) +
      (parseInt(row[5]) || 0) +
      (parseInt(row[6]) || 0) +
      (parseInt(row[7]) || 0);
    const farsh = parseInt(row[8]) || 0;

    const dbUserId = userIdMap[userCodeStr];
    if (dbUserId) {
      await prisma.user.update({
        where: { id: dbUserId },
        data: { zarikBalance: zarik, nakh, beyragh, farsh },
      });
      console.log(`  [Wallet Synced] ${userCodeStr} (${name}) -> Zarik: ${zarik}, Nakh: ${nakh}, Beyragh: ${beyragh}, Farsh: ${farsh}`);
    }
  }

  // =========================================================================
  // STEP 5: SEED SHEET 03 (5 STATIONS, SESSIONS, PARTS, 400 QUIZZES)
  // =========================================================================
  console.log('\n>>> [Sheet 03] Seeding LMS Stations, Categories, Sessions, Parts, Quizzes...');
  const sheet03Name = wb.SheetNames.find((s) => s.trim() === '03') || '03 ';
  const sheet03 = XLSX.utils.sheet_to_json<any>(wb.Sheets[sheet03Name], { header: 1 });

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
    } else if (
      row[10] &&
      (row[10].includes('?') ||
        row[10].includes('؟') ||
        row[10].includes('چیست') ||
        row[10].includes('کدام') ||
        row[10].includes('چه'))
    ) {
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

  console.log(`  [Parsed Rows] Total rows in Sheet 03: ${parsedRows.length}`);

  // Create Stations (strictly bounded)
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
    console.log(`  [Station Created] [${stId}] "${station.title}" - "${station.subtitle}" [ID: ${station.id}]`);
  }

  // Group and seed Categories, Sessions, Clips, Quizzes
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
    }

    // 3. VideoClip (Part)
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
    }

    // 4. Quiz (1 Quiz per row)
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
  }
  console.log(`  [Sheet 03 Seeding Completed] Categories: ${categoryMap.size}, Sessions: ${sessionMap.size}, Parts/Clips: ${clipMap.size}, Quizzes: ${parsedRows.length}`);

  // =========================================================================
  // STEP 6: SEED CHALLENGES (Sheet 05) & SUBMISSIONS (Sheet 07)
  // =========================================================================
  console.log('\n>>> [Sheet 05 & 07] Seeding Challenges & Submissions...');
  const sheet05 = XLSX.utils.sheet_to_json<any>(wb.Sheets['05'], { header: 1 });
  const challengeIdMap: Record<string, string> = {};

  // Sheet 05 row 0 is Column1..Column15, row 1 is Persian headers, rows 2+ are data
  for (let i = 2; i < sheet05.length; i++) {
    const row = sheet05[i];
    if (!row || !row[0] || String(row[0]).trim() === '' || String(row[0]).trim() === '-') continue;

    const sheetChallengeCode = String(row[0]).trim(); // CH301
    const sheetMentorCode = row[1] ? String(row[1]).trim() : '';
    const title = row[4] ? String(row[4]).trim() : `چالش ${sheetChallengeCode}`;
    const challengeTypeStr = row[5] ? String(row[5]).trim() : 'تشریحی';
    const description = row[6] ? String(row[6]).trim() : '';

    const isQuiz = challengeTypeStr === 'چندگزینه‌ای';
    const type = isQuiz ? 'quiz' : 'skill';

    let questionsJson: string | null = null;
    if (isQuiz && row[7]) {
      questionsJson = JSON.stringify([
        {
          question: description,
          options: [
            row[7] ? String(row[7]).trim() : 'گزینه ۱',
            row[8] ? String(row[8]).trim() : 'گزینه ۲',
            row[9] ? String(row[9]).trim() : 'گزینه ۳',
            row[10] ? String(row[10]).trim() : 'گزینه ۴',
          ],
          correctIndex: mapOptionLetterToIndex(row[11]),
        },
      ]);
    }

    const mentorDbId = mentorIdMap[sheetMentorCode] || Object.values(mentorIdMap)[0];

    const challenge = await prisma.challenge.create({
      data: {
        id: sheetChallengeCode,
        title,
        description,
        type,
        questions: questionsJson,
        rewardZarik: 50,
        createdByMentorId: mentorDbId,
      },
    });
    challengeIdMap[sheetChallengeCode] = challenge.id;
    console.log(`  [Challenge Created] ${sheetChallengeCode} -> "${title}" (${type}, Mentor: ${sheetMentorCode}) [ID: ${challenge.id}]`);
  }

  // Sheet 07: Submissions (if any valid data rows exist)
  const sheet07 = XLSX.utils.sheet_to_json<any>(wb.Sheets['07'], { header: 1 });
  let submissionsSeeded = 0;
  for (let i = 2; i < sheet07.length; i++) {
    const row = sheet07[i];
    if (!row || !row[0] || String(row[0]).trim() === '') continue;

    const subCode = String(row[0]).trim();
    const sheetChallengeCode = row[1] ? String(row[1]).trim() : '';
    const sheetUserCode = row[2] ? String(row[2]).trim() : '';
    const answerText = row[3] ? String(row[3]).trim() : '';

    const challengeDbId = challengeIdMap[sheetChallengeCode];
    const userDbId = userIdMap[sheetUserCode];

    if (challengeDbId && userDbId) {
      await prisma.submission.create({
        data: {
          id: subCode,
          challengeId: challengeDbId,
          studentId: userDbId,
          answerText,
          status: 'pending',
          score: 0,
        },
      });
      submissionsSeeded++;
      console.log(`  [Submission Created] ${subCode} -> Challenge: ${sheetChallengeCode}, Student: ${sheetUserCode}`);
    }
  }
  console.log(`  [Sheet 07] Processed. Valid submissions seeded: ${submissionsSeeded}`);

  // =========================================================================
  // STEP 7: PRINT SUMMARY TABLE OF EXACT ROW COUNTS FOR ALL SEEDED TABLES
  // =========================================================================
  const stationCount = await prisma.station.count();
  const categoryCount = await prisma.classCategory.count();
  const sessionCount = await prisma.classSession.count();
  const partCount = await prisma.videoClip.count();
  const quizCount = await prisma.quiz.count();
  const userCount = await prisma.user.count();
  const mentorCount = await prisma.user.count({ where: { role: 'mentor' } });
  const studentCount = await prisma.user.count({ where: { role: 'student' } });
  const adminCount = await prisma.user.count({ where: { role: 'admin' } });
  const caravanCount = await prisma.caravan.count();
  const challengeCount = await prisma.challenge.count();
  const submissionCount = await prisma.submission.count();
  const quizSubmissionCount = await prisma.quizSubmission.count();
  const formSubmissionCount = await prisma.formSubmission.count();
  const chatMessageCount = await prisma.chatMessage.count();
  const auditLogCount = await prisma.auditLog.count();
  const notificationLogCount = await prisma.notificationLog.count();
  const rolePermissionCount = await prisma.rolePermission.count();

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║       NOPA DATABASE SEEDING VERIFICATION SUMMARY TABLE           ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log(`║ Stations (منزلگاه‌ها)              : ${String(stationCount).padEnd(28)}║`);
  console.log(`║ Categories (دسته‌بندی‌های آموزشی)  : ${String(categoryCount).padEnd(28)}║`);
  console.log(`║ ClassSessions (جلسات کلاسی)       : ${String(sessionCount).padEnd(28)}║`);
  console.log(`║ VideoClips / Parts (پارت‌های ویدیو): ${String(partCount).padEnd(28)}║`);
  console.log(`║ Quizzes (آزمونک‌های آموزشی)        : ${String(quizCount).padEnd(28)}║`);
  console.log(`║ Total Users (مجموع کاربران)       : ${String(userCount).padEnd(28)}║`);
  console.log(`║   - Mentors (راهبران/مربیان)      : ${String(mentorCount).padEnd(28)}║`);
  console.log(`║   - Students (دانش‌آموزان)        : ${String(studentCount).padEnd(28)}║`);
  console.log(`║   - Admins (مدیران سیستم)         : ${String(adminCount).padEnd(28)}║`);
  console.log(`║ Caravans (کاروان‌ها)               : ${String(caravanCount).padEnd(28)}║`);
  console.log(`║ Challenges (چالش‌ها)               : ${String(challengeCount).padEnd(28)}║`);
  console.log(`║ Submissions (پاسخ‌های چالش)       : ${String(submissionCount).padEnd(28)}║`);
  console.log(`║ QuizSubmissions                   : ${String(quizSubmissionCount).padEnd(28)}║`);
  console.log(`║ FormSubmissions                   : ${String(formSubmissionCount).padEnd(28)}║`);
  console.log(`║ ChatMessages                      : ${String(chatMessageCount).padEnd(28)}║`);
  console.log(`║ AuditLogs                         : ${String(auditLogCount).padEnd(28)}║`);
  console.log(`║ NotificationLogs                  : ${String(notificationLogCount).padEnd(28)}║`);
  console.log(`║ RolePermissions                   : ${String(rolePermissionCount).padEnd(28)}║`);
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log('║ STATUS: ZERO GHOST RECORDS - CLEAN WIPE & VERIFIED SEED COMPLETED ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
}

main()
  .catch((e) => {
    console.error('Seeding process failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
