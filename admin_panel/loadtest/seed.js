// Seeds the load-test sandbox with tagged, disposable data and writes the k6 fixtures to ./out/.
//   docker compose run --rm seed            (inside the sandbox; see docker-compose.yml)
// Refuses to run unless the target is a sandbox DB (see sandbox-guard.js).
//
// What it creates (all tagged LT- / phone 0900...):
//   - mentors + caravans (25 students each), students with a ready session token (no login needed)
//   - a separate pool of "login" users with a real bcrypt password, used only by the login scenario
//     (login trims each user to 15 sessions, so it must never touch the browsing users' tokens)
//   - an LMS tree (stations > categories > sessions > clips > quizzes) of realistic size
//   - per caravan: 3 open challenges, the caravan + challenges chat spaces with message history
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { LT, assertSandboxUrl, assertSandboxData } = require('./sandbox-guard');

const target = assertSandboxUrl();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const int = (name, def) => Math.max(0, Number(process.env[name] ?? def) | 0);
const STUDENTS = int('LT_STUDENTS', 600);
const LOGIN_USERS = int('LT_LOGIN_USERS', 100);
const STATIONS = int('LT_STATIONS', 8);
const MESSAGES = int('LT_CHAT_MESSAGES', 300);
const PER_CARAVAN = 25;
const LOGIN_PASSWORD = process.env.LT_LOGIN_PASSWORD || 'LtPassw0rd!';
const OUT = path.join(__dirname, 'out');

const id = () => crypto.randomUUID();
let phoneSeq = 0;
const phone = () => LT.PHONE_PREFIX + String(++phoneSeq).padStart(7, '0');

async function chunked(model, rows, size = 1000) {
  for (let i = 0; i < rows.length; i += size) await prisma[model].createMany({ data: rows.slice(i, i + size) });
}

