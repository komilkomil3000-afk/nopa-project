import jwt from 'jsonwebtoken';
import prisma from '../../config/db';
import { getJwtSecret } from '../../config/secrets';
import { AuthRequest } from '../../middleware/auth';
import { ChatActor, loadActor, managerMayEnter } from './access';
import { canUseChat, getChatSettings } from '../../services/chatSettings';
import { logAdminAction } from '../../controllers/adminController';
import { handler, requireMessage } from './http';
import { publishUpdate } from './publish';
import { ChatError } from './service';
import { requireTopic } from './topics';
import { buildEvaluation } from './evaluation';

// ---- abuse reports ----
export const reportMessage = handler(async (req, res, actor) => {
  const { message } = await requireMessage(actor, req.params.id);
  const reason = String(req.body?.reason || '').trim().slice(0, 300) || 'بدون توضیح';
  await prisma.chatReport.upsert({
    where: { messageId_reporterId: { messageId: message.id, reporterId: actor.id } },
    update: { reason, status: 'open' },
    create: { messageId: message.id, reporterId: actor.id, reason },
  });
  res.status(201).json({ success: true });
});

export const listReports = handler(async (_req, res) => {
  const reports = await prisma.chatReport.findMany({
    where: { status: 'open', message: { space: { type: { notIn: ['direct', 'support'] } } } },
    orderBy: { createdAt: 'desc' }, take: 100,
    include: { message: { select: { id: true, body: true, deletedAt: true, sender: { select: { name: true } }, space: { select: { title: true } } } } },
  });
  res.json(reports);
});

export const resolveReport = handler(async (req, res, actor) => {
  const report = await prisma.chatReport.findUnique({ where: { id: req.params.id } });
  if (!report) throw new ChatError(404, 'گزارش یافت نشد');
  if (req.body?.deleteMessage === true) {
    if (String(actor.role).toLowerCase() === 'channel_manager' && !actor.permissions.moderate) throw new ChatError(403, 'دسترسی مدیریت پیام برای شما فعال نیست');
    await prisma.chatMessage.update({ where: { id: report.messageId }, data: { deletedAt: new Date(), deletedBy: actor.id, pinnedAt: null } });
    await publishUpdate(report.messageId);
  }
  await prisma.chatReport.updateMany({ where: { messageId: report.messageId, status: 'open' }, data: { status: 'resolved', resolvedBy: actor.id } });
  res.json({ success: true });
});

// ---- export ----
/** Keeps a spreadsheet from running a cell as a formula, the same way the other exports do. */
export function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
const csvText = (rows: unknown[][]) => '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');

function sendExport(res: any, name: string, format: string, title: string, rows: unknown[][]) {
  if (format === 'html') {
    const esc = (v: unknown) => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    return res.send(`<!doctype html><html dir="rtl" lang="fa"><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Tahoma,sans-serif;font-size:12px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:4px;text-align:right}</style><h3>${esc(title)}</h3><table>${rows.map((r, i) => `<tr>${r.map(c => `<${i ? 'td' : 'th'}>${esc(c)}</${i ? 'td' : 'th'}>`).join('')}</tr>`).join('')}</table></html>`);
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}.csv"`);
  res.send(csvText(rows));
}

export const exportSpace = handler(async (req, res, actor) => {
  const space = await prisma.chatSpace.findFirst({ where: { id: req.params.id, type: { notIn: ['direct', 'support'] } } });
  if (!space) throw new ChatError(404, 'فضا یافت نشد');
  if (!managerMayEnter(actor, space)) throw new ChatError(403, 'دسترسی ورود به گروه‌ها برای شما فعال نیست');
  if (String(actor.role).toLowerCase() === 'channel_manager' && !actor.permissions.export) throw new ChatError(403, 'دسترسی خروجی برای شما فعال نیست');
  const from = req.query.from ? new Date(String(req.query.from)) : undefined;
  const to = req.query.to ? new Date(String(req.query.to)) : undefined;
  const messages = await prisma.chatMessage.findMany({
    where: { spaceId: space.id, deletedAt: null, createdAt: { gte: from, lte: to } },
    orderBy: { seq: 'asc' }, take: 20000,
    include: { sender: { select: { name: true } }, tags: { select: { tag: { select: { name: true } } } } },
  });
  await logAdminAction(actor.id, actor.name, 'EXPORT_CHAT', 'ChatSpace', space.id, `${messages.length} پیام`, req.ip || '');
  sendExport(res, `chat-${space.id}`, String(req.query.format || 'csv'), space.title, [
    ['تاریخ', 'فرستنده', 'متن', 'برچسب‌ها'],
    ...messages.map(m => [m.createdAt.toISOString(), m.sender?.name || 'ربات', m.body, m.tags.map(t => t.tag.name).join('، ')]),
  ]);
});

