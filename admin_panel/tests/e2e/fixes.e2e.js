// One check per finding of docs/nopa-chat-review.md.
const { assert, prisma, start, run } = require('./harness');

run(async () => {
  const { origin, mk, call, stop, wait } = await start(5094);
  const bots = require('../../dist/modules/chat/bots.js');
  const admin = await mk('admin');
  const sub = await mk('sub_admin');
  const manager = await mk('channel_manager');
  const mA = await mk('mentor'), mB = await mk('mentor');
  const cA = await prisma.caravan.create({ data: { name: 'الف', mentorId: mA.id } });
  const cB = await prisma.caravan.create({ data: { name: 'ب', mentorId: mB.id } });
  const a1 = await mk('student', { caravanId: cA.id, nakh: 0 });
  const a2 = await mk('student', { caravanId: cA.id });
  const a3 = await mk('student', { caravanId: cA.id });
  const b1 = await mk('student', { caravanId: cB.id });
  await call(admin, 'PUT', '/admin/chat-settings', { mode: 'on', pilotCaravanIds: [] });
  await wait(3100);
  const spaceOf = async (who, type) => (await call(who, 'GET', '/chat/spaces')).body.find(s => s.type === type);
  const groupA = await spaceOf(a1, 'caravan');
  const chA = await spaceOf(a1, 'challenges');
  await spaceOf(b1, 'caravan');

  // A1: a mention reaches only people of that conversation
  await call(a1, 'POST', `/chat/spaces/${groupA.id}/messages`, { body: 'سلام', mentions: [b1.id, a2.id] });
  assert.equal(await prisma.notification.count({ where: { userId: b1.id, type: 'chat' } }), 0);
  assert.equal(await prisma.notification.count({ where: { userId: a2.id, type: 'chat' } }), 1);
  console.log('A1 OK');

  // A2: staff stay outside the user's support space; 5.5: it is in the list without opening it
  const support = await spaceOf(a1, 'support');
  assert.ok(support, 'support is always in the list');
  await call(a1, 'POST', `/chat/spaces/${support.id}/messages`, { body: 'کمک' });
  const [theCase] = (await call(admin, 'GET', '/admin/support-cases')).body;
  await call(admin, 'POST', `/admin/support-cases/${theCase.id}/reply`, { body: 'پاسخ' });
  assert.equal(await prisma.chatMember.count({ where: { spaceId: support.id, userId: admin.id } }), 0);
  assert.ok(!(await call(admin, 'GET', '/chat/spaces')).body.some(s => s.id === support.id));
  console.log('A2 OK');

  // 5.6: parallel first messages open one case
  const support2 = await spaceOf(a2, 'support');
  await Promise.all([1, 2, 3, 4].map(i => call(a2, 'POST', `/chat/spaces/${support2.id}/messages`, { body: `پیام ${i}` })));
  assert.equal(await prisma.supportCase.count({ where: { userId: a2.id } }), 1);
  await prisma.rolePermission.upsert({ where: { roleName: 'sub_admin' }, update: { canLoginPanel: true, permissionsJson: '{"support":"edit"}' }, create: { roleName: 'sub_admin', canLoginPanel: true, permissionsJson: '{"support":"edit"}' } });
  const support3 = await spaceOf(a3, 'support');
  await call(a3, 'POST', `/chat/spaces/${support3.id}/messages`, { body: 'سؤال' });
  assert.equal(await prisma.notification.count({ where: { userId: sub.id, title: 'پرونده‌ی جدید پشتیبانی' } }), 1);
  console.log('5.6 OK');

  // a nakh challenge for the rest
  const made = await call(mA, 'POST', '/challenges', { title: 'تحلیل', description: 'متن', type: 'skill', rewardMin: 2, rewardMax: 8, allMembers: true });
  await wait(400);
  const card = (await call(a1, 'GET', `/chat/spaces/${chA.id}/messages`)).body.messages.at(-1);
  const topic = card.topic.id;
  const say = (who, body) => call(who, 'POST', `/chat/spaces/${chA.id}/messages`, { body, threadRootId: card.id });
  const own = await say(a1, 'به نظرم چون متن استدلال دارد باید تحلیل شود');
  await say(a2, 'من هم مثال دوم را بررسی می‌کنم چون مهم است');

  // 4.3: the group's final answer
  assert.equal((await call(a1, 'POST', `/chat/topics/${topic}/final-answer`, { messageId: own.body.id })).status, 403);
  assert.equal((await call(mA, 'POST', `/chat/topics/${topic}/final-answer`, { messageId: own.body.id })).status, 200);
  assert.ok((await call(a1, 'GET', `/chat/spaces/${chA.id}/messages`)).body.messages.at(-1).meta.finalAnswer.includes('استدلال'));
  console.log('4.3 OK');

  await call(mA, 'POST', `/chat/topics/${topic}/close`);

  // A9: a closed conversation is evidence
  assert.equal((await call(a1, 'PATCH', `/chat/messages/${own.body.id}`, { body: 'تغییر' })).status, 403);
  assert.equal((await call(a1, 'DELETE', `/chat/messages/${own.body.id}`)).status, 403);
  console.log('A9 OK');

  // A5: the minimum of the challenge holds
  assert.equal((await call(mA, 'PUT', `/chat/topics/${topic}/evaluation`, { rows: [{ userId: a1.id, finalNakh: 1, reason: 'کم' }] })).status, 400);
  await call(mA, 'PUT', `/chat/topics/${topic}/evaluation`, { rows: [{ userId: a1.id, finalNakh: 5, reason: 'ثبت' }, { userId: a2.id, finalNakh: 4, reason: 'ثبت' }] });
  console.log('A5 OK');

  // 4.9: a mentor's total stays inside the budget rule
  const rule = await prisma.mentorRewardRule.create({ data: { mentorId: mA.id, rewardType: 'CHALLENGE', maxGrantLimit: 6, timeframe: 'DAILY' } });
  assert.equal((await call(mA, 'POST', `/chat/topics/${topic}/pay`)).status, 400);
  await prisma.mentorRewardRule.update({ where: { id: rule.id }, data: { maxGrantLimit: 9 } });
  assert.equal((await call(mA, 'POST', `/chat/topics/${topic}/pay`)).status, 200);
  console.log('4.9 OK');

  // 4.8: the panel's timeline and result follow
  const sub1 = await prisma.submission.findFirst({ where: { challengeId: made.body.id, studentId: a1.id } });
  assert.equal(sub1.answerText.includes('استدلال'), true, 'the final answer is the record');
  assert.equal(await prisma.submissionEvent.count({ where: { submissionId: sub1.id, action: 'approved' } }), 1);

  // A4: taking back what was spent gives a clear refusal; repeating a correction works
  await prisma.user.update({ where: { id: a1.id }, data: { nakh: 0 } });
  const short = await call(mA, 'POST', `/chat/topics/${topic}/correct`, { userId: a1.id, finalNakh: 2, reason: 'اصلاح' });
  assert.equal(short.status, 400); assert.ok(short.body.error.includes('موجودی'));
  await prisma.user.update({ where: { id: a1.id }, data: { nakh: 20 } });
  for (const v of [3, 5, 3]) {
    assert.equal((await call(mA, 'POST', `/chat/topics/${topic}/correct`, { userId: a1.id, finalNakh: v, reason: 'اصلاح' })).status, 200);
  }
  assert.equal((await prisma.submission.findUnique({ where: { id: sub1.id } })).score, 3);
  console.log('A4, 4.8 OK');

  // 4.7: an objection ends
  await call(a2, 'POST', `/chat/topics/${topic}/objection`, { text: 'کم است' });
  assert.equal((await call(mA, 'GET', '/chat/dashboard')).body.objections.length, 1);
  assert.equal((await call(a2, 'POST', `/chat/topics/${topic}/objection/resolve`, { userId: a2.id, accept: false, response: 'x' })).status, 403);
  await call(mA, 'POST', `/chat/topics/${topic}/objection/resolve`, { userId: a2.id, accept: true, finalNakh: 6, response: 'حق با شماست' });
  assert.equal((await call(mA, 'GET', '/chat/dashboard')).body.objections.length, 0);
  const report = (await call(a2, 'GET', `/chat/topics/${topic}/my-report`)).body;
  assert.equal(report.finalNakh, 6); assert.equal(report.objectionResponse, 'حق با شماست');
  console.log('4.7 OK');

  // A3: an old zarik challenge is never paid in kalaf
  const legacy = await prisma.challenge.create({ data: { id: 'LEGACY1', title: 'قدیمی', description: 'd', type: 'skill', rewardAssetType: 'zarik', rewardMax: 200, rewardZarik: 200, createdByMentorId: mA.id, caravanId: cA.id } });
  await call(mA, 'PATCH', `/challenges/${legacy.id}`, { title: 'قدیمی ۲' });
  await wait(400);
  const legacyTopic = await prisma.chatTopic.findFirst({ where: { challengeId: legacy.id } });
  await prisma.chatMessage.create({ data: { spaceId: chA.id, seq: 9000, senderId: a1.id, body: 'این پاسخ من است چون باید بررسی شود', threadRootId: legacyTopic.messageId } });
  await call(mA, 'POST', `/chat/topics/${legacyTopic.id}/close`);
  assert.equal((await call(mA, 'GET', `/chat/topics/${legacyTopic.id}/evaluation`)).body.topic.legacy, true);
  assert.equal((await call(mA, 'PUT', `/chat/topics/${legacyTopic.id}/evaluation`, { rows: [{ userId: a1.id, finalNakh: 1, reason: 'x' }] })).status, 400);
  console.log('A3 OK');

  // A6: the export link obeys the switch and the account
  const link = (await call(mA, 'POST', `/chat/topics/${topic}/export-link`, {})).body.url;
  assert.equal((await fetch(origin + link)).status, 200);
  await prisma.user.update({ where: { id: mA.id }, data: { blocked: true } });
  assert.equal((await fetch(origin + link)).status, 403);
  await prisma.user.update({ where: { id: mA.id }, data: { blocked: false } });
  console.log('A6 OK');

  // A7: a deleted message takes its file with it
  const form = new FormData();
  form.append('spaceId', groupA.id);
  form.append('file', new Blob(['محرمانه']), 'a.txt');
  const up = await (await fetch(`${origin}/api/v1/chat/uploads`, { method: 'POST', headers: { Authorization: `Bearer ${a1.token}` }, body: form })).json();
  const withFile = await call(a1, 'POST', `/chat/spaces/${groupA.id}/messages`, { attachmentIds: [up.id] });
  const url = withFile.body.attachments[0].url;
  assert.equal((await fetch(origin + url)).status, 200);
  await call(a1, 'DELETE', `/chat/messages/${withFile.body.id}`);
  assert.equal((await fetch(origin + url)).status, 404);
  console.log('A7 OK');

  // A8: "enter groups" holds in the panel too
  const perms = (await call(admin, 'GET', '/admin/chat-settings')).body.permissions;
  await call(admin, 'PUT', '/admin/chat-settings', { mode: 'on', pilotCaravanIds: [], permissions: { ...perms, enterGroups: false } });
  assert.equal((await call(manager, 'GET', `/admin/chat-manage/spaces/${groupA.id}/messages`)).status, 403);
  assert.equal((await call(manager, 'POST', '/admin/chat-manage/publish', { spaceId: groupA.id, body: 'x' })).status, 403);
  assert.ok(!(await call(manager, 'GET', '/admin/chat-manage/spaces')).body.some(s => s.id === groupA.id));
  await call(admin, 'PUT', '/admin/chat-settings', { mode: 'on', pilotCaravanIds: [], permissions: perms });
  console.log('A8 OK');

  // A10: a transfer moves a live socket at once
  const { io } = require('socket.io-client');
  const socket = await new Promise((resolve, reject) => {
    const s = io(origin, { auth: { token: a3.token }, transports: ['websocket'], reconnection: false });
    s.events = [];
    s.onAny((e, p) => s.events.push([e, p]));
    s.on('ready', () => resolve(s));
    s.on('connect_error', reject);
  });
  assert.equal((await call(admin, 'POST', '/admin/caravans/transfer', { studentId: a3.id, targetCaravanId: cB.id })).status, 200);
  await wait(200);
  await call(a1, 'POST', `/chat/spaces/${groupA.id}/messages`, { body: 'بعد از انتقال' });
  await wait(250);
  assert.ok(!socket.events.some(([e, p]) => e === 'message:new' && p.body === 'بعد از انتقال'));
  socket.close();
  console.log('A10 OK');

  // groups: mentors and channel managers add, edit and delete them
  const created = await call(mA, 'POST', '/chat/groups', { title: 'تیم پروژه', memberIds: [a1.id, a2.id] });
  assert.equal(created.status, 201); const g = created.body;
  assert.equal(g.caravanId, cA.id);
  assert.equal((await call(a1, 'POST', '/chat/groups', { title: 'x', caravanId: cA.id })).status, 403);
  assert.equal((await call(mB, 'POST', '/chat/groups', { title: 'x', caravanId: cA.id })).status, 403);
  assert.equal((await call(mA, 'POST', '/chat/groups', { title: 'x', memberIds: [b1.id] })).status, 400, 'members of the caravan only');
  assert.ok((await call(a1, 'GET', '/chat/spaces')).body.some(s => s.id === g.id && s.type === 'media'));
  assert.ok(!(await call(a3, 'GET', '/chat/spaces')).body.some(s => s.id === g.id));
  assert.equal((await call(mB, 'PATCH', `/chat/groups/${g.id}`, { title: 'y' })).status, 403);
  assert.equal((await call(mA, 'PATCH', `/chat/groups/${g.id}`, { title: 'تیم تازه' })).body.title, 'تیم تازه');
  assert.equal((await call(manager, 'PATCH', `/chat/groups/${g.id}`, { title: 'نام مسئول' })).status, 200);
  await call(mA, 'DELETE', `/chat/groups/${g.id}/members/${a2.id}`);
  assert.equal((await call(a2, 'GET', `/chat/spaces/${g.id}/messages`)).status, 404);
  await call(mA, 'POST', `/chat/groups/${g.id}/members`, { memberIds: [a2.id] });
  assert.equal((await call(a2, 'GET', `/chat/spaces/${g.id}/messages`)).status, 200);
  await call(a1, 'POST', `/chat/spaces/${g.id}/messages`, { body: 'فایل پروژه' });
  assert.equal((await call(a1, 'DELETE', `/chat/groups/${g.id}`)).status, 403);
  assert.equal((await call(manager, 'GET', '/chat/groups')).body.length, 1);
  assert.equal((await call(manager, 'DELETE', `/chat/groups/${g.id}`)).status, 200);
  assert.equal((await call(a1, 'GET', `/chat/spaces/${g.id}/messages`)).status, 404);
  assert.equal((await call(mA, 'DELETE', `/chat/groups/${groupA.id}`)).status, 404, 'caravan groups cannot be deleted');
  console.log('groups OK');

  // 5.2: temporary mute
  assert.equal((await call(a1, 'POST', `/chat/spaces/${groupA.id}/members/${a2.id}/mute`, { minutes: 10 })).status, 403);
  await call(mA, 'POST', `/chat/spaces/${groupA.id}/members/${a2.id}/mute`, { minutes: 10 });
  assert.equal((await call(a2, 'POST', `/chat/spaces/${groupA.id}/messages`, { body: 'x' })).status, 403);
  await call(mA, 'POST', `/chat/spaces/${groupA.id}/members/${a2.id}/mute`, { minutes: 0 });
  assert.equal((await call(a2, 'POST', `/chat/spaces/${groupA.id}/messages`, { body: 'y' })).status, 201);
  console.log('5.2 OK');

  // 4.2: a timed challenge stays hidden until it starts
  const future = await call(mA, 'POST', '/challenges', { title: 'زمان‌دار', description: 'd', type: 'skill', allMembers: true, startDate: new Date(Date.now() + 3600e3).toISOString() });
  await wait(300);
  assert.equal(await prisma.chatTopic.count({ where: { challengeId: future.body.id } }), 0);
  await prisma.challenge.update({ where: { id: future.body.id }, data: { startDate: new Date(Date.now() - 1000) } });
  await bots.runCardRepair();
  assert.equal(await prisma.chatTopic.count({ where: { challengeId: future.body.id } }), 1);
  console.log('4.2 OK');

  // 4.1: running challenges get cards when chat is switched on; finished ones do not
  await prisma.challenge.createMany({ data: [
    { id: 'RUNNING', title: 'جاری', description: 'd', type: 'skill', createdByMentorId: mA.id, caravanId: cA.id, createdAt: new Date(Date.now() - 30 * 864e5), dueDate: new Date(Date.now() + 864e5) },
    { id: 'ENDED', title: 'تمام‌شده', description: 'd', type: 'skill', createdByMentorId: mA.id, caravanId: cA.id, createdAt: new Date(Date.now() - 30 * 864e5), dueDate: new Date(Date.now() - 864e5) },
  ] });
  await call(admin, 'PUT', '/admin/chat-settings', { mode: 'off', pilotCaravanIds: [] });
  await call(admin, 'PUT', '/admin/chat-settings', { mode: 'on', pilotCaravanIds: [] });
  await wait(600);
  assert.equal(await prisma.chatTopic.count({ where: { challengeId: 'RUNNING' } }), 1);
  assert.equal(await prisma.chatTopic.count({ where: { challengeId: 'ENDED' } }), 0);
  console.log('4.1 OK');

  // 4.6: from a challenge to its conversation
  const back = await call(a1, 'GET', `/chat/topics/by-challenge/${made.body.id}`);
  assert.equal(back.body.spaceId, chA.id); assert.equal(back.body.message.id, card.id);
  assert.equal((await call(b1, 'GET', `/chat/topics/by-challenge/${made.body.id}`)).status, 404);
  console.log('4.6 OK');

  // 5.7: no open station on the first round must not swallow the first announcement
  await prisma.station.deleteMany();
  await prisma.stationEvent.deleteMany();
  const locked = await prisma.station.create({ data: { title: 'نخستین', orderIndex: 1, isLocked: true } });
  await bots.runStationEvents();
  await prisma.station.update({ where: { id: locked.id }, data: { isLocked: false } });
  await bots.runStationEvents();
  assert.equal(await prisma.chatMessage.count({ where: { kind: 'station', stationId: locked.id } }), 1);
  console.log('5.7 OK');

  // 5.9: the panel's top list follows the official formula
  await prisma.user.update({ where: { id: b1.id }, data: { zarikBalance: 1, nakh: 0, farsh: 9 } });
  await prisma.user.update({ where: { id: a1.id }, data: { zarikBalance: 100000, nakh: 0, farsh: 0 } });
  const top = (await call(admin, 'GET', '/admin/leaderboard/assets')).body;
  assert.equal(top[0].name, b1.name);
  console.log('5.9 OK');

  // 6.2: abandoned uploads are removed
  const form2 = new FormData();
  form2.append('spaceId', groupA.id);
  form2.append('file', new Blob(['رها']), 'b.txt');
  const orphan = await (await fetch(`${origin}/api/v1/chat/uploads`, { method: 'POST', headers: { Authorization: `Bearer ${a2.token}` }, body: form2 })).json();
  await prisma.chatAttachment.update({ where: { id: orphan.id }, data: { createdAt: new Date(Date.now() - 2 * 864e5) } });
  await bots.runFileCleanup();
  assert.equal(await prisma.chatAttachment.count({ where: { id: orphan.id } }), 0);
  console.log('6.2 OK');

  await stop();
});
