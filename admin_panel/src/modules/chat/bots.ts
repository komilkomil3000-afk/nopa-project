import prisma from '../../config/db';
import { invalidateRankings, rankedStudents } from '../../services/ranking';
import fs from 'fs';
import path from 'path';
import { ChatActor, canModerate, managerMayEnter, SpaceRef } from './access';
import { handler } from './http';
import { generateInsight } from './insights';
import { publishBotMessage, publishMessage, publishUpdate } from './publish';
import { CHAT_FILES_DIR, ChatError, ensureCaravanSpaces, globalSpace } from './service';
import { syncChallengeCards } from './topics';
import { buildEvaluation, suggestedNakh } from './evaluation';

export const BOTS: Record<string, { name: string; settings?: object }> = {
  announce: { name: 'ربات اعلان', settings: { templates: [] as { title: string; body: string }[] } },
  challenge: { name: 'ربات چالش' },
  station: { name: 'ربات منزلگاه' },
  moderation: { name: 'ربات نظم', settings: { bannedWords: [] as string[] } },
  followup: { name: 'ربات پیگیری' },
  report: { name: 'ربات گزارش' },
  support: { name: 'ربات پشتیبانی' },
};

async function botRow(key: string) {
  const row = await prisma.chatBot.findUnique({ where: { key } });
  return { enabled: row?.enabled ?? true, settings: (row?.settings as any) ?? BOTS[key]?.settings ?? {} };
}

/** A banned word, or null. */
export async function blockedWord(body: string): Promise<string | null> {
  const bot = await botRow('moderation');
  if (!bot.enabled) return null;
  const list: string[] = Array.isArray(bot.settings.bannedWords) ? bot.settings.bannedWords : [];
  return list.find(w => w && body.includes(w)) ?? null;
}

/** Date and time as a mentor types them, in Iran time. */
export function parseSendAt(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{2}$/.test(time)) return null;
  const at = new Date(`${date}T${time.padStart(5, '0')}:00+03:30`);
  return Number.isNaN(at.getTime()) ? null : at;
}

/** Splits "/name rest". The names are Persian; a slash in ordinary text is left alone. */
export function parseCommand(body: string): { name: string; rest: string } | null {
  const match = /^\/(\S+)\s*([\s\S]*)$/.exec(body.trim());
  return match ? { name: match[1], rest: match[2].trim() } : null;
}

const toLatinDigits = (t: string) => t.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));

async function silentMembers(space: SpaceRef) {
  if (!space.caravanId) return [];
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const members = await prisma.user.findMany({ where: { caravanId: space.caravanId, role: 'student' }, select: { id: true, name: true } });
  const spaces = await prisma.chatSpace.findMany({ where: { caravanId: space.caravanId }, select: { id: true } });
  const active = await prisma.chatMessage.findMany({ where: { spaceId: { in: spaces.map(s => s.id) }, createdAt: { gte: since } }, distinct: ['senderId'], select: { senderId: true } });
  const ids = new Set(active.map(a => a.senderId));
  return members.filter(m => !ids.has(m.id));
}

async function spaceReport(space: SpaceRef): Promise<string> {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const rows = await prisma.chatMessage.findMany({ where: { spaceId: space.id, createdAt: { gte: since }, deletedAt: null }, select: { senderId: true, body: true, threadRootId: true, replies: { select: { id: true } } } });
  const people = new Set(rows.map(r => r.senderId).filter(Boolean));
  const open = rows.filter(r => /[؟?]/.test(r.body) && r.replies.length === 0).length;
  return `هفت روز اخیر: ${rows.length} پیام از ${people.size} نفر، ${open} پرسش بی‌پاسخ.`;
}

