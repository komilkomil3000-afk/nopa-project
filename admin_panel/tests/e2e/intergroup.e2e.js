// Findings B1 to B7 of docs/nopa-chat-review.md.
const { assert, prisma, start, run } = require('./harness');

run(async () => {
  const { origin, mk, call, stop, wait } = await start(5093);
  const admin = await mk('admin');
  const mA = await mk('mentor'), mB = await mk('mentor');
  const cA = await prisma.caravan.create({ data: { name: 'الف', mentorId: mA.id } });
  const cB = await prisma.caravan.create({ data: { name: 'ب', mentorId: mB.id } });
  const a1 = await mk('student', { caravanId: cA.id });
  const a2 = await mk('student', { caravanId: cA.id });
  const b1 = await mk('student', { caravanId: cB.id });
  await call(admin, 'PUT', '/admin/chat-settings', { mode: 'on', pilotCaravanIds: [] });
  await wait(3100);

  const made = await call(admin, 'POST', '/challenges', { title: 'رقابت', description: 'd', type: 'skill', caravanId: 'inter_group', dueDate: new Date(Date.now() + 864e5).toISOString() });
  const id = made.body.id;
  await wait(600);

  // B7: a work can carry a file, shown without its name
  const chA = (await call(a1, 'GET', '/chat/spaces')).body.find(s => s.type === 'challenges');
  const form = new FormData();
  form.append('spaceId', chA.id);
  form.append('file', new Blob(['اثر']), 'کاروان-الف.pdf');
  const up = await (await fetch(`${origin}/api/v1/chat/uploads`, { method: 'POST', headers: { Authorization: `Bearer ${mA.token}` }, body: form })).json();
  assert.equal((await call(mB, 'POST', `/chat/intergroup/${id}/entry`, { body: 'x', attachmentId: up.id })).status, 400, 'not their file');
  await call(mA, 'POST', `/chat/intergroup/${id}/entry`, { body: 'اثر الف', attachmentId: up.id });
  await call(mB, 'POST', `/chat/intergroup/${id}/entry`, { body: 'اثر ب' });

  // B1: nobody reads a rival's work before the deadline
  assert.equal((await call(mB, 'GET', `/chat/intergroup/${id}/judge`)).status, 403);
  const entry = await prisma.interGroupEntry.findFirst({ where: { challengeId: id, caravanId: cA.id } });
  assert.equal((await call(mB, 'POST', `/chat/intergroup/entries/${entry.id}/judge`, { score: 90, strength: 'x', suggestion: 'y' })).status, 403);
  assert.equal((await call(mA, 'POST', `/admin/intergroup/${id}/start-judging`, {})).status, 403);
  assert.equal((await call(admin, 'POST', `/admin/intergroup/${id}/start-judging`, {})).status, 200);
  const list = await call(mB, 'GET', `/chat/intergroup/${id}/judge`);
  assert.equal(list.status, 200);
  assert.ok(list.body[0].fileUrl); assert.ok(!JSON.stringify(list.body).includes('کاروان-الف'));
  assert.equal((await fetch(origin + list.body[0].fileUrl)).status, 200);
  console.log('B1, B7 OK');

  // B2: a work is final once judging starts
  assert.equal((await call(mA, 'POST', `/chat/intergroup/${id}/entry`, { body: 'متن تازه' })).status, 400);
  console.log('B2 OK');

  await call(admin, 'POST', `/chat/intergroup/entries/${entry.id}/judge`, { score: 90, strength: 'روشن', suggestion: 'منبع' });

  // B3: the admin sets effort from the panel, for any caravan, even with chat off
  await call(admin, 'PUT', '/admin/chat-settings', { mode: 'off', pilotCaravanIds: [] });
  await wait(3100);
  const tiers = await call(admin, 'GET', `/admin/intergroup/${id}/tiers?caravanId=${cA.id}`);
  assert.equal(tiers.status, 200); assert.equal(tiers.body.rows.length, 2);
  assert.equal((await call(mA, 'GET', `/admin/intergroup/${id}/tiers?caravanId=${cA.id}`)).status, 403);
  console.log('B3 OK');

  // B5 + 3.5: the preview tells, and an unconfirmed caravan needs an explicit yes
  const ranking = [cA.id, cB.id];
  const preview = await call(admin, 'POST', `/admin/challenges/${id}/ranking`, { ranking, preview: true });
  assert.equal(preview.body.unconfirmed.length, 2);
  assert.equal((await call(admin, 'POST', `/admin/challenges/${id}/ranking`, { ranking })).status, 400);
  await call(admin, 'PUT', `/admin/intergroup/${id}/tiers`, { caravanId: cA.id, tiers: { [a1.id]: 'full', [a2.id]: 'inactive' } });
  await call(admin, 'PUT', `/admin/intergroup/${id}/tiers`, { caravanId: cB.id, tiers: { [b1.id]: 'partner' } });
  const after = await call(admin, 'POST', `/admin/challenges/${id}/ranking`, { ranking, preview: true });
  assert.deepEqual(after.body.unconfirmed, []);
  assert.equal(after.body.total, 20000 + 9000);
  assert.equal((await call(admin, 'POST', `/admin/challenges/${id}/ranking`, { ranking })).status, 200);
  console.log('B5 OK');

  // B6: the end of the competition closes its conversations
  await wait(200);
  assert.equal(await prisma.chatTopic.count({ where: { challengeId: id, status: 'open' } }), 0);
  console.log('B6 OK');

  // B4: without chat, whoever answered counts as fully active
  const noChat = await call(admin, 'POST', '/challenges', { title: 'بدون چت', description: 'd', type: 'skill', caravanId: 'inter_group' });
  await prisma.submission.create({ data: { challengeId: noChat.body.id, studentId: a2.id } });
  const before = (await prisma.user.findUnique({ where: { id: a2.id } })).zarikBalance;
  const beforeA1 = (await prisma.user.findUnique({ where: { id: a1.id } })).zarikBalance;
  assert.equal((await call(admin, 'POST', `/admin/challenges/${noChat.body.id}/ranking`, { ranking: [cA.id] })).status, 200);
  assert.equal((await prisma.user.findUnique({ where: { id: a2.id } })).zarikBalance, before + 20000);
  assert.equal((await prisma.user.findUnique({ where: { id: a1.id } })).zarikBalance, beforeA1, 'no answer, no prize');
  console.log('B4 OK');

  await stop();
});
