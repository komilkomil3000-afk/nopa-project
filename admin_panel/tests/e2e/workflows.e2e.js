const { assert, prisma, ROOT, jwt, run, chromePath, hasChrome } = require('./harness');
const path = require('path');
const bcrypt = require('bcryptjs');
const { io } = require('socket.io-client');

run(async () => {
  const { origin, mk: mkUser, call: callApi, stop, wait: pause, realtime } = await require('./harness').start(5088);
  const base = origin + '/api/v1';
  const mk = mkUser, call = callApi, wait = pause;
  const bots = require('../../dist/modules/chat/bots.js');
  const nakh = async id => (await prisma.user.findUnique({ where: { id } })).nakh;
  const zarik = async id => (await prisma.user.findUnique({ where: { id } })).zarikBalance;

  const admin = await mk('admin');
  const sub = await mk('sub_admin');
  const manager = await mk('channel_manager');
  const mA = await mk('mentor'), mB = await mk('mentor'), mC = await mk('mentor');
  const cA = await prisma.caravan.create({ data: { name: 'کاروان الف', mentorId: mA.id } });
  const cB = await prisma.caravan.create({ data: { name: 'کاروان ب', mentorId: mB.id } });
  const cC = await prisma.caravan.create({ data: { name: 'کاروان ج', mentorId: mC.id } });
  const a1 = await mk('student', { caravanId: cA.id });
  const a2 = await mk('student', { caravanId: cA.id });
  const a3 = await mk('student', { caravanId: cA.id });
  const b1 = await mk('student', { caravanId: cB.id });
  const c1 = await mk('student', { caravanId: cC.id });
  await call(admin, 'PUT', '/admin/chat-settings', { mode: 'on', pilotCaravanIds: [] });
  await wait(3100);
  await call(a1, 'GET', '/chat/spaces'); await call(b1, 'GET', '/chat/spaces'); await call(c1, 'GET', '/chat/spaces');
  const spaceOf = async (who, type) => (await call(who, 'GET', '/chat/spaces')).body.find(s => s.type === type);

  // ---------- phase 4: support ----------
  const support = await call(a1, 'POST', '/chat/support/open', {});
  assert.equal(support.status, 200);
  await call(a1, 'POST', `/chat/spaces/${support.body.id}/messages`, { body: 'زریک من اشتباه است' });
  await call(a1, 'POST', `/chat/spaces/${support.body.id}/messages`, { body: 'لطفاً بررسی کنید' });
  let cases = await call(admin, 'GET', '/admin/support-cases?status=open');
  assert.equal(cases.body.length, 1, 'two messages, one case');
  assert.equal(cases.body[0].category, 'مالی و سرمایه');
  const caseId = cases.body[0].id;
  assert.equal((await call(mA, 'GET', '/admin/support-cases')).status, 403);
  assert.equal((await call(manager, 'GET', '/admin/support-cases')).status, 403, 'private access off by default');
  assert.equal((await call(a2, 'GET', `/chat/spaces/${support.body.id}/messages`)).status, 404);
  assert.equal((await call(sub, 'GET', '/admin/support-cases')).status, 403, 'needs the section grant');
  await call(admin, 'POST', `/admin/support-cases/${caseId}/reply`, { body: 'بررسی شد' });
  assert.equal((await call(a1, 'GET', `/chat/spaces/${support.body.id}/messages`)).body.messages.at(-1).body, 'بررسی شد');
  assert.equal(await prisma.notification.count({ where: { userId: a1.id, type: 'chat' } }), 1);
  await call(admin, 'POST', `/admin/support-cases/${caseId}/resolve`, {});
  assert.equal((await call(a1, 'POST', `/chat/support/cases/${caseId}/rate`, { rating: 5 })).status, 200);
  assert.equal((await call(a2, 'POST', `/chat/support/cases/${caseId}/rate`, { rating: 1 })).status, 404);
  await call(a1, 'POST', `/chat/spaces/${support.body.id}/messages`, { body: 'سؤال تازه درباره کلاس' });
  assert.equal((await call(a1, 'GET', '/chat/support/cases')).body.length, 2); console.log('phase 4 support OK');

  // ---------- phase 5: bots and stations ----------
  const groupA = await spaceOf(a1, 'caravan');
  const post = (who, body, extra = {}) => call(who, 'POST', `/chat/spaces/${groupA.id}/messages`, { body, ...extra });
  const hint = await post(a1, '/اعلان سلام');
  assert.equal(hint.status, 403, 'students have no commands');
  assert.equal((await post(a1, '/چیز معمولی')).status, 201, 'other slashes stay ordinary text');
  const ann = await post(mA, '/اعلان جلسه فردا');
  assert.equal(ann.body.command, true);
  const list = (await call(a1, 'GET', `/chat/spaces/${groupA.id}/messages`)).body.messages;
  assert.equal(list.at(-1).botKey, 'announce'); assert.equal(list.at(-1).sender, null);
  await post(mA, '/نظرسنجی جلسه کی باشد | شنبه | یکشنبه');
  const poll = (await call(a1, 'GET', `/chat/spaces/${groupA.id}/messages`)).body.messages.at(-1);
  assert.equal(poll.kind, 'poll');
  await call(a1, 'POST', `/chat/messages/${poll.id}/vote`, { option: 1 });
  assert.equal((await call(a1, 'POST', `/chat/messages/${poll.id}/vote`, { option: 0 })).body.pollVotes.length, 1);
  assert.equal((await call(a1, 'POST', `/chat/messages/${poll.id}/vote`, { option: 9 })).status, 400);
  assert.ok((await post(mA, '/ساکت‌ها')).body.result.includes(a3.name));
  assert.ok((await post(mA, '/گزارش')).body.result.includes('پیام'));
  await post(mA, '/کند ۶۰');
  await post(a2, 'اول');
  assert.equal((await post(a2, 'دوم')).status, 429);
  await post(mA, '/کند 0');
  await prisma.chatBot.create({ data: { key: 'moderation', enabled: true, settings: { bannedWords: ['بدواژه'] } } });
  assert.equal((await post(a2, 'این بدواژه است')).status, 400);
  const sched = await post(mA, '/زمان‌بندی 2030-01-01 10:00 پیام آینده');
  assert.equal(sched.body.command, true);
  await prisma.chatScheduledMessage.updateMany({ data: { sendAt: new Date(Date.now() - 1000) } });
  await Promise.all([bots.runScheduledMessages(), bots.runScheduledMessages()]);
  assert.equal((await prisma.chatMessage.count({ where: { body: 'پیام آینده' } })), 1, 'sent once'); console.log('bots OK');

  const st1 = await prisma.station.create({ data: { title: 'منزلگاه یک', orderIndex: 1 } });
  await bots.runStationEvents();
  assert.equal(await prisma.chatMessage.count({ where: { kind: 'station' } }), 0, 'first run announces nothing old');
  const st2 = await prisma.station.create({ data: { title: 'منزلگاه دو', orderIndex: 2, scheduledUnlockTime: new Date(Date.now() + 3600 * 1000) } });
  await bots.runStationEvents();
  assert.equal(await prisma.chatMessage.count({ where: { body: { contains: '۷۲ ساعت' } } }), 1);
  await bots.runStationEvents(new Date(Date.now() + 2 * 3600 * 1000));
  await bots.runStationEvents(new Date(Date.now() + 2 * 3600 * 1000));
  const cards = await prisma.chatMessage.findMany({ where: { kind: 'station' } });
  assert.equal(cards.length, 1); assert.equal(cards[0].stationId, st2.id);
  assert.ok((await prisma.stationReport.count({ where: { stationId: st1.id } })) >= 5);
  const st3 = await prisma.station.create({ data: { title: 'ویژه', orderIndex: 3, targetCaravansJson: JSON.stringify([cB.id]) } });
  await bots.runStationEvents();
  const targeted = await prisma.chatMessage.findFirst({ where: { stationId: st3.id }, include: { space: true } });
  assert.equal(targeted.space.key, `caravan:${cB.id}`); console.log('phase 5 stations OK');

  // panel publish
  const ann2 = await spaceOf(a1, 'announcements');
  assert.equal((await call(manager, 'POST', '/admin/chat-manage/publish', { spaceId: ann2.id, body: 'اعلان پنل' })).status, 201);
  assert.equal((await call(manager, 'POST', '/admin/chat-manage/publish', { spaceId: support.body.id, body: 'x' })).status, 404);
  assert.equal((await call(manager, 'GET', '/admin/chat-manage/bots')).status, 200);
  assert.equal((await call(mA, 'GET', '/admin/chat-manage/bots')).status, 403); console.log('panel publishing OK');

  // ---------- phase 6: cards and tags ----------
  const created = await call(mA, 'POST', '/challenges', { title: 'تحلیل منطقی متن', description: 'استدلال و تحلیل', type: 'skill', rewardAssetType: 'nakh', rewardMin: 0, rewardMax: 10, allMembers: true, stationId: st1.id });
  assert.equal(created.status, 201);
  await wait(400);
  const chSpace = await spaceOf(a1, 'challenges');
  const card = (await call(a1, 'GET', `/chat/spaces/${chSpace.id}/messages`)).body.messages.at(-1);
  assert.equal(card.kind, 'challenge'); assert.equal(card.meta.tag, 'درون‌گروهی'); assert.equal(card.meta.stationTitle, 'منزلگاه یک');
  assert.ok(card.meta.creatorName); assert.ok(card.topic.id);
  const topicId = card.topic.id;
  assert.equal((await call(b1, 'GET', `/chat/spaces/${chSpace.id}/messages`)).status, 404);
  await call(mA, 'PATCH', `/challenges/${created.body.id}`, { title: 'تحلیل منطقی متن تازه' });
  await wait(300);
  assert.equal((await call(a1, 'GET', `/chat/spaces/${chSpace.id}/messages`)).body.messages.find(m => m.id === card.id).meta.title, 'تحلیل منطقی متن تازه');
  assert.equal(await prisma.chatTopic.count({ where: { challengeId: created.body.id } }), 1, 'an edit adds no card');

  const dark = await call(mA, 'POST', `/chat/spaces/${chSpace.id}/tags`, { name: 'ایده', color: '#101010' });
  assert.equal(dark.status, 400, 'unreadable colour');
  const tag = await call(mA, 'POST', `/chat/spaces/${chSpace.id}/tags`, { name: 'ایده برتر', color: '#DFB690' });
  const staffTag = await call(mA, 'POST', `/chat/spaces/${chSpace.id}/tags`, { name: 'پیگیری', color: '#9292E2', visibility: 'staff' });
  assert.equal(tag.status, 201);
  assert.equal((await call(a1, 'POST', `/chat/spaces/${chSpace.id}/tags`, { name: 'x', color: '#DFB690' })).status, 403);
  assert.equal((await call(a1, 'GET', `/chat/spaces/${chSpace.id}/tags`)).body.length, 1, 'students do not see staff tags');
  assert.equal((await call(mA, 'POST', '/chat/spaces/' + chSpace.id + '/tags', { name: 'g', color: '#DFB690', global: true })).status, 403); console.log('phase 6 cards and tags OK');

  // arguing in the thread
  const say = (who, body, extra = {}) => call(who, 'POST', `/chat/spaces/${chSpace.id}/messages`, { body, threadRootId: card.id, ...extra });
  assert.equal((await call(a1, 'POST', `/chat/spaces/${chSpace.id}/messages`, { body: 'x' })).status, 403, 'only cards at the top');
  const m1 = await say(a1, 'به نظرم چون متن یک استدلال منطقی دارد باید اول مقدمه را تحلیل کنیم');
  const m2 = await say(a2, 'موافقم ولی مثال دوم متن با نتیجه نمی‌خواند، چرا؟', { replyToId: m1.body.id });
  await say(a1, 'بنابراین تحلیل دوم درست‌تر است زیرا نتیجه از مقدمه می‌آید', { replyToId: m2.body.id });
  for (let i = 0; i < 4; i++) await say(a3, 'سلام');
  await call(a2, 'POST', `/chat/messages/${m1.body.id}/reactions`, { type: 'bravo' });
  assert.equal((await call(a2, 'POST', `/chat/messages/${m1.body.id}/mark`, { mark: 'best' })).status, 403);
  await call(mA, 'POST', `/chat/messages/${m1.body.id}/mark`, { mark: 'best' });
  await call(mA, 'POST', `/chat/messages/${m1.body.id}/tags`, { tagId: tag.body.id });
  await call(mA, 'POST', `/chat/messages/${m1.body.id}/tags`, { tagId: staffTag.body.id });
  const thread = await call(a1, 'GET', `/chat/spaces/${chSpace.id}/messages?threadRootId=${card.id}`);
  const tagged = thread.body.messages.find(m => m.id === m1.body.id);
  assert.equal(tagged.tags.length, 1, 'staff tag hidden from students'); assert.equal(tagged.best, true);
  assert.deepEqual(thread.body.staffTags, {});
  assert.equal(Object.keys((await call(mA, 'GET', `/chat/spaces/${chSpace.id}/messages?threadRootId=${card.id}`)).body.staffTags).length, 1);
  assert.equal((await call(mA, 'GET', `/chat/spaces/${chSpace.id}/messages?threadRootId=${card.id}&tagId=${tag.body.id}`)).body.messages.length, 1);

  // ---------- phase 7: evaluation ----------
  assert.equal((await call(a1, 'POST', `/chat/topics/${topicId}/close`)).status, 403);
  assert.equal((await call(a1, 'GET', `/chat/topics/${topicId}/evaluation`)).status, 403);
  const ev = await call(mA, 'GET', `/chat/topics/${topicId}/evaluation`);
  assert.equal(ev.status, 200);
  const row = id => ev.body.rows.find(r => r.userId === id);
  assert.equal(ev.body.rows.length, 3, 'only participants');
  assert.ok(row(a1.id).score > row(a2.id).score);
  assert.ok(row(a2.id).score > row(a3.id).score, 'greetings earn less than arguments');
  assert.ok(row(a3.id).flags.includes('پیام تکراری یا بی‌محتوا'));
  console.log('scores', ev.body.rows.map(r => `${r.score}/${r.share}%/${r.suggested}`).join(' '));
  assert.equal((await call(mA, 'POST', `/chat/topics/${topicId}/pay`)).status, 400, 'must be closed first');
  await call(mA, 'POST', `/chat/topics/${topicId}/close`);
  assert.equal((await say(a1, 'دیر رسیدم')).status, 403, 'closed conversation');
  assert.ok((await call(mA, 'GET', `/chat/topics/${topicId}/insight`)).body.summary);
  const rows = ev.body.rows.map(r => ({ userId: r.userId, finalNakh: r.suggested }));
  assert.equal((await call(mA, 'PUT', `/chat/topics/${topicId}/evaluation`, { rows: [{ userId: a1.id, finalNakh: 0 }] })).status, 400, 'big change needs a reason');
  assert.equal((await call(mA, 'PUT', `/chat/topics/${topicId}/evaluation`, { rows: [{ userId: b1.id, finalNakh: 1 }] })).status, 400, 'non participant');
  assert.equal((await call(mA, 'PUT', `/chat/topics/${topicId}/evaluation`, { rows: [{ userId: a1.id, finalNakh: 11, reason: 'x' }] })).status, 400, 'over the ceiling');
  assert.equal((await call(mA, 'PUT', `/chat/topics/${topicId}/evaluation`, { rows })).status, 200);
  const before = await nakh(a1.id);
  const pays = await Promise.all([1, 2, 3].map(() => call(mA, 'POST', `/chat/topics/${topicId}/pay`)));
  assert.equal(pays.filter(p => p.status === 200).length, 1);
  assert.equal(await nakh(a1.id), before + row(a1.id).suggested); console.log('phase 7 pays once OK');
  assert.equal((await prisma.submission.findFirst({ where: { challengeId: created.body.id, studentId: a1.id } })).status, 'approved');
  assert.equal((await call(a3, 'GET', `/chat/topics/${topicId}/my-report`)).body.ready, true);
  assert.equal((await call(a1, 'POST', `/chat/topics/${topicId}/objection`, { text: 'نقد من دیده نشد' })).status, 200);
  assert.equal((await call(a1, 'POST', `/chat/topics/${topicId}/objection`, { text: 'دوباره' })).status, 400);
  const fix = await call(mA, 'POST', `/chat/topics/${topicId}/correct`, { userId: a1.id, finalNakh: 10, reason: 'بازبینی' });
  assert.equal(fix.status, 200);
  assert.equal(await nakh(a1.id), before + 10);
  assert.equal((await call(mA, 'POST', `/chat/topics/${topicId}/reopen`)).status, 400, 'no reopening after payment');
  const dash = await call(mA, 'GET', '/chat/dashboard');
  assert.equal(dash.status, 200); assert.equal(dash.body.objections.length, 1);
  assert.equal((await call(a1, 'GET', '/chat/dashboard')).status, 403);
  const exp = await call(mA, 'GET', `/chat/topics/${topicId}/export`);
  assert.ok(String(exp.body).includes(a1.name)); console.log('objection, correction, dashboard, export OK');

  // personal challenge
  const personal = await call(mA, 'POST', '/challenges', { title: 'تمرین فردی', description: 'شخصی', type: 'skill', rewardMin: 0, rewardMax: 5, recipientIds: [a2.id] });
  assert.equal(personal.status, 201);
  await wait(400);
  const dm = (await call(a2, 'GET', '/chat/spaces')).body.find(s => s.type === 'direct');
  const pCard = (await call(a2, 'GET', `/chat/spaces/${dm.id}/messages`)).body.messages.at(-1);
  assert.equal(pCard.meta.tag, 'شخصی');
  await call(a2, 'POST', `/chat/spaces/${dm.id}/messages`, { body: 'این پاسخ من به تمرین است چون باید تحلیل شود', threadRootId: pCard.id });
  await call(mA, 'POST', `/chat/topics/${pCard.topic.id}/close`);
  const pEv = await call(mA, 'GET', `/chat/topics/${pCard.topic.id}/evaluation`);
  await call(mA, 'PUT', `/chat/topics/${pCard.topic.id}/evaluation`, { rows: [{ userId: a2.id, finalNakh: pEv.body.rows[0].suggested }] });
  assert.equal((await call(mA, 'POST', `/chat/topics/${pCard.topic.id}/pay`)).status, 200); console.log('personal challenge OK');

  // ---------- phase 8: inter-group ----------
  assert.equal((await call(mA, 'POST', '/challenges', { title: 'x', description: 'x', type: 'skill', caravanId: 'inter_group' })).body.category === 'inter_group', false, 'mentors cannot create it');
  const inter = await call(admin, 'POST', '/challenges', { title: 'رقابت بزرگ', description: 'فراگروهی', type: 'skill', caravanId: 'inter_group', dueDate: new Date(Date.now() + 864e5).toISOString() });
  assert.equal(inter.status, 201); assert.equal(inter.body.category, 'inter_group');
  await wait(600);
  const cid = inter.body.id;
  const arena = await spaceOf(a1, 'arena');
  const arenaCard = (await call(a1, 'GET', `/chat/spaces/${arena.id}/messages`)).body.messages.at(-1);
  assert.equal(arenaCard.meta.tag, 'فراگروهی');
  assert.equal((await call(a1, 'POST', `/chat/spaces/${arena.id}/messages`, { body: 'سلام رقبا' })).status, 403);
  assert.equal((await call(a1, 'POST', `/chat/spaces/${arena.id}/messages`, { body: 'سلام رقبا', threadRootId: arenaCard.id })).status, 403, 'rivals cannot talk');
  const privA = (await call(a1, 'GET', `/chat/spaces/${chSpace.id}/messages`)).body.messages.find(m => m.meta?.challengeId === cid);
  assert.ok(privA, 'each caravan has its own thread');
  for (const [w, t] of [[a1, 'پیشنهاد می‌کنم ساختار را تغییر دهیم'], [a1, 'بخش دوم هم نیاز به منبع دارد'], [a2, 'من منابع را جمع می‌کنم و می‌فرستم']]) {
    await call(w, 'POST', `/chat/spaces/${chSpace.id}/messages`, { body: t, threadRootId: privA.id });
  }
  const q = await call(a1, 'POST', `/chat/intergroup/${cid}/question`, { body: 'سقف حجم چقدر است؟' });
  assert.equal(q.status, 201);
  await call(admin, 'POST', `/admin/intergroup/questions/${q.body.id}/answer`, { answer: 'دو صفحه' });
  assert.ok((await call(b1, 'GET', `/chat/spaces/${arena.id}/messages?threadRootId=${arenaCard.id}`)).body.messages.at(-1).body.includes('دو صفحه'), 'the answer reaches every caravan');

  assert.equal((await call(a1, 'POST', `/chat/intergroup/${cid}/entry`, { body: 'x' })).status, 403);
  assert.equal((await call(mB, 'POST', `/chat/intergroup/${cid}/entry`, { body: 'x', caravanId: cA.id })).status, 403);
  await Promise.all([call(mA, 'POST', `/chat/intergroup/${cid}/entry`, { body: 'اثر الف' }), call(mB, 'POST', `/chat/intergroup/${cid}/entry`, { body: 'اثر ب' }), call(mC, 'POST', `/chat/intergroup/${cid}/entry`, { body: 'اثر ج' })]);
  const codes = (await prisma.interGroupEntry.findMany({ where: { challengeId: cid } })).map(e => e.anonCode).sort();
  assert.deepEqual(codes, [1, 2, 3], 'codes stay unique in parallel');

  await call(admin, 'POST', `/admin/intergroup/${cid}/start-judging`, {});
  const forA = await call(mA, 'GET', `/chat/intergroup/${cid}/judge`);
  assert.equal(forA.body.length, 2, 'no judging of the own caravan');
  assert.ok(!JSON.stringify(forA.body).includes('کاروان'), 'anonymous');
  const ownEntry = await prisma.interGroupEntry.findFirst({ where: { challengeId: cid, caravanId: cA.id } });
  assert.equal((await call(mA, 'POST', `/chat/intergroup/entries/${ownEntry.id}/judge`, { score: 100, strength: 'x', suggestion: 'y' })).status, 403);
  assert.equal((await call(a1, 'GET', `/chat/intergroup/${cid}/judge`)).status, 403);
  assert.equal((await call(mA, 'POST', `/chat/intergroup/entries/${forA.body[0].id}/judge`, { score: 80 })).status, 400, 'feedback needs both parts');
  const entries = await prisma.interGroupEntry.findMany({ where: { challengeId: cid } });
  for (const e of entries) {
    const score = e.caravanId === cA.id ? 95 : e.caravanId === cB.id ? 80 : 60;
    await call(admin, 'POST', `/chat/intergroup/entries/${e.id}/judge`, { score, strength: 'ساختار روشن', suggestion: 'منبع بیشتر' });
  }

  const tiers = await call(mA, 'GET', `/chat/intergroup/${cid}/tiers`);
  const sug = Object.fromEntries(tiers.body.rows.map(r => [r.user.id, r.suggested]));
  assert.equal(sug[a1.id], 'partner'); assert.equal(sug[a2.id], 'minimal'); assert.equal(sug[a3.id], 'inactive');
  assert.equal((await call(mB, 'GET', `/chat/intergroup/${cid}/tiers?caravanId=${cA.id}`)).status, 403);
  assert.equal((await call(mA, 'PUT', `/chat/intergroup/${cid}/tiers`, { tiers: { [a1.id]: 'full' } })).status, 400, 'all members needed');
  await call(mA, 'PUT', `/chat/intergroup/${cid}/tiers`, { tiers: { [a1.id]: 'full', [a2.id]: 'partner', [a3.id]: 'inactive' } });
  await call(mB, 'PUT', `/chat/intergroup/${cid}/tiers`, { tiers: { [b1.id]: 'minimal' } });
  await call(mC, 'PUT', `/chat/intergroup/${cid}/tiers`, { tiers: { [c1.id]: 'full' } });

  const board = await call(admin, 'GET', `/admin/intergroup/${cid}/board`);
  assert.equal(board.status, 200);
  assert.equal((await call(mA, 'GET', `/admin/intergroup/${cid}/board`)).status, 403);
  const ranked = board.body.rows.filter(r => r.delivered).map(r => r.caravanId);
  console.log('board', board.body.rows.filter(r => r.delivered).map(r => `${r.name}:${r.score}`).join(' '));

  const zero = { a1: await zarik(a1.id), a2: await zarik(a2.id), a3: await zarik(a3.id), b1: await zarik(b1.id), c1: await zarik(c1.id) };
  const order = [cA.id, cB.id, cC.id];
  const preview = await call(admin, 'POST', `/admin/challenges/${cid}/ranking`, { ranking: order, preview: true });
  assert.equal(preview.body.total, 20000 + 12000 + 3750 + 10000);
  assert.equal((await zarik(a1.id)), zero.a1, 'preview pays nothing');
  const results = await Promise.all([1, 2].map(() => call(admin, 'POST', `/admin/challenges/${cid}/ranking`, { ranking: order })));
  assert.equal(results.filter(r => r.status === 200).length, 1);
  assert.equal(await zarik(a1.id), zero.a1 + 20000);
  assert.equal(await zarik(a2.id), zero.a2 + 12000);
  assert.equal(await zarik(a3.id), zero.a3, 'no effort, no zarik');
  assert.equal(await zarik(b1.id), zero.b1 + 3750);
  assert.equal(await zarik(c1.id), zero.c1 + 10000);
  assert.equal(await prisma.caravanBanner.count({ where: { challengeId: cid } }), 3);
  const resultCard = (await call(a1, 'GET', `/chat/spaces/${arena.id}/messages`)).body.messages.at(-1);
  assert.equal(resultCard.kind, 'result'); assert.equal(resultCard.meta.places[0].name, 'کاروان الف');
  console.log('phase 8 inter-group OK');

  // a challenge run without chat keeps working
  const legacy = await call(admin, 'POST', '/challenges', { title: 'بی‌چت', description: 'd', type: 'skill', caravanId: 'inter_group' });
  await wait(300);
  await prisma.submission.create({ data: { challengeId: legacy.body.id, studentId: b1.id } });
  assert.equal((await call(admin, 'POST', `/admin/challenges/${legacy.body.id}/ranking`, { ranking: [cB.id] })).status, 200); console.log('old ranking path OK');

  // ---------- phase 9: oversight ----------
  assert.equal((await call(a2, 'POST', `/chat/messages/${m1.body.id}/report`, { reason: 'نامناسب' })).status, 201);
  const reports = await call(manager, 'GET', '/admin/chat-manage/reports');
  assert.equal(reports.body.length, 1);
  assert.equal((await call(manager, 'POST', `/admin/chat-manage/reports/${reports.body[0].id}/resolve`, { deleteMessage: true })).status, 200);
  assert.ok((await prisma.chatMessage.findUnique({ where: { id: m1.body.id } })).deletedAt);
  assert.equal((await call(manager, 'GET', `/admin/chat-manage/spaces/${groupA.id}/export`)).status, 403, 'export is off by default');
  const csv = await call(admin, 'GET', `/admin/chat-manage/spaces/${groupA.id}/export`);
  assert.ok(String(csv.body).includes('جلسه فردا'));
  assert.ok(String((await call(admin, 'GET', `/admin/chat-manage/spaces/${groupA.id}/export?format=html`)).body).includes('<table>'));
  assert.equal((await call(admin, 'GET', `/admin/chat-manage/spaces/${dm.id}/export`)).status, 404, 'private stays private');
  const stats = await call(admin, 'GET', '/admin/chat-manage/analytics');
  assert.equal(stats.status, 200); assert.ok(stats.body.caravans.find(c => c.id === cA.id).messages > 0);
  console.log('phase 9 oversight OK');

  // deleting a challenge removes its cards
  const del = await call(mB, 'POST', '/challenges', { title: 'حذفی', description: 'd', type: 'skill', allMembers: true });
  await wait(300);
  const delCard = await prisma.chatTopic.findFirst({ where: { challengeId: del.body.id } });
  await call(admin, 'DELETE', `/admin/challenges/${del.body.id}`);
  assert.ok((await prisma.chatMessage.findUnique({ where: { id: delCard.messageId } })).deletedAt); console.log('card removal OK');

  // export link
  const link = await call(mA, 'POST', `/chat/topics/${topicId}/export-link`, {});
  assert.ok(String(await (await fetch(origin + link.body.url)).text()).includes(a2.name));
  assert.equal((await fetch(origin + link.body.url.replace(/t=.*/, 't=bad'))).status, 403);
  assert.equal((await call(a1, 'POST', `/chat/topics/${topicId}/export-link`, {})).status, 403); console.log('export link OK');

  // panel in a real browser
  const puppeteer = require('puppeteer-core');
  if (!hasChrome()) { console.log('no Chrome: panel checks skipped'); await stop(); return; }
  const browser = await puppeteer.launch({ executablePath: chromePath, headless: 'new', args: ['--no-sandbox'] });
  const open = async (user, hash) => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1000 });
    const problems = [];
    page.on('pageerror', e => problems.push('pageerror: ' + e.message));
    page.on('response', r => { if (r.url().includes('/api/') && r.status() >= 400) problems.push(r.status() + ' ' + r.url().replace(origin, '')); });
    await page.evaluateOnNewDocument((t, u) => { localStorage.setItem('nopa_admin_token', t); localStorage.setItem('nopa_admin_user', u); }, user.token, JSON.stringify({ id: user.id, role: user.role, name: user.name }));
    await page.goto(origin + '/admin/' + hash, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    return { page, problems };
  };
  const p1 = await open(admin, '#chat');
  await p1.page.screenshot({ path: path.join(process.env.E2E_OUT, 'panel-chat-ops.png'), fullPage: true });
  const ops = await p1.page.evaluate(() => ({
    bots: document.querySelectorAll('.chat-bot-toggle').length,
    spaces: document.querySelectorAll('#chat-publish-space option').length,
    analytics: document.getElementById('chat-analytics').innerText.length,
    reports: document.getElementById('chat-reports-list').innerText,
  }));
  console.log('chat tab', JSON.stringify(ops), JSON.stringify(p1.problems));
  assert.equal(ops.bots, 7); assert.ok(ops.spaces > 3); assert.ok(ops.analytics > 10); assert.equal(p1.problems.length, 0);
  await p1.page.evaluate(() => { document.getElementById('chat-publish-body').value = 'از پنل'; document.querySelector('[data-click="publishChatMessage"]').click(); });
  await new Promise(r => setTimeout(r, 500));
  assert.ok(await prisma.chatMessage.findFirst({ where: { body: 'از پنل' } }));

  const p2 = await open(admin, '#support-cases');
  await p2.page.select('#support-cases-filter', 'open');
  await new Promise(r => setTimeout(r, 500));
  await p2.page.evaluate(() => document.querySelector('[data-click="openSupportCase"]').click());
  await new Promise(r => setTimeout(r, 500));
  await p2.page.screenshot({ path: path.join(process.env.E2E_OUT, 'panel-support.png'), fullPage: true });
  const detail = await p2.page.evaluate(() => document.getElementById('support-case-detail').innerText);
  console.log('support tab', detail.slice(0, 80), JSON.stringify(p2.problems));
  assert.ok(detail.includes('کلاس')); assert.equal(p2.problems.length, 0);

  const p3 = await open(manager, '');
  const managerView = await p3.page.evaluate(() => ({ spaces: document.getElementById('chat-spaces-list').innerText.length, bots: document.querySelectorAll('.chat-bot-toggle').length }));
  console.log('manager', JSON.stringify(managerView), JSON.stringify(p3.problems));
  assert.ok(managerView.spaces > 0); assert.equal(managerView.bots, 7);
  assert.equal(p3.problems.length, 0);
  await p3.page.evaluate(() => { document.getElementById('chat-group-title').value = 'گروه پنل'; document.querySelector('[data-click="createChatGroup"]').click(); });
  await new Promise(r => setTimeout(r, 600));
  assert.ok(await prisma.chatSpace.findFirst({ where: { title: 'گروه پنل', type: 'media' } }), 'group made from the panel');
  await browser.close();
  console.log('panel in Chrome OK');

  await stop();
});
