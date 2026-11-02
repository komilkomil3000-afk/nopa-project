import prisma from '../../config/db';
import { ChatPermissions, DEFAULT_CHAT_PERMISSIONS, isChannelManagerRole, isMentorRole, isSubAdminRole, parseChatPermissions, ROLE_CHANNEL_MANAGER } from '../../utils/roles';

export type SpaceType = 'announcements' | 'public' | 'mentors' | 'caravan' | 'challenges' | 'media' | 'direct' | 'support';

export interface ChatActor {
  id: string;
  name: string;
  role: string;
  caravanId: string | null;
  mentoredCaravanIds: string[];
  permissions: ChatPermissions;
}

/** The fields of a space the rules read. */
export interface SpaceRef {
  id: string;
  type: string;
  caravanId: string | null;
}

export async function loadActor(userId: string): Promise<ChatActor | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, role: true, caravanId: true } });
  if (!user) return null;
  const mentored = isMentorRole(user.role)
    ? await prisma.caravan.findMany({ where: { mentorId: user.id }, select: { id: true } })
    : [];
  let permissions = DEFAULT_CHAT_PERMISSIONS;
  if (isChannelManagerRole(user.role)) {
    const row = await prisma.rolePermission.findUnique({ where: { roleName: ROLE_CHANNEL_MANAGER } });
    permissions = parseChatPermissions(row?.permissionsJson);
  }
  return { ...user, mentoredCaravanIds: mentored.map(c => c.id), permissions };
}

const isAdmin = (a: ChatActor) => String(a.role).toLowerCase() === 'admin' || isSubAdminRole(a.role);
const isManager = (a: ChatActor) => isChannelManagerRole(a.role);
const leadsCaravan = (a: ChatActor, s: SpaceRef) => !!s.caravanId && a.mentoredCaravanIds.includes(s.caravanId);

/**
 * Who sees a space. Caravan spaces follow the caravan itself, so a transfer between caravans needs no
 * sync: access moves with User.caravanId. Direct and support spaces are for their members alone.
 */
export function canSee(a: ChatActor, s: SpaceRef, isMember: boolean): boolean {
  switch (s.type as SpaceType) {
    case 'announcements':
    case 'public':
      return true;
    case 'mentors':
      return isAdmin(a) || isManager(a) || isMentorRole(a.role);
    case 'caravan':
    case 'challenges':
      return isAdmin(a) || leadsCaravan(a, s) || a.caravanId === s.caravanId || (isManager(a) && a.permissions.enterGroups);
    case 'media':
      return isMember || isAdmin(a) || leadsCaravan(a, s) || (isManager(a) && a.permissions.enterGroups);
    default:
      return isMember;
  }
}

/** Starting a conversation. Anyone who sees a space can answer inside a thread. */
export function canPostTopLevel(a: ChatActor, s: SpaceRef): boolean {
  switch (s.type as SpaceType) {
    case 'announcements':
    case 'public':
      return isAdmin(a) || (isManager(a) && a.permissions.publishChannels);
    case 'challenges':
      return isAdmin(a) || leadsCaravan(a, s);
    default:
      return true;
  }
}

/** Pin, delete others' messages, mute. Private conversations have no moderators. */
export function canModerate(a: ChatActor, s: SpaceRef): boolean {
  if (s.type === 'direct' || s.type === 'support') return false;
  return isAdmin(a) || leadsCaravan(a, s) || (isManager(a) && a.permissions.moderate);
}

/** Students talk privately with their own mentor only; staff talk to whoever they work with. */
export async function canStartDirect(a: ChatActor, otherId: string): Promise<boolean> {
  if (a.id === otherId) return false;
  const other = await prisma.user.findUnique({ where: { id: otherId }, select: { role: true, caravanId: true } });
  if (!other) return false;

  if (isAdmin(a)) return true;
  if (isMentorRole(a.role)) {
    return String(other.role).toLowerCase() === 'admin' || (!!other.caravanId && a.mentoredCaravanIds.includes(other.caravanId));
  }
  if (a.caravanId && isMentorRole(other.role)) {
    const caravan = await prisma.caravan.findFirst({ where: { id: a.caravanId, mentorId: otherId }, select: { id: true } });
    return !!caravan;
  }
  return false;
}
