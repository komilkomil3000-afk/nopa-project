const assert = require('assert');
const http = require('http');
const path = require('path');

if (!String(process.env.DATABASE_URL).includes('localhost:54329')) throw new Error('e2e suites run through tests/e2e/run.js only');

const ROOT = path.resolve(__dirname, '../..') + path.sep;
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/** Starts the real app with its socket server and gives a suite what it needs. */
async function start(port) {
  const mod = require(path.join(ROOT, 'dist/app.js'));
  const realtime = require(path.join(ROOT, 'dist/modules/chat/realtime.js'));
  const server = http.createServer(mod.default || mod.app);
  realtime.attachChatSocket(server);
  await new Promise(r => server.listen(port, r));
  const origin = `http://127.0.0.1:${port}`;
  let n = 100;

  const mk = async (role, data = {}) => {
    n += 1;
    const u = await prisma.user.create({ data: { phoneNumber: `09${String(port)}${n}`, passwordHash: 'x', name: `${role}${n}`, role, ...data } });
    const token = jwt.sign({ id: u.id, role, phoneNumber: u.phoneNumber }, process.env.JWT_SECRET);
    await prisma.userSession.create({ data: { userId: u.id, token } });
    return { ...u, token };
  };
  const call = async (who, method, p, body) => {
    const r = await fetch(`${origin}/api/v1${p}`, { method, headers: { Authorization: `Bearer ${who.token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    let parsed = text;
    try { parsed = JSON.parse(text); } catch { /* csv or html */ }
    return { status: r.status, body: parsed };
  };
  const stop = async () => {
    await realtime.closeChatSocket();
    await new Promise(r => server.close(r));
    await prisma.$disconnect();
  };
  return { origin, mk, call, stop, wait: ms => new Promise(r => setTimeout(r, ms)), realtime };
}

/** Runs a suite and exits with its result, so a hung handle cannot hide a failure. */
function run(fn) {
  fn().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const hasChrome = () => require('fs').existsSync(process.env.CHROME_PATH || chrome);

module.exports = { assert, prisma, ROOT, start, run, jwt, chromePath: process.env.CHROME_PATH || chrome, hasChrome };
