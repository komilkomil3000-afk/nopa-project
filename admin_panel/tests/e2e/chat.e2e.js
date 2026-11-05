const { assert, prisma, ROOT, jwt, run, chromePath, hasChrome } = require('./harness');
const path = require('path');
const bcrypt = require('bcryptjs');
const { io } = require('socket.io-client');

run(async () => {
  const { origin, mk: mkUser, call: callApi, stop, wait: pause, realtime } = await require('./harness').start(5089);
  const base = origin + '/api/v1';
  const mk = mkUser, call = callApi, wait = pause;

  const admin = await mk('admin');
  const manager = await mk('channel_manager');
  const m1 = await mk('mentor'), m2 = await mk('mentor');
  const c1 = await prisma.caravan.create({ data: { name: 'الف', mentorId: m1.id } });
  const c2 = await prisma.caravan.create({ data: { name: 'ب', mentorId: m2.id } });
  const s1 = await mk('student', { caravanId: c1.id });
  const s2 = await mk('student', { caravanId: c1.id });
  const other = await mk('student', { caravanId: c2.id });

  await call(admin, 'PUT', '/admin/chat-settings', { mode: 'on', pilotCaravanIds: [] });
  await wait(3100);

  const space = async (who, type) => (await call(who, 'GET', '/chat/spaces')).body.find(s => s.type === type);
  const list1 = (await call(s1, 'GET', '/chat/spaces')).body;
  assert.deepEqual(list1.map(s => s.type).sort(), ['announcements', 'arena', 'caravan', 'challenges', 'support']);
  assert.equal(list1.find(s => s.type === 'caravan').title, 'الف'); console.log('student spaces OK');
  const caravan1 = list1.find(s => s.type === 'caravan');
  const announce = list1.find(s => s.type === 'announcements');
  assert.equal(announce.canPost, false);
  assert.equal((await call(other, 'GET', `/chat/spaces/${caravan1.id}/messages`)).status, 404);
  assert.equal((await call(other, 'POST', `/chat/spaces/${caravan1.id}/messages`, { body: 'x' })).status, 404); console.log('other caravan closed OK');

  // live delivery
  const connect = who => new Promise((resolve, reject) => {
    const socket = io(origin, { auth: { token: who.token }, transports: ['websocket'], reconnection: false });
    socket.events = [];
    socket.onAny((e, p) => socket.events.push([e, p]));
    socket.on('ready', () => resolve(socket));
    socket.on('connect_error', reject);
  });
  await assert.rejects(new Promise((res, rej) => { const k = io(origin, { auth: { token: 'bad' }, transports: ['websocket'], reconnection: false }); k.on('connect', res); k.on('connect_error', rej); }));
  console.log('socket refuses a bad token OK');

  // Behind nginx the socket sees the proxy's address: the blacklist must check the forwarded client IP
  await prisma.blacklist.create({ data: { type: 'ip', value: '203.0.113.9' } });
  const viaProxy = ip => new Promise((res, rej) => {
    const k = io(origin, { auth: { token: s2.token }, transports: ['websocket'], reconnection: false, forceNew: true, extraHeaders: { 'X-Forwarded-For': ip } });
    k.on('ready', () => { k.close(); res(); });
    k.on('connect_error', rej);
  });
  await assert.rejects(viaProxy('203.0.113.9'));
  await viaProxy('203.0.113.10');
  await prisma.blacklist.deleteMany({});
  console.log('socket checks the forwarded IP OK');
  const sock1 = await connect(s1), sock2 = await connect(s2), sockOther = await connect(other);

  const sent = await call(s1, 'POST', `/chat/spaces/${caravan1.id}/messages`, { body: 'سلام', clientMessageId: 'c1' });
  assert.equal(sent.status, 201); assert.equal(sent.body.seq, 1);
  await wait(250);
  assert.ok(sock2.events.some(([e, p]) => e === 'message:new' && p.body === 'سلام'));
  assert.ok(!sockOther.events.some(([e]) => e === 'message:new'), 'nothing leaks to another caravan'); console.log('live delivery, no leak OK');

  const again = await call(s1, 'POST', `/chat/spaces/${caravan1.id}/messages`, { body: 'سلام', clientMessageId: 'c1' });
  assert.equal(again.status, 200); assert.equal(again.body.id, sent.body.id);
  const race = await Promise.all([1, 2, 3, 4, 5].map(() => call(s1, 'POST', `/chat/spaces/${caravan1.id}/messages`, { body: 'x', clientMessageId: 'race' })));
  assert.equal(new Set(race.map(r => r.body.id)).size, 1); console.log('retries post once OK');
  const burst = await Promise.all(Array.from({ length: 10 }, (_, i) => call(s2, 'POST', `/chat/spaces/${caravan1.id}/messages`, { body: 'b' + i })));
  const seqs = burst.map(r => r.body.seq).sort((a, b) => a - b);
  assert.equal(new Set(seqs).size, 10); console.log('parallel messages get unique seq OK');

  assert.equal((await space(s1, 'caravan')).unread > 0, true);
  const last = (await call(s2, 'GET', `/chat/spaces/${caravan1.id}/messages`)).body.messages.at(-1);
  await call(s2, 'POST', `/chat/spaces/${caravan1.id}/read`, { seq: last.seq });
  assert.equal((await space(s2, 'caravan')).unread, 0); console.log('unread OK');

  // threads
  const thread = await call(s2, 'POST', `/chat/spaces/${caravan1.id}/messages`, { body: 'پاسخ', threadRootId: sent.body.id });
  assert.equal(thread.status, 201);
  assert.equal((await call(s1, 'POST', `/chat/spaces/${caravan1.id}/messages`, { body: 'x', threadRootId: thread.body.id })).status, 400, 'one level');
  const page = (await call(s1, 'GET', `/chat/spaces/${caravan1.id}/messages`)).body.messages;
  assert.ok(!page.some(m => m.id === thread.body.id));
  assert.equal(page.find(m => m.id === sent.body.id).threadReplies, 1);
  assert.equal((await call(s1, 'GET', `/chat/spaces/${caravan1.id}/messages?threadRootId=${sent.body.id}`)).body.messages.length, 1); console.log('threads OK');

  // announcement thread open to members, top level closed
  const post = await call(manager, 'POST', `/chat/spaces/${announce.id}/messages`, { body: 'اعلان' });
  assert.equal(post.status, 201);
  assert.equal((await call(s1, 'POST', `/chat/spaces/${announce.id}/messages`, { body: 'x' })).status, 403);
  assert.equal((await call(s1, 'POST', `/chat/spaces/${announce.id}/messages`, { body: 'سوال', threadRootId: post.body.id })).status, 201); console.log('channels OK');

  // reactions, edit, delete, pin
  const r1 = await call(s2, 'POST', `/chat/messages/${sent.body.id}/reactions`, { type: 'bravo' });
  assert.equal(r1.body.reactions.length, 1);
  assert.equal((await call(s2, 'POST', `/chat/messages/${sent.body.id}/reactions`, { type: 'bravo' })).body.reactions.length, 0);
  assert.equal((await call(s2, 'POST', `/chat/messages/${sent.body.id}/reactions`, { type: 'x' })).status, 400);
  assert.equal((await call(s2, 'PATCH', `/chat/messages/${sent.body.id}`, { body: 'x' })).status, 403);
  assert.equal((await call(s1, 'PATCH', `/chat/messages/${sent.body.id}`, { body: 'سلام دوباره' })).body.edited, true);
  assert.equal((await call(s2, 'DELETE', `/chat/messages/${sent.body.id}`)).status, 403);
  assert.equal((await call(s2, 'POST', `/chat/messages/${sent.body.id}/pin`)).status, 403);
  assert.equal((await call(m1, 'POST', `/chat/messages/${sent.body.id}/pin`)).body.pinned, true);
  assert.equal((await call(m2, 'POST', `/chat/messages/${sent.body.id}/pin`)).status, 404);
  assert.equal((await call(s1, 'GET', `/chat/spaces/${caravan1.id}/pins`)).body.length, 1);
  assert.equal((await call(s1, 'GET', `/chat/spaces/${caravan1.id}/search?q=${encodeURIComponent('دوباره')}`)).body.length, 1);
  const removed = await call(m1, 'DELETE', `/chat/messages/${burst[0].body.id}`);
  assert.equal(removed.body.deleted, true); assert.equal(removed.body.body, ''); console.log('reactions, edit, delete, pin, search OK');

  // direct
  assert.equal((await call(s1, 'POST', '/chat/direct', { userId: s2.id })).status, 403, 'no student to student');
  assert.equal((await call(s1, 'POST', '/chat/direct', { userId: m2.id })).status, 403, 'only own mentor');
  const dm = await call(s1, 'POST', '/chat/direct', { userId: m1.id });
  assert.equal(dm.status, 200);
  const dmId = dm.body.id;
  assert.equal((await call(s1, 'POST', '/chat/direct', { userId: m1.id })).body.id, dmId);
  assert.equal((await call(admin, 'GET', `/chat/spaces/${dmId}/messages`)).status, 404, 'admin cannot read private');
  assert.equal((await call(s2, 'GET', `/chat/spaces/${dmId}/messages`)).status, 404);
  await call(m1, 'POST', `/chat/spaces/${dmId}/messages`, { body: 'خصوصی' });
  await wait(200);
  assert.ok(sock1.events.some(([e, p]) => e === 'message:new' && p.body === 'خصوصی'), 'an open socket joins a new direct space');
  assert.ok(!sock2.events.some(([e, p]) => e === 'message:new' && p.body === 'خصوصی'));
  const managed = await call(admin, 'GET', `/admin/chat-manage/spaces/${dmId}/messages`);
  assert.equal(managed.status, 404, 'panel cannot read private'); console.log('direct OK');

  // absent people get a notification
  await call(s1, 'POST', `/chat/spaces/${dmId}/messages`, { body: 'به راهبر' });
  assert.equal(await prisma.notification.count({ where: { userId: m1.id, type: 'chat' } }), 1);
  assert.equal(await prisma.notification.count({ where: { userId: s1.id, type: 'chat' } }), 0); console.log('offline notification OK');

  // files
  const upload = async (who, name, bytes, spaceId) => {
    const form = new FormData();
    form.append('spaceId', spaceId);
    form.append('file', new Blob([bytes]), name);
    const r = await fetch(base + '/chat/uploads', { method: 'POST', headers: { Authorization: 'Bearer ' + who.token }, body: form });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  assert.equal((await upload(s1, 'x.exe', 'x', caravan1.id)).status, 400);
  assert.equal((await upload(other, 'a.txt', 'x', caravan1.id)).status, 404);
  assert.equal((await upload(s1, 'big.txt', Buffer.alloc(21 * 1024 * 1024), caravan1.id)).status, 400);
  const up = await upload(s1, 'نوشته.txt', 'محتوا', caravan1.id);
  assert.equal(up.status, 201); assert.equal(up.body.name, 'نوشته.txt');
  assert.equal((await call(s2, 'POST', `/chat/spaces/${caravan1.id}/messages`, { body: '', attachmentIds: [up.body.id] })).status, 400, 'another user cannot claim it');
  const withFile = await call(s1, 'POST', `/chat/spaces/${caravan1.id}/messages`, { attachmentIds: [up.body.id] });
  assert.equal(withFile.status, 201); assert.equal(withFile.body.kind, 'file');
  const fileUrl = withFile.body.attachments[0].url;
  assert.equal(await (await fetch(origin + fileUrl)).text(), 'محتوا');
  assert.equal((await fetch(origin + fileUrl.replace(/t=.*/, 't=bad'))).status, 403);
  assert.equal((await fetch(`${origin}/api/v1/chat/files/${up.body.id}`)).status, 403);
  assert.equal((await fetch(`${origin}/uploads/${await prisma.chatAttachment.findUnique({ where: { id: up.body.id } }).then(a => a.storageKey)}`)).status, 404); console.log('private files OK');

  // moved member loses access at once, on the API and the socket
  await prisma.user.update({ where: { id: s2.id }, data: { caravanId: c2.id } });
  assert.equal((await call(s2, 'GET', `/chat/spaces/${caravan1.id}/messages`)).status, 404); console.log('caravan move OK');

  // panel
  assert.equal((await call(manager, 'GET', '/admin/chat-manage/spaces')).status, 200);
  assert.equal((await call(m1, 'GET', '/admin/chat-manage/spaces')).status, 403);
  assert.equal((await call(manager, 'DELETE', `/admin/chat-manage/messages/${burst[1].body.id}`)).status, 200); console.log('panel oversight OK');

  // the switch closes live sockets
  await call(admin, 'PUT', '/admin/chat-settings', { mode: 'off', pilotCaravanIds: [] });
  await wait(400);
  assert.equal(sock1.connected, false); console.log('switch off closes sockets OK');
  assert.equal((await fetch(origin + fileUrl)).status, 403);
  sock2.close(); sockOther.close();
  await stop();
});