/** Runs a moderator's command. Returns the private answer, or null when the text is no command. */
export async function runCommand(actor: ChatActor, space: SpaceRef & { title: string }, body: string, threadRootId?: string): Promise<string | null> {
  const parsed = parseCommand(body);
  if (!parsed) return null;
  const { name, rest } = parsed;
  const commands = ['اعلان', 'زمان‌بندی', 'نظرسنجی', 'یادآوری', 'ساکت‌ها', 'گزارش', 'کند', 'بستن', 'پیش‌نویس‌ارزیابی'];
  if (!commands.includes(name)) return null;
  if (!canModerate(actor, space)) throw new ChatError(403, 'این دستور مخصوص راهبر است');
  if (String(actor.role).toLowerCase() === 'channel_manager' && !actor.permissions.useBots) throw new ChatError(403, 'دسترسی ربات‌ها برای شما فعال نیست');

  switch (name) {
    case 'اعلان':
      if (!rest) throw new ChatError(400, 'متن اعلان را بنویسید');
      await publishBotMessage({ spaceId: space.id, botKey: 'announce', body: rest });
      return 'اعلان منتشر شد.';
    case 'یادآوری':
      if (!rest) throw new ChatError(400, 'متن یادآوری را بنویسید');
      await publishBotMessage({ spaceId: space.id, botKey: 'followup', body: `یادآوری: ${rest}` });
      return 'یادآوری منتشر شد.';
    case 'زمان‌بندی': {
      const [date, time, ...words] = toLatinDigits(rest).split(/\s+/);
      const sendAt = parseSendAt(date || '', time || '');
      if (!sendAt || sendAt <= new Date() || words.length === 0) throw new ChatError(400, 'مثال: /زمان‌بندی 2026-11-20 18:30 متن پیام');
      await prisma.chatScheduledMessage.create({ data: { spaceId: space.id, body: rest.split(/\s+/).slice(2).join(' '), sendAt, createdBy: actor.id } });
      return 'پیام زمان‌بندی شد.';
    }
    case 'نظرسنجی': {
      const parts = rest.split('|').map(p => p.trim()).filter(Boolean);
      if (parts.length < 3 || parts.length > 7) throw new ChatError(400, 'مثال: /نظرسنجی سؤال | گزینه ۱ | گزینه ۲');
      await publishBotMessage({ spaceId: space.id, botKey: 'announce', kind: 'poll', body: parts[0], meta: { question: parts[0], options: parts.slice(1) } });
      return 'نظرسنجی منتشر شد.';
    }
    case 'ساکت‌ها': {
      const silent = await silentMembers(space);
      return silent.length ? `بدون پیام در هفت روز اخیر: ${silent.map(s => s.name).join('، ')}` : 'همه‌ی اعضا در هفت روز اخیر فعال بوده‌اند.';
    }
    case 'گزارش':
      return spaceReport(space);
    case 'کند': {
      const seconds = Number(toLatinDigits(rest));
      if (!Number.isInteger(seconds) || seconds < 0 || seconds > 3600) throw new ChatError(400, 'مثال: /کند 30 (و برای خاموش کردن: /کند 0)');
      await prisma.chatSpace.update({ where: { id: space.id }, data: { slowSeconds: seconds } });
      return seconds ? `حالت کند: هر ${seconds} ثانیه یک پیام.` : 'حالت کند خاموش شد.';
    }
    case 'بستن':
    case 'پیش‌نویس‌ارزیابی': {
      const topic = threadRootId ? await prisma.chatTopic.findUnique({ where: { messageId: threadRootId } }) : null;
      if (!topic) throw new ChatError(400, 'این دستور را داخل گفتگوی یک چالش بنویسید');
      if (name === 'بستن') {
        await prisma.chatTopic.updateMany({ where: { id: topic.id, status: 'open' }, data: { status: 'closed', closedAt: new Date(), closedBy: actor.id } });
        await publishUpdate(topic.messageId);
        await generateInsight(topic.id).catch(e => console.error('generateInsight error:', e));
        return 'چالش بسته شد.';
      }
      const { rows, topic: full } = await buildEvaluation(topic.id);
      const lines = rows.map(r => `${r.share}٪ → ${suggestedNakh(r.score, full.challenge.rewardMin, full.challenge.rewardMax)} کلاف`);
      return rows.length ? `پیش‌نویس ${rows.length} نفر: ${lines.join('، ')}. جزئیات در اطلاعات چت.` : 'هنوز شرکت‌کننده‌ای وجود ندارد.';
    }
  }
  return null;
}

