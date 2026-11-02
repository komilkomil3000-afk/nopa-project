import { Response } from 'express';
import prisma from '../../config/db';
import { AuthRequest } from '../../middleware/auth';
import { ChatActor } from './access';
import { handler } from './http';
import { notifyAbsent, publishMessage } from './publish';
import { refreshUserRooms } from './realtime';
import { ChatError, ensureSpace, MESSAGE_INCLUDE, serializeMessage } from './service';

const CATEGORIES: Record<string, string[]> = {
  'مالی و سرمایه': ['زریک', 'کلاف', 'قالیچه', 'پاداش', 'سرمایه'],
  'آموزش و کلاس': ['کلاس', 'ویدیو', 'آزمون', 'منزلگاه'],
  'حساب کاربری': ['رمز', 'ورود', 'حساب', 'پروفایل'],
};

/** The support bot's first sort of a new matter, by its words. Staff can see the message itself. */
export function guessCategory(text: string): string {
  for (const [category, words] of Object.entries(CATEGORIES)) {
    if (words.some(w => text.includes(w))) return category;
  }
  return 'عمومی';
}

export async function supportSpaceOf(userId: string) {
  const space = await ensureSpace(`support:${userId}`, { type: 'support', title: 'پشتیبانی نپا' });
  await prisma.chatMember.createMany({ data: [{ spaceId: space.id, userId }], skipDuplicates: true });
  return space;
}

/** A user's message opens a case unless one is already open. Staff hear about each new case. */
export async function ensureOpenCase(spaceId: string, userId: string, body: string, seq: number) {
  const open = await prisma.supportCase.findFirst({ where: { spaceId, status: { not: 'resolved' } } });
  if (open) return open;
  const created = await prisma.supportCase.create({
    data: { spaceId, userId, subject: body.slice(0, 80) || 'پیام جدید', category: guessCategory(body), fromSeq: seq },
  });
  const staff = await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } });
  if (staff.length) {
    await prisma.notification.createMany({
      data: staff.map(a => ({ userId: a.id, title: 'پرونده‌ی جدید پشتیبانی', message: created.subject, type: 'alert' })),
    });
  }
  return created;
}

export const openSupport = handler(async (_req, res, actor) => {
  const space = await supportSpaceOf(actor.id);
  await refreshUserRooms([actor.id]);
  res.json({ id: space.id });
});

export const myCases = handler(async (_req, res, actor) => {
  res.json(await prisma.supportCase.findMany({ where: { userId: actor.id }, orderBy: { createdAt: 'desc' }, take: 20 }));
});

export const rateCase = handler(async (req, res, actor) => {
  const rating = Number(req.body?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ChatError(400, 'امتیاز باید بین ۱ تا ۵ باشد');
  const done = await prisma.supportCase.updateMany({ where: { id: req.params.id, userId: actor.id, status: 'resolved' }, data: { rating } });
  if (done.count !== 1) throw new ChatError(404, 'پرونده یافت نشد');
  res.json({ rating });
});

// ---- panel ----
type StaffHandler = (req: AuthRequest, res: Response, actor: ChatActor) => Promise<unknown>;
const staff = (fn: StaffHandler) => handler(fn);

async function requireCase(id: string) {
  const found = await prisma.supportCase.findUnique({ where: { id } });
  if (!found) throw new ChatError(404, 'پرونده یافت نشد');
  return found;
}

export const listCases = staff(async (req, res) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const cases = await prisma.supportCase.findMany({
    where: { status },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { user: { select: { name: true, phoneNumber: true } } },
  });
  const assigneeIds = cases.map(c => c.assigneeId).filter((v): v is string => !!v);
  const assignees = await prisma.user.findMany({ where: { id: { in: assigneeIds } }, select: { id: true, name: true } });
  res.json(cases.map(c => ({ ...c, assigneeName: assignees.find(a => a.id === c.assigneeId)?.name || null })));
});

export const caseMessages = staff(async (req, res) => {
  const found = await requireCase(req.params.id);
  const rows = await prisma.chatMessage.findMany({ where: { spaceId: found.spaceId, seq: { gte: found.fromSeq } }, orderBy: { seq: 'asc' }, take: 200, include: MESSAGE_INCLUDE });
  res.json(rows.map(serializeMessage));
});

export const claimCase = staff(async (req, res, actor) => {
  const assigneeId = req.body?.assigneeId ? String(req.body.assigneeId) : actor.id;
  await requireCase(req.params.id);
  res.json(await prisma.supportCase.update({ where: { id: req.params.id }, data: { assigneeId, status: 'reviewing' } }));
});

export const replyCase = staff(async (req, res, actor) => {
  const found = await requireCase(req.params.id);
  const body = String(req.body?.body || '').trim();
  if (!body) throw new ChatError(400, 'متن پاسخ الزامی است');
  const { message } = await publishMessage({ spaceId: found.spaceId, senderId: actor.id, body, attachmentIds: [], mentions: [] });
  await prisma.supportCase.update({ where: { id: found.id }, data: { status: 'reviewing', assigneeId: found.assigneeId || actor.id } });
  await notifyAbsent({ id: found.spaceId, type: 'support' }, actor.id, 'پشتیبانی نپا', body, []);
  res.status(201).json(message);
});

export const resolveCase = staff(async (req, res, actor) => {
  const found = await requireCase(req.params.id);
  const updated = await prisma.supportCase.update({ where: { id: found.id }, data: { status: 'resolved', resolvedAt: new Date(), assigneeId: found.assigneeId || actor.id } });
  await notifyAbsent({ id: found.spaceId, type: 'support' }, actor.id, 'پشتیبانی نپا', 'پرونده‌ی شما بسته شد. لطفاً به پاسخ پشتیبانی امتیاز بدهید.', []);
  res.json(updated);
});

