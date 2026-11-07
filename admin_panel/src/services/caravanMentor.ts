import prisma from '../config/db';
import { isMentorRole } from '../utils/roles';
import { refreshUserRooms } from '../modules/chat/realtime';
import { sendSystemNotification } from '../controllers/notificationController';

/**
 * Who leads a caravan is Caravan.mentorId and nothing else: every check reads it (caravan and challenge groups,
 * creating challenges, the arena, private chats with members, the mentor panel, the app's caravan screen).
 * A mentor is never a member of a caravan, so his own User.caravanId stays empty: otherwise he would show in its
 * member lists and keep seeing its groups after another mentor took it over.
 *
 * setCaravanMentor is the one place that changes the mentor of a caravan: the previous mentor leaves it, the new
 * one takes it, both mentors' open chat connections are re-synced at once and both are told in the app.
 */
export async function setCaravanMentor(caravanId: string, mentorId: string | null): Promise<{ previousMentorId: string | null }> {
  const caravan = await prisma.caravan.findUnique({ where: { id: caravanId }, select: { id: true, name: true, mentorId: true } });
  if (!caravan) return { previousMentorId: null };
  const previousMentorId = caravan.mentorId;

  await prisma.$transaction(async tx => {
    if (previousMentorId !== mentorId) await tx.caravan.update({ where: { id: caravanId }, data: { mentorId } });
    // neither mentor stays a "member" of the caravan
    const ids = [previousMentorId, mentorId].filter(Boolean) as string[];
    const mentors = (await tx.user.findMany({ where: { id: { in: ids }, caravanId }, select: { id: true, role: true } })).filter(u => isMentorRole(u.role)).map(u => u.id);
    if (mentors.length) await tx.user.updateMany({ where: { id: { in: mentors } }, data: { caravanId: null } });
  });
  if (previousMentorId === mentorId) return { previousMentorId };

  await syncCaravanMemberCount(caravanId);
  const touched = [previousMentorId, mentorId].filter(Boolean) as string[];
  await refreshUserRooms(touched).catch(e => console.error('setCaravanMentor rooms error:', e));
  if (previousMentorId) {
    await sendSystemNotification(previousMentorId, 'تغییر راهبر کاروان', `راهبری کاروان «${caravan.name}» به راهبر دیگری سپرده شد و دیگر در گروه‌ها و چالش‌های آن نیستید.`, 'alert').catch(() => {});
  }
  if (mentorId) {
    await sendSystemNotification(mentorId, 'کاروان جدید', `راهبری کاروان «${caravan.name}» به شما سپرده شد.`, 'info').catch(() => {});
  }
  return { previousMentorId };
}

/**
 * The users tab gives a person one caravan. For a mentor that means leading it: the caravan picked there before is
 * released (only if he still leads it), and he becomes the mentor of the new one, whose old mentor leaves it.
 * Other caravans given in the mentors tab are not touched. Returns true when the user is a mentor (handled here).
 */
export async function applyMentorCaravanChoice(userId: string, role: string | null | undefined, prevCaravanId: string | null, nextCaravanId: string | null): Promise<boolean> {
  if (!isMentorRole(role)) return false;
  if (prevCaravanId && prevCaravanId !== nextCaravanId) {
    const prev = await prisma.caravan.findUnique({ where: { id: prevCaravanId }, select: { mentorId: true } });
    if (prev?.mentorId === userId) await setCaravanMentor(prevCaravanId, null);
  }
  if (nextCaravanId) await setCaravanMentor(nextCaravanId, userId);
  // a mentor is never a member of a caravan; spaces of a caravan he was only a member of are left
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { caravanId: true } });
  if (me?.caravanId) {
    const leads = await prisma.caravan.findFirst({ where: { id: me.caravanId, mentorId: userId }, select: { id: true } });
    if (!leads) await prisma.chatMember.deleteMany({ where: { userId, space: { caravanId: me.caravanId } } });
    await prisma.user.update({ where: { id: userId }, data: { caravanId: null } });
    await refreshUserRooms([userId]).catch(() => {});
  }
  if (prevCaravanId) await syncCaravanMemberCount(prevCaravanId);
  return true;
}

/** Several caravans at once (mentors tab): exactly these caravans are led by the mentor afterwards. */
export async function setMentorCaravans(mentorId: string, caravanIds: string[]) {
  const wanted = new Set(caravanIds.filter(Boolean).map(String));
  const current = await prisma.caravan.findMany({ where: { mentorId }, select: { id: true } });
  for (const c of current) if (!wanted.has(c.id)) await setCaravanMentor(c.id, null);
  for (const id of wanted) await setCaravanMentor(id, mentorId);
}

/** The caravan the users tab shows for a person: the one a mentor leads, the one a student belongs to. */
export async function displayedCaravanId(user: { id: string; role: string; caravanId: string | null }): Promise<string | null> {
  if (!isMentorRole(user.role)) return user.caravanId;
  const led = await prisma.caravan.findFirst({ where: { mentorId: user.id, isDeleted: false }, select: { id: true }, orderBy: { name: 'asc' } });
  return led?.id ?? user.caravanId;
}

export async function syncCaravanMemberCount(caravanId: string) {
  const count = await prisma.user.count({ where: { caravanId } });
  await prisma.caravan.update({ where: { id: caravanId }, data: { memberCount: count } }).catch(() => {});
}
