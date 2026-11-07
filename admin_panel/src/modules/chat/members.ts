import prisma from '../../config/db';
import { logAdminAction } from '../../controllers/adminController';
import { canSee, ChatActor, loadActor } from './access';
import { handler } from './http';
import { peopleOf } from './profiles';
import { emitToSpace, refreshUserRooms } from './realtime';
import { ChatError } from './service';

/**
 * «اعضا و نقش‌ها» in the panel: put people into / take them out of a group or channel by hand, and make them
 * moderators there. Caravan and challenge groups follow the caravan by themselves, the announcements channel and the
 * mentors' room follow the role; a hand-made change is stored on ChatMember.manual ("added" | "removed") and wins over
 * those rules (access.ts canSee). Media groups hold plain member rows. Moderator is ChatMember.role = "moderator".
 */
const MANAGED_TYPES = ['announcements', 'arena', 'mentors', 'caravan', 'challenges', 'media'];
/** Spaces whose audience is a whole role / everyone: only the hand-made exceptions are listed. */
const WIDE_TYPES = new Set(['announcements', 'arena', 'mentors']);
const PERSON = { id: true, name: true, avatarUrl: true, role: true, gender: true, phoneNumber: true } as const;

function assertMayManage(actor: ChatActor) {
  const role = String(actor.role).toLowerCase();
  const admin = role === 'admin' || role === 'sub_admin';
  const manager = role === 'channel_manager' && actor.permissions.enterGroups;
  if (!admin && !manager) throw new ChatError(403, 'مدیریت اعضای گروه و کانال برای شما مجاز نیست');
}

async function spaceOf(actor: ChatActor, id: string) {
  assertMayManage(actor);
  const space = await prisma.chatSpace.findFirst({ where: { id, type: { in: MANAGED_TYPES } }, include: { caravan: { select: { name: true } } } });
  if (!space) throw new ChatError(404, 'گروه یافت نشد');
  return space;
}

async function userOrFail(userId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, isDeleted: false }, select: PERSON });
  if (!user) throw new ChatError(404, 'کاربر یافت نشد');
  return user;
}

const personJson = (u: any) => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl ?? null, role: u.role, gender: u.gender ?? null });

async function changed(space: { id: string }, userId: string) {
  await refreshUserRooms([userId]);
  emitToSpace(space.id, 'space:update', { spaceId: space.id });
}

/** GET /chat-manage/spaces/:id/members */
export const listSpaceMembers = handler(async (req, res, actor) => {
  const space = await spaceOf(actor, req.params.id);
  const rows = await prisma.chatMember.findMany({
    where: { spaceId: space.id, user: { isDeleted: false } },
    select: { userId: true, role: true, manual: true, user: { select: PERSON } },
  });
  const rowOf = new Map(rows.map(r => [r.userId, r]));
  const wide = WIDE_TYPES.has(space.type);

  let people: any[];
  if (wide) {
    people = rows.filter(r => r.manual === 'added' || r.role === 'moderator').map(r => r.user);
  } else {
    people = await peopleOf(space);
  }
  const members = people.map(p => {
    const row = rowOf.get(p.id);
    return { ...personJson(p), phoneNumber: (p as any).phoneNumber ?? row?.user.phoneNumber ?? null, spaceRole: row?.role === 'moderator' ? 'moderator' : 'member', source: row?.manual === 'added' ? 'added' : (space.type === 'media' ? 'added' : 'auto') };
  });
  const removed = rows.filter(r => r.manual === 'removed').map(r => personJson(r.user));
  res.json({
    space: { id: space.id, type: space.type, title: space.title, caravanName: space.caravan?.name ?? null },
    everyone: wide,
    members,
    removed,
  });
});

/** GET /chat-manage/spaces/:id/candidates?q= — people who can be put into the space (by name or phone). */
export const spaceMemberCandidates = handler(async (req, res, actor) => {
  const space = await spaceOf(actor, req.params.id);
  const q = String(req.query.q || '').trim();
  const users = await prisma.user.findMany({
    where: {
      isDeleted: false,
      ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { phoneNumber: { contains: q } }] } : {}),
    },
    select: PERSON,
    orderBy: { name: 'asc' },
    take: 30,
  });
  const here = new Set((await prisma.chatMember.findMany({ where: { spaceId: space.id, OR: [{ manual: 'added' }, ...(space.type === 'media' ? [{}] : [])] }, select: { userId: true } })).map(r => r.userId));
  res.json(users.filter(u => !here.has(u.id)).map(u => ({ ...personJson(u), phoneNumber: u.phoneNumber })));
});

