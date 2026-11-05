// Phase 2 of docs/specs/chat-access-matrix.md: reward authority, ranking only at the end, per-member payout in zarik
// and کلاف (base of the rank tier × participation %), split settlement messages, and corrections.
const { assert, prisma, start, run } = require('./harness');

run(async () => {
  const { mk, call, stop, wait } = await start(5098);
  const admin = await mk('admin');
  const mA = await mk('mentor'), mB = await mk('mentor'), mC = await mk('mentor');
  const cA = await prisma.caravan.create({ data: { name: 'الف', mentorId: mA.id } });
  const cB = await prisma.caravan.create({ data: { name: 'ب', mentorId: mB.id } });
  const cC = await prisma.caravan.create({ data: { name: 'ج', mentorId: mC.id } });
  const a1 = await mk('student', { caravanId: cA.id });
  const a2 = await mk('student', { caravanId: cA.id });
  const b1 = await mk('student', { caravanId: cB.id });
  const c1 = await mk('student', { caravanId: cC.id });
  await call(admin, 'PUT', '/admin/chat-settings', { mode: 'on', pilotCaravanIds: [] });
  await wait(3100);
  const paid = async (u, asset, sourceId) => (await prisma.assetTransaction.aggregate({ where: { userId: u.id, asset, ...(sourceId ? { sourceId } : {}) }, _sum: { amount: true } }))._sum.amount || 0;

  // ---- Mentor authority: a zarik group challenge is evaluated and paid in zarik from its conversation ----
  const z = await call(mA, 'POST', '/challenges', { title: 'گروهی زریکی', description: 'd', type: 'skill', rewardAssetType: 'zarik', rewardMin: 0, rewardMax: 1000, allMembers: true });
  assert.equal(z.status, 201);
  assert.equal(z.body.rewardAssetType, 'zarik');
  await wait(500);
  const zTopic = await prisma.chatTopic.findFirst({ where: { challengeId: z.body.id } });
  await call(a1, 'POST', `/chat/spaces/${zTopic.spaceId}/messages`, { body: 'پاسخ من به این چالش با دلیل و توضیح کامل', threadRootId: zTopic.messageId });
  await call(mA, 'POST', `/chat/topics/${zTopic.id}/close`);
  const ev = await call(mA, 'GET', `/chat/topics/${zTopic.id}/evaluation`);
  assert.equal(ev.body.topic.asset, 'zarik');
  assert.equal((await call(mA, 'PUT', `/chat/topics/${zTopic.id}/evaluation`, { rows: [{ userId: a1.id, status: 'flagbearer' }] })).status, 200);
  assert.equal((await call(mA, 'POST', `/chat/topics/${zTopic.id}/pay`)).status, 200);
  assert.equal(await paid(a1, 'zarik'), 1000, 'flagbearer × 1000 zarik');
  assert.equal(await paid(a1, 'nakh'), 0);
  console.log('mentor zarik challenge OK');

  // ---- Cross-caravan: ranking waits for the end ----
  const made = await call(admin, 'POST', '/challenges', { title: 'رقابت بزرگ', description: 'd', type: 'skill', caravanId: 'inter_group', dueDate: new Date(Date.now() + 864e5).toISOString() });
  const id = made.body.id;
  await wait(600);
  let board = (await call(admin, 'GET', `/admin/challenges/${id}/ranking`)).body;
  assert.equal(board.window.open, false);
  assert.deepEqual(board.rewards.zarik, { gold: 20000, silver: 15000, bronze: 10000, cloth: 2500 }, 'defaults from the money rules');
  await call(mA, 'POST', `/chat/intergroup/${id}/entry`, { body: 'اثر الف' });
  await call(mB, 'POST', `/chat/intergroup/${id}/entry`, { body: 'اثر ب' });
  await call(mA, 'PUT', `/chat/intergroup/${id}/tiers`, { tiers: { [a1.id]: 'flagbearer', [a2.id]: 'semi' } });
  await call(mB, 'PUT', `/chat/intergroup/${id}/tiers`, { tiers: { [b1.id]: 'active' } });
  await call(mC, 'PUT', `/chat/intergroup/${id}/tiers`, { tiers: { [c1.id]: 'companion' } });
  const early = await call(admin, 'POST', `/admin/challenges/${id}/ranking`, { ranking: [cB.id, cA.id] });
  assert.equal(early.status, 400, 'C has not delivered and the deadline is ahead');
  assert.ok(early.body.error.includes('پایان'));
  await call(mC, 'POST', `/chat/intergroup/${id}/entry`, { body: 'اثر ج' });
  board = (await call(admin, 'GET', `/admin/challenges/${id}/ranking`)).body;
  assert.equal(board.window.open, true, 'everyone delivered');
  assert.equal(board.window.reason, 'all_delivered');
  console.log('ranking window OK');

  // ---- The admin's reward plan, both assets ----
  const ranking = [cB.id, cA.id, cC.id];
  const bad = { zarik: { gold: 100, silver: 800, bronze: 600, cloth: 100 }, nakh: { gold: 4, silver: 3, bronze: 2, cloth: 1 } };
  assert.equal((await call(admin, 'POST', `/admin/challenges/${id}/ranking`, { ranking, rewards: bad, preview: true })).status, 400, 'lower place cannot get more');
  const rewards = { zarik: { gold: 1000, silver: 800, bronze: 600, cloth: 100 }, nakh: { gold: 4, silver: 3, bronze: 2, cloth: 1 } };
  const preview = (await call(admin, 'POST', `/admin/challenges/${id}/ranking`, { ranking, rewards, preview: true })).body;
  assert.equal(preview.total, 750 + 800 + 400 + 150);
  assert.equal(preview.totalNakh, 3 + 3 + 2 + 1);
  const done = await call(admin, 'POST', `/admin/challenges/${id}/ranking`, { ranking, rewards });
  assert.equal(done.status, 200);
  assert.equal(await paid(b1, 'zarik', id), 750, 'gold × 75%');
  assert.equal(await paid(b1, 'nakh', id), 3, 'ceil(4 × 75%)');
  assert.equal(await paid(a1, 'zarik', id), 800, 'silver × 100%');
  assert.equal(await paid(a2, 'zarik', id), 400, 'silver × 50%');
  assert.equal(await paid(a2, 'nakh', id), 2, 'ceil(3 × 50%)');
  assert.equal(await paid(c1, 'zarik', id), 150, 'bronze × 25%');
  assert.equal(await paid(c1, 'nakh', id), 1, 'ceil(2 × 25%)');
  assert.deepEqual((await prisma.challenge.findUnique({ where: { id } })).rewardPlan, rewards, 'the plan paid is kept');
  const banners = await prisma.caravanBanner.findMany({ where: { challengeId: id } });
  assert.equal(banners.find(b => b.caravanId === cB.id).tier, 'gold');
  assert.equal(banners.find(b => b.caravanId === cC.id).tier, 'bronze');
  console.log('payout in zarik and nakh OK');

  // ---- Settlement: caravans only in the arena; members only in their own caravan's group; threads closed ----
  const arenaTopic = await prisma.chatTopic.findFirst({ where: { challengeId: id, space: { key: 'arena' } } });
  const arenaNotes = await prisma.chatMessage.findMany({ where: { threadRootId: arenaTopic.messageId, botKey: 'challenge' } });
  const arenaSettle = arenaNotes.find(m => m.meta?.settlement && m.meta.scope === 'arena');
  assert.ok(arenaSettle, 'ranking posted in the arena thread');
  assert.deepEqual(arenaSettle.meta.places.map(p => p.name), ['ب', 'الف', 'ج']);
  for (const s of [a1, a2, b1, c1]) assert.ok(!arenaSettle.body.includes(s.name) && !JSON.stringify(arenaSettle.meta).includes(s.id), 'no member in the arena');
  const groupNote = async caravan => {
    const t = await prisma.chatTopic.findFirst({ where: { challengeId: id, space: { key: `challenges:${caravan.id}` } } });
    return prisma.chatMessage.findFirst({ where: { threadRootId: t.messageId, botKey: 'challenge' }, orderBy: { seq: 'desc' } });
  };
  const noteA = await groupNote(cA);
  assert.equal(noteA.meta.scope, 'caravan');
  assert.deepEqual(noteA.meta.members.map(m => m.userId).sort(), [a1.id, a2.id].sort());
  assert.ok(noteA.body.includes(a1.name) && !noteA.body.includes(b1.name), 'only its own members');
  assert.equal(noteA.meta.members.find(m => m.userId === a2.id).percent, 50);
  const chB = (await call(b1, 'GET', '/chat/spaces')).body.find(s => s.type === 'challenges');
  assert.notEqual(chB.id, noteA.spaceId);
  assert.equal((await call(b1, 'GET', `/chat/spaces/${noteA.spaceId}/messages`)).status, 404, 'a rival cannot open it');
  assert.equal((await prisma.chatTopic.findUnique({ where: { id: arenaTopic.id } })).status, 'paid', 'thread closed');
  assert.equal((await call(mA, 'POST', `/chat/spaces/${arenaTopic.spaceId}/messages`, { body: 'x', threadRootId: arenaTopic.messageId })).status, 403);
  console.log('settlement messages OK');

  // ---- Correction: only the difference moves, in both assets ----
  const raised = { zarik: { ...rewards.zarik, gold: 1200 }, nakh: rewards.nakh };
  const p2 = (await call(admin, 'PUT', `/admin/challenges/${id}/ranking`, { ranking, rewards: raised, preview: true })).body;
  assert.deepEqual([p2.increase, p2.decrease, p2.members], [150, 0, 1]);
  assert.equal((await call(admin, 'PUT', `/admin/challenges/${id}/ranking`, { ranking, rewards: raised })).status, 200);
  assert.equal(await paid(b1, 'zarik'), 900, '1200 × 75%');
  const swap = [cA.id, cB.id, cC.id];
  assert.equal((await call(admin, 'PUT', `/admin/challenges/${id}/ranking`, { ranking: swap })).status, 200, 'keeps the saved plan');
  assert.equal(await paid(a1, 'zarik'), 1000 + 1200, 'chat challenge + gold × 100%');
  assert.equal(await paid(a1, 'nakh'), 4, 'gold کلاف × 100%');
  assert.equal(await paid(b1, 'zarik'), 600, 'silver × 75%');
  assert.equal(await paid(b1, 'nakh'), 3, 'ceil(3 × 75%)');
  const corrections = await prisma.chatMessage.count({ where: { threadRootId: arenaTopic.messageId, botKey: 'challenge', kind: 'result' } });
  assert.equal(corrections, 3, 'first result + two corrections');
  console.log('corrections OK');

  await stop();
});
