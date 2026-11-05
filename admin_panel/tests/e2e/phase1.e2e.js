// Phase 1 of docs/specs/chat-access-matrix.md: support role, arena rules and sealed works, mentor group deletion,
// and the three fixes (multi-caravan mentor, caravan transfer, no payout before participation is confirmed).
const { assert, prisma, start, run } = require('./harness');

run(async () => {
  const { origin, mk, call, stop, wait } = await start(5097);
  const admin = await mk('admin');
  const support = await mk('support');
  const mA = await mk('mentor'), mB = await mk('mentor'), mMulti = await mk('mentor');
  const cA = await prisma.caravan.create({ data: { name: 'الف', mentorId: mA.id } });
  const cB = await prisma.caravan.create({ data: { name: 'ب', mentorId: mB.id } });
  const cC = await prisma.caravan.create({ data: { name: 'ج', mentorId: mMulti.id } });
  const cD = await prisma.caravan.create({ data: { name: 'د', mentorId: mMulti.id } });
  const a1 = await mk('student', { caravanId: cA.id });
  const a2 = await mk('student', { caravanId: cA.id });
  const b1 = await mk('student', { caravanId: cB.id });
  const d1 = await mk('student', { caravanId: cD.id });
  await call(admin, 'PUT', '/admin/chat-settings', { mode: 'on', pilotCaravanIds: [] });
  await wait(3100);

  // ---- Support role: chat only, every caravan, one at a time ----
  assert.equal((await call(support, 'GET', '/challenges')).status, 403, 'support is confined to the chat API');
  const caravans = await call(support, 'GET', '/chat/caravans');
  assert.equal(caravans.status, 200);
  assert.equal(caravans.body.length, 4);
  const all = (await call(support, 'GET', '/chat/spaces')).body;
  assert.ok(all.some(s => s.type === 'mentors'), 'support is in the mentors room');
  assert.equal(all.filter(s => s.type === 'caravan').length, 4);
  const onlyA = (await call(support, 'GET', `/chat/spaces?caravanId=${cA.id}`)).body;
  assert.deepEqual(onlyA.filter(s => s.type === 'caravan' || s.type === 'challenges').map(s => s.type).sort(), ['caravan', 'challenges']);
  assert.ok(onlyA.some(s => s.type === 'announcements'), 'global spaces stay in the filtered list');
  const announcements = all.find(s => s.type === 'announcements');
  assert.equal(announcements.canPost, false);
  assert.equal((await call(support, 'POST', `/chat/spaces/${announcements.id}/messages`, { body: 'سلام' })).status, 403);
  const groupA = onlyA.find(s => s.type === 'caravan');
  assert.equal((await call(support, 'POST', `/chat/spaces/${groupA.id}/messages`, { body: 'پشتیبانی در خدمت است' })).status, 201);
  assert.equal((await call(support, 'POST', '/chat/direct', { userId: mA.id })).status, 200, 'support ↔ mentor');
  assert.equal((await call(mA, 'POST', '/chat/direct', { userId: support.id })).status, 200, 'mentor ↔ support');
  assert.equal((await call(support, 'POST', '/chat/direct', { userId: a1.id })).status, 403, 'support does not DM students');
  // A student's new case reaches support in the app, and support answers without joining
  const mySupport = (await call(a1, 'POST', '/chat/support/open')).body.id;
  await call(a1, 'POST', `/chat/spaces/${mySupport}/messages`, { body: 'رمزم را فراموش کردم' });
  assert.ok((await call(support, 'GET', '/chat/spaces')).body.some(s => s.id === mySupport), 'open case is listed for support');
  assert.equal((await call(support, 'POST', `/chat/spaces/${mySupport}/messages`, { body: 'بررسی می‌کنیم' })).status, 201);
  assert.equal(await prisma.chatMember.count({ where: { spaceId: mySupport, userId: support.id } }), 0, 'support stays outside');
  assert.equal((await prisma.supportCase.findFirst({ where: { spaceId: mySupport } })).status, 'reviewing');
  console.log('support role OK');

  // ---- Arena: read-only feed for mentors, write only in an open cross-caravan thread ----
  const made = await call(admin, 'POST', '/challenges', { title: 'رقابت', description: 'd', type: 'skill', caravanId: 'inter_group', dueDate: new Date(Date.now() + 864e5).toISOString() });
  const id = made.body.id;
  await wait(600);
  const arena = all.find(s => s.type === 'arena');
  const topic = await prisma.chatTopic.findFirst({ where: { challengeId: id, spaceId: arena.id } });
  assert.ok(topic, 'the challenge card is in the arena');
  assert.equal((await call(mA, 'POST', `/chat/spaces/${arena.id}/messages`, { body: 'پست تازه' })).status, 403, 'no top-level posts for mentors');
  const plain = await call(admin, 'POST', `/chat/spaces/${arena.id}/messages`, { body: 'خبر' });
  await call(admin, 'POST', `/chat/messages/${plain.body.id}/mark`, { mark: 'thread' });
  await call(admin, 'POST', `/chat/spaces/${arena.id}/messages`, { body: 'گفتگو', threadRootId: plain.body.id });
  assert.equal((await call(mA, 'POST', `/chat/spaces/${arena.id}/messages`, { body: 'نظر', threadRootId: plain.body.id })).status, 403, 'only challenge threads');
  assert.equal((await call(mA, 'POST', `/chat/spaces/${arena.id}/messages`, { body: 'سؤال درباره‌ی چالش', threadRootId: topic.messageId })).status, 201);
  assert.equal((await call(support, 'POST', `/chat/spaces/${arena.id}/messages`, { body: 'x', threadRootId: topic.messageId })).status, 403);
  console.log('arena rules OK');

  // ---- Submissions: sealed from rivals until the deadline, caravan never guessed ----
  const upload = async (who, name) => {
    const form = new FormData();
    form.append('spaceId', arena.id);
    form.append('file', new Blob(['اثر']), name);
    return (await fetch(`${origin}/api/v1/chat/uploads`, { method: 'POST', headers: { Authorization: `Bearer ${who.token}` }, body: form })).json();
  };
  const fileA = await upload(mA, 'a.pdf');
  const subA = await call(mA, 'POST', `/chat/spaces/${arena.id}/messages`, { body: 'اثر کاروان الف', threadRootId: topic.messageId, attachmentIds: [fileA.id] });
  assert.equal(subA.status, 201);
  assert.ok(await prisma.interGroupEntry.findFirst({ where: { challengeId: id, caravanId: cA.id } }), 'A delivered');

  const fileM = await upload(mMulti, 'm.pdf');
  assert.equal((await call(mMulti, 'POST', `/chat/spaces/${arena.id}/messages`, { body: 'اثر', threadRootId: topic.messageId, attachmentIds: [fileM.id] })).status, 400, 'a mentor of two caravans must name one');
  assert.equal((await call(mMulti, 'POST', `/chat/spaces/${arena.id}/messages`, { body: 'اثر', threadRootId: topic.messageId, attachmentIds: [fileM.id], caravanId: cA.id })).status, 403, 'not their caravan');
  assert.equal((await call(mMulti, 'POST', `/chat/spaces/${arena.id}/messages`, { body: 'اثر کاروان د', threadRootId: topic.messageId, attachmentIds: [fileM.id], caravanId: cD.id })).status, 201);
  assert.ok(await prisma.interGroupEntry.findFirst({ where: { challengeId: id, caravanId: cD.id } }), 'D delivered, not C');
  assert.equal(await prisma.interGroupEntry.count({ where: { challengeId: id, caravanId: cC.id } }), 0);
  assert.equal((await call(mMulti, 'GET', `/chat/intergroup/${id}/tiers`)).status, 400, 'tiers too need the caravan');
  await call(mB, 'POST', `/chat/intergroup/${id}/entry`, { body: 'اثر ب' });

  const thread = async who => (await call(who, 'GET', `/chat/spaces/${arena.id}/messages?threadRootId=${topic.messageId}`)).body.messages.map(m => m.id);
  assert.ok(!(await thread(mB)).includes(subA.body.id), 'a rival mentor does not see the work');
  assert.ok(!(await thread(b1)).includes(subA.body.id), 'nor a rival student');
  assert.ok((await thread(a1)).includes(subA.body.id), 'its own caravan does');
  assert.ok((await thread(admin)).includes(subA.body.id), 'the admin does');
  assert.ok((await thread(support)).includes(subA.body.id), 'support does');
  assert.equal((await call(mB, 'POST', `/chat/messages/${subA.body.id}/reactions`, { type: 'like' })).status, 404);
  assert.equal((await call(mB, 'GET', `/chat/attachments/${fileA.id}/link`)).status, 404);
  const searched = (await call(mB, 'GET', `/chat/spaces/${arena.id}/search?q=${encodeURIComponent('اثر کاروان')}`)).body;
  assert.ok(!searched.some(m => m.id === subA.body.id), 'search hides it too');
  await call(admin, 'POST', `/admin/intergroup/${id}/start-judging`, {});
  assert.ok((await thread(mB)).includes(subA.body.id), 'visible once judging opens');
  console.log('sealed submissions OK');

  // ---- Groups: mentors create but do not delete ----
  const g = (await call(mA, 'POST', '/chat/groups', { title: 'تیم', memberIds: [a1.id] })).body;
  assert.equal((await call(mA, 'DELETE', `/chat/groups/${g.id}`)).status, 403);
  assert.equal((await call(mA, 'DELETE', `/admin/chat-manage/groups/${g.id}`)).status, 403, 'nor through the panel route');
  const asked = await call(mA, 'POST', `/chat/groups/${g.id}/deletion-request`, { reason: 'تمام شد' });
  assert.equal(asked.status, 201);
  const kase = await prisma.supportCase.findFirst({ where: { userId: mA.id } });
  assert.ok(kase && kase.subject.includes('درخواست حذف'), 'the request opened a support case');
  assert.equal((await call(support, 'DELETE', `/chat/groups/${g.id}`)).status, 200);
  console.log('group deletion OK');

  // ---- Payout: confirmed caravan sticks after a transfer, and nothing is paid unconfirmed ----
  assert.equal((await call(mA, 'PUT', `/chat/intergroup/${id}/tiers`, { tiers: { [a1.id]: 'flagbearer', [a2.id]: 'semi' } })).status, 200);
  await prisma.user.update({ where: { id: a2.id }, data: { caravanId: cB.id } });
  const bTiers = (await call(mB, 'GET', `/chat/intergroup/${id}/tiers`)).body.rows;
  assert.ok(bTiers.find(r => r.user.id === a2.id).locked, 'B sees the newcomer as confirmed by A');
  assert.equal((await call(mB, 'PUT', `/chat/intergroup/${id}/tiers`, { tiers: { [b1.id]: 'active', [a2.id]: 'tired' } })).status, 200);
  assert.equal((await prisma.interGroupMemberTier.findFirst({ where: { challengeId: id, userId: a2.id } })).caravanId, cA.id, 'B cannot take a2 over');
  assert.equal((await prisma.interGroupMemberTier.findFirst({ where: { challengeId: id, userId: a2.id } })).tier, 'semi');

  const ranking = [cA.id, cB.id, cD.id];
  const blocked = await call(admin, 'POST', `/admin/challenges/${id}/ranking`, { ranking, acceptUnconfirmed: true });
  assert.equal(blocked.status, 400, 'D is unconfirmed: no bypass');
  assert.deepEqual(blocked.body.unconfirmed, ['د']);
  await call(admin, 'PUT', `/admin/intergroup/${id}/tiers`, { caravanId: cD.id, tiers: { [d1.id]: 'companion' } });
  const done = await call(admin, 'POST', `/admin/challenges/${id}/ranking`, { ranking });
  assert.equal(done.status, 200);
  const paid = async u => (await prisma.assetTransaction.aggregate({ where: { userId: u.id, sourceId: id }, _sum: { amount: true } }))._sum.amount || 0;
  assert.equal(await paid(a1), 20000, 'gold × 100%');
  assert.equal(await paid(a2), 10000, 'gold × 50%: paid with A, the caravan they competed for');
  assert.equal(await paid(b1), 11250, 'silver × 75%');
  assert.equal(await paid(d1), 2500, 'bronze × 25%');
  console.log('payout scoping OK');

  await stop();
});