async function writeTopicExport(req: AuthRequest, res: any, actor: ChatActor) {
  const { topic, moderator } = await requireTopic(actor, req.params.id);
  if (!moderator) throw new ChatError(403, 'این بخش مخصوص راهبر است');
  const { rows } = await buildEvaluation(topic.id);
  const saved = await prisma.challengeEvaluation.findMany({ where: { topicId: topic.id } });
  const users = await prisma.user.findMany({ where: { id: { in: rows.map(r => r.userId) } }, select: { id: true, name: true } });
  await logAdminAction(actor.id, actor.name, 'EXPORT_EVALUATION', 'ChatTopic', topic.id, `${rows.length} نفر`, req.ip || '');
  sendExport(res, `evaluation-${topic.id}`, String(req.query.format || 'csv'), topic.challenge.title, [
    ['نام', 'سهم مشارکت', 'امتیاز', 'کلاف نهایی', 'دلیل', 'پرچم‌ها'],
    ...rows.map(r => {
      const s = saved.find(x => x.userId === r.userId);
      return [users.find(u => u.id === r.userId)?.name, `${r.share}%`, r.score, s?.finalNakh ?? '', s?.reason ?? '', r.flags.join('، ')];
    }),
  ]);
}

export const exportTopic = handler((req, res, actor) => writeTopicExport(req, res, actor));

/** A five-minute link for the browser, which cannot send the auth header. Bound to its asker. */
export const exportTopicLink = handler(async (req, res, actor) => {
  const { moderator } = await requireTopic(actor, req.params.id);
  if (!moderator) throw new ChatError(403, 'این بخش مخصوص راهبر است');
  const token = jwt.sign({ topic: req.params.id, user: actor.id }, getJwtSecret(), { algorithm: 'HS256', expiresIn: 300, audience: 'chat-export' });
  res.json({ url: `/api/v1/chat/exports/${req.params.id}?t=${token}` });
});

export async function serveTopicExport(req: AuthRequest, res: any) {
  try {
    const payload = jwt.verify(String(req.query.t || ''), getJwtSecret(), { algorithms: ['HS256'], audience: 'chat-export' }) as { topic?: string; user?: string };
    const actor = payload.topic === req.params.id && payload.user ? await loadActor(payload.user) : null;
    if (!actor) return res.status(403).json({ error: 'لینک معتبر نیست' });
    const account = await prisma.user.findUnique({ where: { id: actor.id }, select: { blocked: true, isDeleted: true, accountStatus: true } });
    if (!account || account.blocked || account.isDeleted || account.accountStatus === 'SUSPENDED' || !canUseChat(actor, await getChatSettings())) {
      return res.status(403).json({ error: 'لینک معتبر نیست' });
    }
    await writeTopicExport(req, res, actor);
  } catch (e) {
    res.status(e instanceof ChatError ? e.status : 403).json({ error: e instanceof ChatError ? e.message : 'لینک معتبر نیست' });
  }
}