// ---- the minute worker ----

function stationIsOpen(s: { isLocked: boolean; status: string; scheduledUnlockTime: Date | null }, now: Date) {
  return !s.isLocked && s.status !== 'locked' && (!s.scheduledUnlockTime || s.scheduledUnlockTime <= now);
}

async function targetSpaces(station: { targetCaravansJson: string | null }) {
  let ids: string[] = [];
  try { ids = JSON.parse(station.targetCaravansJson || '[]'); } catch { /* treated as all caravans */ }
  if (!Array.isArray(ids) || ids.length === 0) return [(await globalSpace('announcements')).id];
  const out = [];
  for (const id of ids) {
    await ensureCaravanSpaces(String(id));
    out.push((await prisma.chatSpace.findUniqueOrThrow({ where: { key: `caravan:${id}` } })).id);
  }
  return out;
}

/** True the first time only: the key's insert fails afterwards. */
async function firstTime(key: string): Promise<boolean> {
  const done = await prisma.stationEvent.createMany({ data: [{ key }], skipDuplicates: true });
  return done.count === 1;
}

async function closeStationBooks(stationId: string) {
  // the market's «برترین‌ها» order, freshly computed (not a few-seconds-old cached copy)
  invalidateRankings();
  const ranked = await rankedStudents();
  await prisma.stationReport.createMany({ data: ranked.map((r, i) => ({ stationId, userId: r.id, capital: r.capital, rank: i + 1 })), skipDuplicates: true });
  const station = await prisma.station.findUnique({ where: { id: stationId }, select: { title: true } });
  await prisma.notification.createMany({
    data: ranked.map((r, i) => ({ userId: r.id, title: 'کارنامه‌ی منزلگاه', message: `در پایان «${station?.title}» رتبه‌ی شما ${i + 1} با سرمایه‌ی ${r.capital.toLocaleString('fa-IR')} زریک است.`, type: 'reward' })),
  });
}

export async function runStationEvents(now = new Date()): Promise<void> {
  const stations = await prisma.station.findMany({ orderBy: { orderIndex: 'asc' } });
  // First run ever: what is already open has been announced some other way
  if (await firstTime('baseline')) {
    await prisma.stationEvent.createMany({ data: stations.filter(s => stationIsOpen(s, now)).map(s => ({ key: `opened:${s.id}` })), skipDuplicates: true });
  }
  const { enabled } = await botRow('station');

  for (let i = 0; i < stations.length; i++) {
    const station = stations[i];
    const previous = stations[i - 1];
    if (stationIsOpen(station, now)) {
      if (!(await firstTime(`opened:${station.id}`))) continue;
      if (enabled) {
        const meta = { stationId: station.id, title: station.title, subtitle: station.subtitle, stayDuration: station.stayDuration, description: station.description?.slice(0, 300) };
        for (const spaceId of await targetSpaces(station)) {
          await publishBotMessage({ spaceId, botKey: 'station', kind: 'station', stationId: station.id, body: `منزلگاه «${station.title}» باز شد`, meta });
        }
      }
      if (previous && (await firstTime(`report:${previous.id}`))) await closeStationBooks(previous.id);
    } else if (enabled && station.scheduledUnlockTime && previous) {
      const left = station.scheduledUnlockTime.getTime() - now.getTime();
      if (left > 0 && left <= 72 * 3600 * 1000 && (await firstTime(`closing:${previous.id}`))) {
        const open = await prisma.chatTopic.count({ where: { status: { in: ['open', 'closed'] }, challenge: { stationId: previous.id } } });
        const mentors = await globalSpace('mentors');
        await publishBotMessage({ spaceId: mentors.id, botKey: 'station', stationId: previous.id, body: `منزلگاه «${station.title}» تا ۷۲ ساعت دیگر باز می‌شود. ${open} گفتگوی چالش در «${previous.title}» هنوز پرداخت نشده است.` });
      }
    }
  }
}

