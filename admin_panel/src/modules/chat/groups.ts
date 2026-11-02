import crypto from 'crypto';
import prisma from '../../config/db';
import { logAdminAction } from '../../controllers/adminController';
import { isChannelManagerRole, isMentorRole } from '../../utils/roles';
import { ChatActor } from './access';
import { handler } from './http';
import { emitToSpace, refreshUserRooms } from './realtime';
import { ChatError } from './service';

const isAdmin = (a: ChatActor) => ['admin', 'sub_admin'].includes(String(a.role).toLowerCase());

/** Mentors run the groups of their own caravans; channel managers and admins run all of them. */
function canManageGroup(a: ChatActor, caravanId: string | null): boolean {
  if (isAdmin(a)) return true;
  if (isChannelManagerRole(a.role)) return a.permissions.enterGroups;
  return isMentorRole(a.role) && !!caravanId && a.mentoredCaravanIds.includes(caravanId);
}

async function requireGroup(actor: ChatActor, id: string) {
  const group = await prisma.chatSpace.findFirst({ where: { id, type: 'media' } });
  if (!group) throw new ChatError(404, 'گروه یافت نشد');
  if (!canManageGroup(actor, group.caravanId)) throw new ChatError(403, 'مدیریت این گروه برای شما مجاز نیست');
  return group;
}

/** Only people who belong with the group: a caravan group holds that caravan's members. */
async function validMembers(caravanId: string | null, ids: string[]): Promise<string[]> {
  const unique = Array.from(new Set(ids));
  const users = await prisma.user.findMany({
    where: { id: { in: unique }, ...(caravanId ? { caravanId, role: 'student' } : {}) },
    select: { id: true },
  });
  if (users.length !== unique.length) throw new ChatError(400, 'یکی از اعضای انتخاب‌شده معتبر نیست');
  return unique;
}

const groupJson = (g: any) => ({
  id: g.id, title: g.title, caravanId: g.caravanId, caravanName: g.caravan?.name ?? null,
  members: g.members?.map((m: any) => m.user) ?? [],
});

const include = {
  caravan: { select: { name: true } },
  members: { select: { user: { select: { id: true, name: true, avatarUrl: true, role: true, gender: true } } } },
};

export const listGroups = handler(async (_req, res, actor) => {
  const scope = isAdmin(actor) || isChannelManagerRole(actor.role) ? {} : { caravanId: { in: actor.mentoredCaravanIds } };
  if (!isAdmin(actor) && !isMentorRole(actor.role) && !(isChannelManagerRole(actor.role) && actor.permissions.enterGroups)) {
    throw new ChatError(403, 'مدیریت گروه برای شما مجاز نیست');
  }
  const groups = await prisma.chatSpace.findMany({ where: { type: 'media', ...scope }, include, orderBy: { createdAt: 'desc' } });
  res.json(groups.map(groupJson));
});

/** People who can be put in a group the caller runs. */
export const groupCandidates = handler(async (req, res, actor) => {
  const caravanId = req.query.caravanId ? String(req.query.caravanId) : (actor.mentoredCaravanIds[0] ?? null);
  if (!canManageGroup(actor, caravanId)) throw new ChatError(403, 'مدیریت گروه برای شما مجاز نیست');
  const people = await prisma.user.findMany({
    where: caravanId ? { caravanId, role: 'student' } : { role: { in: ['student', 'mentor'] } },
    select: { id: true, name: true, avatarUrl: true, role: true, gender: true },
    orderBy: { name: 'asc' },
    take: 500,
  });
  res.json(people);
});

/** Body: { title, caravanId?, memberIds }. */
export const createGroup = handler(async (req, res, actor) => {
  const title = String(req.body?.title || '').trim().slice(0, 60);
  if (!title) throw new ChatError(400, 'نام گروه الزامی است');
  const caravanId = req.body?.caravanId ? String(req.body.caravanId) : (isMentorRole(actor.role) ? actor.mentoredCaravanIds[0] ?? null : null);
  if (!canManageGroup(actor, caravanId)) throw new ChatError(403, 'ساخت گروه برای این کاروان مجاز نیست');
  const members = await validMembers(caravanId, Array.isArray(req.body?.memberIds) ? req.body.memberIds.map(String) : []);

  const group = await prisma.chatSpace.create({
    data: {
      key: `media:${crypto.randomUUID()}`, type: 'media', title, caravanId,
      members: { create: [...new Set([actor.id, ...members])].map(userId => ({ userId })) },
    },
    include,
  });
  await refreshUserRooms([actor.id, ...members]);
  res.status(201).json(groupJson(group));
});

export const renameGroup = handler(async (req, res, actor) => {
  const group = await requireGroup(actor, req.params.id);
  const title = String(req.body?.title || '').trim().slice(0, 60);
  if (!title) throw new ChatError(400, 'نام گروه الزامی است');
  const updated = await prisma.chatSpace.update({ where: { id: group.id }, data: { title }, include });
  emitToSpace(group.id, 'space:update', { spaceId: group.id });
  res.json(groupJson(updated));
});

export const addGroupMembers = handler(async (req, res, actor) => {
  const group = await requireGroup(actor, req.params.id);
  const ids = await validMembers(group.caravanId, Array.isArray(req.body?.memberIds) ? req.body.memberIds.map(String) : []);
  await prisma.chatMember.createMany({ data: ids.map(userId => ({ spaceId: group.id, userId })), skipDuplicates: true });
  await refreshUserRooms(ids);
  emitToSpace(group.id, 'space:update', { spaceId: group.id });
  res.json({ success: true });
});

export const removeGroupMember = handler(async (req, res, actor) => {
  const group = await requireGroup(actor, req.params.id);
  await prisma.chatMember.deleteMany({ where: { spaceId: group.id, userId: req.params.userId } });
  await refreshUserRooms([req.params.userId]);
  emitToSpace(group.id, 'space:update', { spaceId: group.id });
  res.json({ success: true });
});

/** Deleting removes the group and its messages for everyone, so it goes in the audit log. */
export const deleteGroup = handler(async (req, res, actor) => {
  const group = await requireGroup(actor, req.params.id);
  const members = await prisma.chatMember.findMany({ where: { spaceId: group.id }, select: { userId: true } });
  emitToSpace(group.id, 'space:update', { spaceId: group.id });
  await prisma.chatSpace.delete({ where: { id: group.id } });
  await logAdminAction(actor.id, actor.name, 'DELETE_CHAT_GROUP', 'ChatSpace', group.id, group.title, req.ip || '');
  await refreshUserRooms(members.map(m => m.userId));
  res.json({ success: true });
});