// ---- dashboards ----
/** What a mentor should look at today, across their caravans. */
export const mentorDashboard = handler(async (_req, res, actor) => {
  const caravanIds = actor.mentoredCaravanIds;
  if (caravanIds.length === 0 && !['admin', 'sub_admin'].includes(String(actor.role).toLowerCase())) throw new ChatError(403, 'این بخش مخصوص راهبر است');
  const spaces = await prisma.chatSpace.findMany({ where: { caravanId: { in: caravanIds } }, select: { id: true } });
  const spaceIds = spaces.map(s => s.id);
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);

  const [questions, topics, pendingPay, objections, students, active] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { spaceId: { in: spaceIds }, deletedAt: null, createdAt: { lte: dayAgo }, body: { contains: '؟' }, replies: { none: {} }, threadReplies: 0 },
      orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, spaceId: true, body: true, sender: { select: { name: true } } },
    }),
    prisma.chatTopic.findMany({ where: { spaceId: { in: spaceIds }, status: 'open', challenge: { dueDate: { lte: new Date(Date.now() + 48 * 3600 * 1000) } } }, include: { challenge: { select: { title: true, dueDate: true } } }, take: 10 }),
    prisma.chatTopic.count({ where: { spaceId: { in: spaceIds }, status: 'closed' } }),
    prisma.challengeEvaluation.findMany({ where: { objectionStatus: 'pending', topic: { spaceId: { in: spaceIds } } }, select: { topicId: true, userId: true, objection: true }, take: 10 }),
    prisma.user.findMany({ where: { caravanId: { in: caravanIds }, role: 'student' }, select: { id: true, name: true } }),
    prisma.chatMessage.findMany({ where: { spaceId: { in: spaceIds }, createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } }, distinct: ['senderId'], select: { senderId: true } }),
  ]);
  const activeIds = new Set(active.map(a => a.senderId));
  res.json({
    unansweredQuestions: questions.map(q => ({ id: q.id, spaceId: q.spaceId, body: q.body.slice(0, 140), senderName: q.sender?.name || '' })),
    dueSoon: topics.map(t => ({ id: t.id, title: t.challenge.title, dueDate: t.challenge.dueDate })),
    waitingForPayment: pendingPay,
    objections,
    silentMembers: students.filter(s => !activeIds.has(s.id)).map(s => s.name),
  });
});

export const topicInsight = handler(async (req, res, actor) => {
  const { topic, moderator } = await requireTopic(actor, req.params.id);
  if (!moderator) throw new ChatError(403, 'این بخش مخصوص راهبر است');
  const insight = await prisma.topicInsight.findUnique({ where: { topicId: topic.id } });
  res.json(insight?.content ?? null);
});

/** Oversight numbers: participation per caravan, mentors side by side, and where people got stuck. */
export const chatAnalytics = handler(async (_req, res) => {
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const caravans = await prisma.caravan.findMany({ select: { id: true, name: true, mentorId: true, mentor: { select: { name: true } }, members: { where: { role: 'student' }, select: { id: true } } } });
  const spaces = await prisma.chatSpace.findMany({ where: { caravanId: { not: null } }, select: { id: true, caravanId: true } });
  const recent = await prisma.chatMessage.findMany({ where: { createdAt: { gte: weekAgo }, spaceId: { in: spaces.map(s => s.id) }, senderId: { not: null } }, select: { spaceId: true, senderId: true } });
  const paid = await prisma.challengeEvaluation.findMany({ where: { paidAt: { not: null } }, select: { finalNakh: true, topic: { select: { spaceId: true } } } });
  const confused = await prisma.chatReaction.findMany({ where: { type: { in: ['confused', 'question'] } }, select: { message: { select: { stationId: true, threadRootId: true } } } });
  const roots = await prisma.chatMessage.findMany({ where: { id: { in: confused.map(c => c.message.threadRootId).filter((v): v is string => !!v) } }, select: { id: true, stationId: true } });
  const stations = await prisma.station.findMany({ select: { id: true, title: true } });

  const perStation = new Map<string, number>();
  for (const c of confused) {
    const stationId = c.message.stationId || roots.find(r => r.id === c.message.threadRootId)?.stationId;
    if (stationId) perStation.set(stationId, (perStation.get(stationId) || 0) + 1);
  }

  res.json({
    caravans: caravans.map(c => {
      const own = new Set(spaces.filter(s => s.caravanId === c.id).map(s => s.id));
      const messages = recent.filter(m => own.has(m.spaceId));
      const activeMembers = new Set(messages.map(m => m.senderId).filter(id => c.members.some(x => x.id === id))).size;
      const nakh = paid.filter(p => own.has(p.topic.spaceId)).map(p => p.finalNakh);
      return {
        id: c.id, name: c.name, mentorName: c.mentor?.name || null, members: c.members.length,
        messages: messages.length, activeMembers,
        averageNakh: nakh.length ? Math.round((nakh.reduce((a, b) => a + b, 0) / nakh.length) * 10) / 10 : null,
        evaluated: nakh.length,
      };
    }),
    confusionByStation: Array.from(perStation.entries()).map(([id, count]) => ({ title: stations.find(s => s.id === id)?.title || id, count })).sort((a, b) => b.count - a.count),
  });
});