export async function runScheduledMessages(now = new Date()): Promise<void> {
  const due = await prisma.chatScheduledMessage.findMany({ where: { status: 'pending', sendAt: { lte: now } }, take: 50 });
  for (const item of due) {
    const claimed = await prisma.chatScheduledMessage.updateMany({ where: { id: item.id, status: 'pending' }, data: { status: 'sent' } });
    if (claimed.count === 1) await publishBotMessage({ spaceId: item.spaceId, botKey: 'announce', body: item.body });
  }
}

export async function runChallengeReminders(now = new Date()): Promise<void> {
  const { enabled } = await botRow('challenge');
  if (!enabled) return;
  const soon = new Date(now.getTime() + 24 * 3600 * 1000);
  const topics = await prisma.chatTopic.findMany({ where: { status: 'open', reminderSent: false, challenge: { dueDate: { gt: now, lte: soon } } }, take: 50, include: { challenge: { select: { title: true } } } });
  for (const t of topics) {
    const claimed = await prisma.chatTopic.updateMany({ where: { id: t.id, reminderSent: false }, data: { reminderSent: true } });
    if (claimed.count === 1) await publishBotMessage({ spaceId: t.spaceId, botKey: 'challenge', threadRootId: t.messageId, body: `کمتر از یک روز تا پایان مهلت «${t.challenge.title}» مانده است.` });
  }
}

/**
 * A running challenge whose card is missing somewhere gets it on the next round: never posted at all, posted to
 * only some caravans (one failed), or a caravan made after it started. Only the missing cards are posted.
 */
