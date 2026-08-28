import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const normalizePhone = (phone: any) => {
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

async function main() {
  console.log('Loading Excel file...');
  const filePath = require('path').resolve(process.cwd(), 'شیت دوم.xlsx');
  const wb2 = XLSX.readFile(filePath);
  
  const passwordHash = await bcrypt.hash('123456', 10);

  // 1. Mentors
  console.log('Seeding Mentors...');
  const sheet04 = XLSX.utils.sheet_to_json<any>(wb2.Sheets['04'], { header: 1 });
  const mentorIdMap: Record<string, string> = {}; // sheet ID -> db ID
  for (let i = 1; i < sheet04.length; i++) {
    const row = sheet04[i];
    if (!row || !row[0]) continue;
    const phone = normalizePhone(row[3]);
    let mentor = await prisma.user.findFirst({ where: { phoneNumber: phone } });
    if (!mentor) {
      mentor = await prisma.user.create({
        data: {
          name: row[1],
          phoneNumber: phone,
          role: 'mentor',
          passwordHash,
          city: row[7],
          bio: row[8],
          academicDegree: row[2],
          identityVerified: true
        }
      });
    } else {
      mentor = await prisma.user.update({
        where: { id: mentor.id },
        data: { role: 'mentor', passwordHash, name: row[1] }
      });
    }
    mentorIdMap[row[0]] = mentor.id; // MNT103 -> db ID
  }

  // 2. Caravans
  console.log('Seeding Caravans...');
  const sheet02 = XLSX.utils.sheet_to_json<any>(wb2.Sheets['02'], { header: 1 });
  // To link correctly, we see Sheet 01 has mapping between group and mentor.
  const sheet01 = XLSX.utils.sheet_to_json<any>(wb2.Sheets['01'], { header: 1 });
  const groupToMentorSheetId: Record<string, string> = {};
  for (let i = 1; i < sheet01.length; i++) {
    const row = sheet01[i];
    if (row[5] && row[7]) {
      groupToMentorSheetId[row[5]] = row[7]; // G3 -> MNT103
    }
  }

  const caravanIdMap: Record<string, string> = {}; // G3 -> db ID
  const uniqueCaravans = Array.from(new Set(sheet02.slice(1).map(r => r[0]).filter(Boolean)));
  for (const groupId of uniqueCaravans) {
    const row = sheet02.find(r => r[0] === groupId);
    const mentorSheetId = groupToMentorSheetId[groupId];
    const mentorDbId = mentorIdMap[mentorSheetId];
    
    let caravan = await prisma.caravan.findFirst({ where: { name: row[1] } });
    if (!caravan) {
      caravan = await prisma.caravan.create({
        data: {
          name: row[1],
          mentorId: mentorDbId || null,
        }
      });
    } else {
      caravan = await prisma.caravan.update({
        where: { id: caravan.id },
        data: { mentorId: mentorDbId || null }
      });
    }
    caravanIdMap[groupId] = caravan.id;
  }

  // 3. Admin and Students
  console.log('Seeding Admin & Students...');
  for (let i = 1; i < sheet01.length; i++) {
    const row = sheet01[i];
    if (!row || !row[0]) continue;
    const phone = normalizePhone(row[10]);
    const role = row[4] === 'مدیر' ? 'admin' : (row[4] === 'دانش‌آموز' ? 'student' : 'student');
    const caravanDbId = caravanIdMap[row[5]] || null;
    
    let user = await prisma.user.findFirst({ where: { phoneNumber: phone } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: row[1],
          phoneNumber: phone,
          role: role,
          passwordHash,
          caravanId: caravanDbId,
          identityVerified: true
        }
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role, caravanId: caravanDbId, name: row[1], passwordHash }
      });
    }
  }

  // Assets (Sheet 06)
  const sheet06 = XLSX.utils.sheet_to_json<any>(wb2.Sheets['06'], { header: 1 });
  // Map users back to set assets
  for (let i = 1; i < sheet06.length; i++) {
    const row = sheet06[i];
    if (!row || !row[0]) continue;
    // Find user by name to update assets since sheet 06 has no phone
    const name = row[1];
    if (!name) continue;
    const users = await prisma.user.findMany({ where: { name } });
    if (users.length > 0) {
      await prisma.user.update({
        where: { id: users[0].id },
        data: {
          zarikBalance: parseInt(row[2]) || 0,
          nakh: parseInt(row[3]) || 0,
          beyragh: (parseInt(row[4]) || 0) + (parseInt(row[5]) || 0) + (parseInt(row[6]) || 0) + (parseInt(row[7]) || 0),
          farsh: parseInt(row[8]) || 0
        }
      });
    }
  }

  // 4. Stations, Classes, Clips, Quizzes
  console.log('Seeding LMS (Stations)...');
  const sheet03 = XLSX.utils.sheet_to_json<any>(wb2.Sheets['03 '], { header: 1 });
  // Wait, sheet name might be '03 ' or '03'. Looking at output it was '03 '.
  // Let's find it dynamically
  const sheet03Name = wb2.SheetNames.find(s => s.trim() === '03');
  if (sheet03Name) {
    const s03 = XLSX.utils.sheet_to_json<any>(wb2.Sheets[sheet03Name], { header: 1 });
    
    // Group by station
    for (let i = 1; i < s03.length; i++) {
      const row = s03[i];
      if (!row || !row[0]) continue; // MZ1
      const stationSheetId = row[0];
      const stationName = row[2];
      
      let station = await prisma.station.findFirst({ where: { title: stationName } });
      if (!station) {
        station = await prisma.station.create({ data: { title: stationName, orderIndex: parseInt(row[1]) || 1 } });
      }

      const categoryName = row[3] || 'رسانه‌ای';
      let category = await prisma.classCategory.findFirst({ where: { title: categoryName, stationId: station.id } });
      if (!category) {
        category = await prisma.classCategory.create({ data: { title: categoryName, stationId: station.id } });
      }

      const sessionName = row[5];
      let session = await prisma.classSession.findFirst({ where: { title: sessionName, categoryId: category.id } });
      if (!session) {
        session = await prisma.classSession.create({
          data: {
            title: sessionName,
            categoryId: category.id,
            instructor: row[6],
            description: row[8],
            videoUrl: 'https://www.aparat.com/v/fye6j10'
          }
        });
      }

      // Clip
      const clipName = row[10];
      if (clipName) {
        let clip = await prisma.videoClip.findFirst({ where: { title: clipName, sessionId: session.id } });
        if (!clip) {
          await prisma.videoClip.create({
            data: {
              title: clipName,
              sessionId: session.id,
              videoUrl: 'https://www.aparat.com/v/fye6j10',
              clipOrder: parseInt(row[9]) || 1,
              duration: parseInt(row[11]) || 15
            }
          });
        }
      }

      // Quiz
      const question = row[17];
      if (question && question !== '-') {
        let quiz = await prisma.quiz.findFirst({ where: { title: 'آزمون: ' + session.title, sessionId: session.id } });
        const qJson = JSON.stringify([{
          questionText: question,
          options: [row[18], row[19], row[20], row[21]],
          correctOption: row[22] // e.g., 'ب'
        }]);
        if (!quiz) {
          await prisma.quiz.create({
            data: {
              title: 'آزمون: ' + session.title,
              sessionId: session.id,
              type: 'MULTIPLE_CHOICE',
              questionsJson: qJson
            }
          });
        } else {
          await prisma.quiz.update({
            where: { id: quiz.id },
            data: { questionsJson: qJson }
          });
        }
      }
    }
  }

  // 5. Challenges
  console.log('Seeding Challenges...');
  const sheet05Name = wb2.SheetNames.find(s => s.trim() === '05');
  if (sheet05Name) {
    const s05 = XLSX.utils.sheet_to_json<any>(wb2.Sheets[sheet05Name], { header: 1 });
    for (let i = 1; i < s05.length; i++) {
      const row = s05[i];
      if (!row || !row[0]) continue;
      const mentorSheetId = row[1];
      const mentorDbId = mentorIdMap[mentorSheetId];
      if (!mentorDbId) {
        // Find by name if possible? Let's just grab the first mentor if not found
        const firstMentor = await prisma.user.findFirst({ where: { role: 'mentor' } });
        if (!firstMentor) continue;
      }
      const actualMentorId = mentorDbId || (await prisma.user.findFirst({ where: { role: 'mentor' } }))!.id;

      let challenge = await prisma.challenge.findFirst({ where: { title: row[4] } });
      const qJson = JSON.stringify([{
        text: row[6],
        opts: [row[7], row[8], row[9], row[10]],
        correct: row[11]
      }]);
      if (!challenge) {
        await prisma.challenge.create({
          data: {
            title: row[4] || 'چالش',
            description: row[6] || '',
            type: row[5] === 'چهارگزینه‌ای' ? 'quiz' : 'skill',
            createdByMentorId: actualMentorId,
            questions: qJson
          }
        });
      }
    }
  }

  console.log('Seeding complete!');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