/** POST /chat-manage/spaces/:id/members  { userId } */
export const addSpaceMember = handler(async (req, res, actor) => {
  const space = await spaceOf(actor, req.params.id);
  const user = await userOrFail(String(req.body?.userId || ''));
  if (space.type === 'media') {
    await prisma.chatMember.upsert({
      where: { spaceId_userId: { spaceId: space.id, userId: user.id } },
      update: { manual: null },
      create: { spaceId: space.id, userId: user.id },
    });
  } else {
    await prisma.chatMember.upsert({
      where: { spaceId_userId: { spaceId: space.id, userId: user.id } },
      update: { manual: 'added' },
      create: { spaceId: space.id, userId: user.id, manual: 'added' },
    });
  }
  await logAdminAction(actor.id, actor.name, 'CHAT_MEMBER_ADD', 'ChatSpace', space.id, `${user.name} ← ${space.title}`, req.ip || '');
  await changed(space, user.id);
  res.json({ success: true });
});

/** DELETE /chat-manage/spaces/:id/members/:userId — out of the space (kept out, whatever the automatic rules say). */
export const removeSpaceMember = handler(async (req, res, actor) => {
  const space = await spaceOf(actor, req.params.id);
  const user = await userOrFail(req.params.userId);
  if (String(user.role).toLowerCase() === 'admin') throw new ChatError(400, 'مدیر کل را نمی‌توان از گروه حذف کرد');
  if (space.type === 'media') {
    await prisma.chatMember.deleteMany({ where: { spaceId: space.id, userId: user.id } });
  } else {
    await prisma.chatMember.upsert({
      where: { spaceId_userId: { spaceId: space.id, userId: user.id } },
      update: { manual: 'removed', role: 'member' },
      create: { spaceId: space.id, userId: user.id, manual: 'removed' },
    });
  }
  await logAdminAction(actor.id, actor.name, 'CHAT_MEMBER_REMOVE', 'ChatSpace', space.id, `${user.name} ✕ ${space.title}`, req.ip || '');
  await changed(space, user.id);
  res.json({ success: true });
});

/** POST /chat-manage/spaces/:id/members/:userId/restore — undoes a hand-made removal (the automatic rules apply again). */
export const restoreSpaceMember = handler(async (req, res, actor) => {
  const space = await spaceOf(actor, req.params.id);
  const user = await userOrFail(req.params.userId);
  await prisma.chatMember.updateMany({ where: { spaceId: space.id, userId: user.id, manual: 'removed' }, data: { manual: null } });
  await logAdminAction(actor.id, actor.name, 'CHAT_MEMBER_RESTORE', 'ChatSpace', space.id, `${user.name} ↩ ${space.title}`, req.ip || '');
  await changed(space, user.id);
  res.json({ success: true });
});

/** PATCH /chat-manage/spaces/:id/members/:userId  { role: "member" | "moderator" } */
export const setSpaceMemberRole = handler(async (req, res, actor) => {
  const space = await spaceOf(actor, req.params.id);
  const user = await userOrFail(req.params.userId);
  const role = req.body?.role === 'moderator' ? 'moderator' : 'member';
  const row = await prisma.chatMember.findUnique({ where: { spaceId_userId: { spaceId: space.id, userId: user.id } } });
  if (role === 'moderator') {
    // only someone who is in the space can moderate it
    const target = await loadActor(user.id);
    if (!target || !canSee(target, space, !!row, row?.manual ?? null)) throw new ChatError(400, 'ابتدا این فرد را به گروه اضافه کنید');
  }
  await prisma.chatMember.upsert({
    where: { spaceId_userId: { spaceId: space.id, userId: user.id } },
    update: { role },
    create: { spaceId: space.id, userId: user.id, role },
  });
  await logAdminAction(actor.id, actor.name, 'CHAT_MEMBER_ROLE', 'ChatSpace', space.id, `${user.name} → ${role} · ${space.title}`, req.ip || '');
  await changed(space, user.id);
  res.json({ success: true, role });
});