export async function runCardRepair(now = new Date()): Promise<void> {
  const running = await prisma.challenge.findMany({
    where: {
      rankingFinalizedAt: null,
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ dueDate: null }, { dueDate: { gt: now } }] },
      ],
    },
    select: { id: true, category: true, caravanId: true, recipientIds: true, chatTopics: { select: { spaceId: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  if (running.length === 0) return;
  // Each live caravan's challenge group; a caravan without one yet counts as missing
  const caravans = await prisma.caravan.findMany({ where: { isDeleted: false }, select: { id: true } });
  const groups = await prisma.chatSpace.findMany({ where: { key: { in: caravans.map(c => `challenges:${c.id}`) } }, select: { id: true, caravanId: true } });
  const groupOf = new Map(groups.map(g => [g.caravanId, g.id]));

  const gaps = running.filter(c => {
    const have = new Set(c.chatTopics.map(t => t.spaceId));
    if (c.category === 'individual') return have.size < c.recipientIds.length;
    if (c.caravanId) return have.size === 0;
    // For every caravan: each live caravan's group must have it
    return caravans.some(cv => { const g = groupOf.get(cv.id); return !g || !have.has(g); });
  });
  for (const c of gaps.slice(0, 10)) {
    await syncChallengeCards(c.id, { onlyMissing: true }).catch(e => console.error('runCardRepair:', e?.message || e));
  }
}

/** Uploads never attached to a message, and not kept by a competition work. */
export async function runFileCleanup(now = new Date()): Promise<void> {
  const old = new Date(now.getTime() - 24 * 3600 * 1000);
  const rows = await prisma.chatAttachment.findMany({ where: { messageId: null, createdAt: { lt: old } }, take: 200 });
  if (rows.length === 0) return;
  const kept = await prisma.interGroupEntry.findMany({ where: { fileUrl: { in: rows.map(r => r.id) } }, select: { fileUrl: true } });
  const keep = new Set(kept.map(k => k.fileUrl));
  for (const row of rows.filter(r => !keep.has(r.id))) {
    await prisma.chatAttachment.delete({ where: { id: row.id } });
    fs.unlink(path.join(CHAT_FILES_DIR, path.basename(row.storageKey)), () => undefined);
  }
}

let worker: NodeJS.Timeout | null = null;
export function startChatWorker(): void {
  const round = async () => {
    for (const job of [runScheduledMessages, runStationEvents, runChallengeReminders, runCardRepair, runFileCleanup]) {
      await job().catch(e => console.error('chat worker error:', e));
    }
  };
  worker = setInterval(round, 60 * 1000);
  worker.unref();
}
export function stopChatWorker(): void {
  if (worker) clearInterval(worker);
}

// ---- panel ----
export const listBots = handler(async (_req, res) => {
  const rows = await prisma.chatBot.findMany();
  const scheduled = await prisma.chatScheduledMessage.findMany({ where: { status: 'pending' }, orderBy: { sendAt: 'asc' }, take: 50 });
  res.json({
    bots: Object.entries(BOTS).map(([key, b]) => {
      const row = rows.find(r => r.key === key);
      return { key, name: b.name, enabled: row?.enabled ?? true, settings: row?.settings ?? b.settings ?? {} };
    }),
    scheduled,
  });
});

export const updateBot = handler(async (req, res, actor) => {
  const key = req.params.key;
  if (!BOTS[key]) throw new ChatError(404, 'ربات یافت نشد');
  if (String(actor.role).toLowerCase() === 'channel_manager' && !actor.permissions.useBots) throw new ChatError(403, 'دسترسی ربات‌ها برای شما فعال نیست');
  const data = { enabled: req.body?.enabled !== false, settings: req.body?.settings ?? BOTS[key].settings ?? {} };
  await prisma.chatBot.upsert({ where: { key }, update: data, create: { key, ...data } });
  res.json({ success: true });
});

/** Publish or schedule from the panel. Body: { spaceId, body, sendAt? }. */
export const publishFromPanel = handler(async (req, res, actor) => {
  const role = String(actor.role).toLowerCase();
  if (role === 'channel_manager' && !actor.permissions.publishChannels) throw new ChatError(403, 'دسترسی انتشار برای شما فعال نیست');
  const space = await prisma.chatSpace.findUnique({ where: { id: String(req.body?.spaceId || '') } });
  if (!space || ['direct', 'support'].includes(space.type)) throw new ChatError(404, 'فضا یافت نشد');
  if (!managerMayEnter(actor, space)) throw new ChatError(403, 'دسترسی ورود به گروه‌ها برای شما فعال نیست');
  const body = String(req.body?.body || '').trim().slice(0, 4000);
  const attachmentIds: string[] = Array.isArray(req.body?.attachmentIds) ? req.body.attachmentIds.map(String) : [];
  if (!body && attachmentIds.length === 0) throw new ChatError(400, 'متن پیام الزامی است');
  if (req.body?.sendAt && attachmentIds.length) throw new ChatError(400, 'پیام زمان‌بندی‌شده فعلاً پیوست نمی‌پذیرد');
  if (req.body?.sendAt) {
    const sendAt = new Date(req.body.sendAt);
    if (Number.isNaN(sendAt.getTime()) || sendAt <= new Date()) throw new ChatError(400, 'زمان انتشار معتبر نیست');
    await prisma.chatScheduledMessage.create({ data: { spaceId: space.id, body, sendAt, createdBy: actor.id } });
    return res.status(201).json({ scheduled: true });
  }
  await publishMessage({ spaceId: space.id, senderId: actor.id, body, attachmentIds, mentions: [], stayOutside: true });
  res.status(201).json({ scheduled: false });
});