async function main() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET (same value as the sandbox backend) is required');
  console.log(`[seed] target ${target.host}/${target.db}`);
  await assertSandboxData(prisma, { allowFresh: true });

  const existing = await prisma.$queryRaw`SELECT count(*)::int AS n FROM "User" WHERE "phoneNumber" LIKE ${LT.PHONE_PREFIX + '%'}`;
  if (existing[0].n > 0) {
    throw new Error(`${existing[0].n} sandbox users already exist: run "docker compose run --rm cleanup" first`);
  }

  // Query statistics for the bottleneck report (needs shared_preload_libraries, set in docker-compose.yml)
  try {
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS pg_stat_statements');
    await prisma.$executeRawUnsafe('SELECT pg_stat_statements_reset()');
  } catch (e) { console.warn('[seed] pg_stat_statements unavailable:', e.message); }

  // Chat on for everyone, as in production
  for (const [key, value] of [['chat_mode', 'on'], ['chat_pilot_caravans', '[]']]) {
    await prisma.systemSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }

  // ---- people ----
  const caravanCount = Math.max(1, Math.ceil((STUDENTS + LOGIN_USERS) / PER_CARAVAN));
  const mentors = [], caravans = [], students = [], loginUsers = [];
  for (let c = 0; c < caravanCount; c++) {
    const mentorId = id(), caravanId = id();
    mentors.push({ id: mentorId, phoneNumber: phone(), passwordHash: 'x', role: 'mentor', name: `${LT.NAME_PREFIX}mentor-${c + 1}`, registrationCompleted: true });
    caravans.push({ id: caravanId, name: `${LT.NAME_PREFIX}caravan-${c + 1}`, mentorId, capacityLimit: PER_CARAVAN + 10 });
  }
  const loginHash = bcrypt.hashSync(LOGIN_PASSWORD, 10); // same cost as production hashes
  for (let i = 0; i < STUDENTS + LOGIN_USERS; i++) {
    const isLogin = i >= STUDENTS;
    const row = {
      id: id(), phoneNumber: phone(), role: 'student', registrationCompleted: true,
      passwordHash: isLogin ? loginHash : 'x',
      name: `${LT.NAME_PREFIX}${isLogin ? 'login' : 'student'}-${i + 1}`,
      caravanId: caravans[i % caravanCount].id, zarikBalance: 100,
    };
    (isLogin ? loginUsers : students).push(row);
  }
  await chunked('user', mentors);
  await chunked('caravan', caravans);
  await chunked('user', [...students, ...loginUsers]);
  for (const cv of caravans) {
    const n = [...students, ...loginUsers].filter(s => s.caravanId === cv.id).length;
    await prisma.$executeRaw`UPDATE "Caravan" SET "memberCount" = ${n} WHERE id = ${cv.id}`;
  }
  console.log(`[seed] ${mentors.length} mentors, ${caravans.length} caravans, ${students.length} students, ${loginUsers.length} login users`);

  // ---- LMS tree (GET /lms/stations returns all of it) ----
  const stations = [], categories = [], sessions = [], clips = [], quizzes = [];
  const question = JSON.stringify([{ id: 'q1', text: 'LT question', options: ['a', 'b', 'c', 'd'], correctIndex: 1, correctAnswer: 'b' }]);
  for (let s = 0; s < STATIONS; s++) {
    const st = { id: id(), title: `${LT.NAME_PREFIX}station-${s + 1}`, description: 'Load-test station. '.repeat(10), orderIndex: s };
    stations.push(st);
    for (let c = 0; c < 3; c++) {
      const cat = { id: id(), stationId: st.id, title: `${LT.NAME_PREFIX}category-${s + 1}.${c + 1}`, orderIndex: c };
      categories.push(cat);
      for (let k = 0; k < 4; k++) {
        const ses = { id: id(), categoryId: cat.id, title: `${LT.NAME_PREFIX}session-${s + 1}.${c + 1}.${k + 1}`, description: 'Session description. '.repeat(5), orderIndex: k, videoUrl: 'https://example.invalid/v.mp4' };
        sessions.push(ses);
        for (let v = 0; v < 3; v++) {
          const clip = { id: id(), sessionId: ses.id, title: `${LT.NAME_PREFIX}clip-${v + 1}`, videoUrl: 'https://example.invalid/c.mp4', clipOrder: v, duration: 300 };
          clips.push(clip);
          quizzes.push({ id: id(), sessionId: ses.id, clipId: clip.id, title: `${LT.NAME_PREFIX}quiz`, questionsJson: question });
        }
      }
    }
  }
  await chunked('station', stations);
  await chunked('classCategory', categories);
  await chunked('classSession', sessions);
  await chunked('videoClip', clips);
  await chunked('quiz', quizzes);
  console.log(`[seed] LMS: ${stations.length} stations, ${sessions.length} sessions, ${clips.length} clips`);

  // ---- challenges: 3 open "skill" challenges per caravan (POST /submissions target) ----
  const challenges = [];
  caravans.forEach((cv, i) => {
    for (let k = 0; k < 3; k++) {
      challenges.push({
        id: id(), title: `${LT.NAME_PREFIX}challenge-${i + 1}.${k + 1}`, description: 'Load-test challenge', type: 'skill',
        rewardZarik: 0, category: 'intra_group', createdByMentorId: cv.mentorId, caravanId: cv.id,
        stationId: stations[0]?.id ?? null, dueDate: new Date(Date.now() + 30 * 864e5),
      });
    }
  });
  await chunked('challenge', challenges);

  // ---- chat: caravan spaces with history ----
  const spaces = [], members = [], messages = [];
  const allMembers = [...students, ...loginUsers];
  for (const cv of caravans) {
    const crew = allMembers.filter(s => s.caravanId === cv.id);
    const space = { id: id(), key: `caravan:${cv.id}`, type: 'caravan', title: 'گروه کاروان', caravanId: cv.id, lastSeq: MESSAGES };
    spaces.push(space, { id: id(), key: `challenges:${cv.id}`, type: 'challenges', title: 'گروه چالش‌ها', caravanId: cv.id, lastSeq: 0 });
    members.push({ id: id(), spaceId: space.id, userId: cv.mentorId, role: 'moderator', lastReadSeq: MESSAGES });
    for (const s of crew) members.push({ id: id(), spaceId: space.id, userId: s.id, lastReadSeq: Math.floor(MESSAGES * 0.9) });
    const start = Date.now() - MESSAGES * 60_000;
    for (let q = 1; q <= MESSAGES; q++) {
      const sender = crew.length ? crew[q % crew.length].id : cv.mentorId;
      messages.push({ id: id(), spaceId: space.id, seq: q, senderId: sender, body: `LT message ${q}: ${'lorem ipsum '.repeat(1 + (q % 6))}`, createdAt: new Date(start + q * 60_000) });
    }
  }
  await chunked('chatSpace', spaces);
  await chunked('chatMember', members);
  await chunked('chatMessage', messages);
  console.log(`[seed] chat: ${spaces.length} spaces, ${messages.length} messages`);

  // ---- sessions: what POST /auth/login would have produced, for every browsing student ----
  const caravanSpace = new Map(spaces.filter(s => s.type === 'caravan').map(s => [s.caravanId, s.id]));
  const caravanChallenges = new Map();
  for (const ch of challenges) caravanChallenges.set(ch.caravanId, [...(caravanChallenges.get(ch.caravanId) || []), ch.id]);
  const fixtures = [], sessionRows = [];
  for (const s of students) {
    const token = jwt.sign(
      { id: s.id, role: s.role, phoneNumber: s.phoneNumber, tokenVersion: 0, identityVerified: true, name: s.name, nonce: crypto.randomBytes(8).toString('hex') },
      secret, { expiresIn: '3d' });
    sessionRows.push({ id: id(), userId: s.id, token, deviceInfo: 'k6-loadtest' });
    fixtures.push({ token, space: caravanSpace.get(s.caravanId), challenges: caravanChallenges.get(s.caravanId) || [] });
  }
  await chunked('userSession', sessionRows);

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'users.json'), JSON.stringify(fixtures));
  fs.writeFileSync(path.join(OUT, 'login-users.json'), JSON.stringify(loginUsers.map(u => ({ phone: u.phoneNumber }))));
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify({ seededAt: new Date().toISOString(), target, loginPassword: LOGIN_PASSWORD, students: students.length, loginUsers: loginUsers.length, caravans: caravans.length }, null, 2));
  await prisma.$executeRawUnsafe('ANALYZE');
  console.log(`[seed] wrote ${fixtures.length} tokens to ${OUT}. Done.`);
}

main()
  .catch(e => { console.error('[seed] failed:', e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
