import prisma from '../config/db';
import { isMentorRole } from '../utils/roles';
import { refreshUserRooms } from '../modules/chat/realtime';
import { sendSystemNotification } from '../controllers/notificationController';
import { syncCaravanMemberCount } from './caravanMentor';

/**
 * The one way a person changes caravan (or leaves one) without being deleted. Everything a person owns stays on the
 * person: assets (zarik, nakh, farsh, beyragh), station progress, watch records, quiz answers, submissions and
 * certificates all hang on the user, not on the caravan, so nothing is copied or lost. What follows the caravan
 * changes at once:
 *  - the new caravan's group and challenge group appear (they follow User.caravanId) and the old ones disappear;
 *  - memberships of the old caravan's spaces (its groups and the mentor's media groups) are removed, so the person
 *    no longer sees them, is no longer notified from them and cannot be mentioned there;
 *  - private conversations with the old mentor stay readable but closed («شما دیگر عضو این کاروان نیستید»);
 *  - the open chat connections are re-synced and member counts of both caravans updated.
 * Mentors are never moved this way (they lead caravans: services/caravanMentor.ts).
 */
export async function moveToCaravan(userIds: string[], targetCaravanId: string | null, opts: { notify?: boolean } = {}) {
  const ids = Array.from(new Set(userIds.filter(Boolean).map(String)));
  const result = { moved: [] as string[], skippedMentors: [] as string[], unchanged: [] as string[] };
  if (!ids.length) return result;

  const target = targetCaravanId
    ? await prisma.caravan.findFirst({ where: { id: targetCaravanId, isDeleted: false }, select: { id: true, name: true } })
    : null;
  if (targetCaravanId && !target) throw Object.assign(new Error('کاروان مقصد یافت نشد'), { statusCode: 404 });

  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, role: true, caravanId: true } });
  const touchedCaravans = new Set<string>();
  if (target) touchedCaravans.add(target.id);

  for (const u of users) {
    if (isMentorRole(u.role)) { result.skippedMentors.push(u.id); continue; }
    if (u.caravanId === (target?.id ?? null)) { result.unchanged.push(u.id); continue; }
    const prev = u.caravanId;
    await prisma.$transaction(async tx => {
      await tx.user.update({ where: { id: u.id }, data: { caravanId: target?.id ?? null } });
      if (prev) {
        // leave every space of the old caravan (its groups, challenge group and media groups)
        await tx.chatMember.deleteMany({ where: { userId: u.id, space: { caravanId: prev } } });
      }
    });
    if (prev) touchedCaravans.add(prev);
    result.moved.push(u.id);
  }

  for (const id of touchedCaravans) await syncCaravanMemberCount(id);
  if (result.moved.length) await refreshUserRooms(result.moved).catch(e => console.error('moveToCaravan rooms error:', e));

  if (opts.notify !== false) {
    for (const id of result.moved) {
      await sendSystemNotification(
        id,
        target ? 'انتقال به کاروان جدید' : 'خروج از کاروان',
        target
          ? `شما به کاروان «${target.name}» منتقل شدید. سرمایه‌ها و پیشرفت شما بدون تغییر باقی مانده است.`
          : 'شما از کاروان خود خارج شدید. سرمایه‌ها و پیشرفت شما بدون تغییر باقی مانده است.',
        'info'
      ).catch(() => {});
    }
  }
  return result;
}
