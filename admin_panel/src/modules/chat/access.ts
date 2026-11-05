import prisma from '../../config/db';
import { ChatPermissions, DEFAULT_CHAT_PERMISSIONS, isChannelManagerRole, isMentorRole, isSubAdminRole, isSupportRole, parseChatPermissions, ROLE_CHANNEL_MANAGER } from '../../utils/roles';

export type SpaceType = 'announcements' | 'public' | 'arena' | 'mediaqa' | 'mentors' | 'caravan' | 'challenges' | 'media' | 'direct' | 'support';

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
const isSupport = (a: ChatActor) => isSupportRole(a.role);
const leadsCaravan = (a: ChatActor, s: SpaceRef) => !!s.caravanId && a.mentoredCaravanIds.includes(s.caravanId);

/** People who run the platform rather than compete in it: they may see every caravan's work at any time. */
export function isStaff(a: { role: string }): boolean {
  const r = String(a.role).toLowerCase();
  return r === 'admin' || isSubAdminRole(r) || isChannelManagerRole(r) || isSupportRole(r);
}

/** Admins and support staff can delete a group; a mentor asks for it through support. */
export function canDeleteGroup(a: ChatActor): boolean {
  return isAdmin(a) || isSupport(a) || (isManager(a) && a.permissions.enterGroups);
}

/**
 * Who sees a space. Caravan spaces follow the caravan itself, so a transfer between caravans needs no
 * sync: access moves with User.caravanId. Direct and support spaces are for their members alone.
 */
export function canSee(a: ChatActor, s: SpaceRef, isMember: boolean): boolean {
  switch (s.type as SpaceType) {
    case 'announcements':
    case 'public':
    case 'arena':
    case 'mediaqa':
      return true;
    case 'support':
      return isMember || isAdmin(a) || isSupport(a) || (isManager(a) && a.permissions.privateChats);
    case 'mentors':
      return isAdmin(a) || isManager(a) || isSupport(a) || isMentorRole(a.role);
    case 'caravan':
    case 'challenges':
      return isAdmin(a) || isSupport(a) || leadsCaravan(a, s) || a.caravanId === s.caravanId || (isManager(a) && a.permissions.enterGroups);
    case 'media':
      return isMember || isAdmin(a) || isSupport(a) || leadsCaravan(a, s) || (isManager(a) && a.permissions.enterGroups);
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
    case 'arena':
      // The arena's feed is the admin's; mentors write only inside an open cross-caravan challenge (see canReplyInArena)
      return isAdmin(a);
    case 'challenges':
      return isAdmin(a) || leadsCaravan(a, s);
    default:
      return true;
  }
}

/**
 * Answering under a message. The inter-group arena is for mentors and the admin: students and rival caravans never
 * talk directly there, and a mentor's place is the thread of an open cross-caravan challenge (canReplyInArena).
 */
export function canReply(a: ChatActor, s: SpaceRef): boolean {
  return s.type !== 'arena' || isAdmin(a) || isMentorRole(a.role);
}

/** The thread a mentor may write in: a cross-caravan challenge whose conversation is open and not yet ranked. */
export function canReplyInArena(a: ChatActor, topic: { status: string; challenge: { category: string; rankingFinalizedAt: Date | null } } | null): boolean {
  if (isAdmin(a)) return true;
  if (!isMentorRole(a.role) || !topic) return false;
  return topic.challenge.category === 'inter_group' && topic.status === 'open' && !topic.challenge.rankingFinalizedAt;
}

/** Pin, delete others' messages, mute. Private conversations have no moderators. */
export function canModerate(a: ChatActor, s: SpaceRef): boolean {
  if (s.type === 'direct' || s.type === 'support') return false;
  if (s.type === 'arena') return isAdmin(a);
  return isAdmin(a) || leadsCaravan(a, s) || (isManager(a) && a.permissions.moderate);
}

/** Tags and marks. A personal challenge lives in a private conversation, which its mentor still runs. */
export function canTag(a: ChatActor, s: SpaceRef): boolean {
  return canModerate(a, s) || (s.type === 'direct' && (isAdmin(a) || isMentorRole(a.role)));
}

/** "Enter groups" also binds a channel manager in the panel. */
export function managerMayEnter(a: ChatActor, s: { type: string }): boolean {
  if (!isManager(a) || a.permissions.enterGroups) return true;
  return !['caravan', 'challenges', 'media'].includes(s.type);
}

/** Students talk privately with their own mentor only; staff talk to whoever they work with. */
export async function canStartDirect(a: ChatActor, otherId: string): Promise<boolean> {
  if (a.id === otherId) return false;
  const other = await prisma.user.findUnique({ where: { id: otherId }, select: { role: true, caravanId: true } });
  if (!other) return false;

  if (isAdmin(a)) return true;
  if (isSupport(a)) return isMentorRole(other.role);
  if (isMentorRole(a.role)) {
    return String(other.role).toLowerCase() === 'admin' || isSupportRole(other.role) || (!!other.caravanId && a.mentoredCaravanIds.includes(other.caravanId));
  }
  if (a.caravanId && isMentorRole(other.role)) {
    const caravan = await prisma.caravan.findFirst({ where: { id: a.caravanId, mentorId: otherId }, select: { id: true } });
    return !!caravan;
  }
  return false;
}
