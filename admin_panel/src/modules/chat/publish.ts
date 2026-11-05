import prisma from '../../config/db';
import { sealedAudience } from './arenaPrivacy';
import { emitToSpace, emitToUsers, isOnline } from './realtime';
import { createMessage, MESSAGE_INCLUDE, NewMessage, serializeMessage } from './service';

/** Sends a live event about a message: to the whole space, or only to its audience while it is sealed. */
async function emitMessage(row: { spaceId: string; meta: unknown }, event: string, payload: unknown) {
  const audience = await sealedAudience(row);
  if (audience) emitToUsers(audience, event, payload);
  else emitToSpace(row.spaceId, event, payload);
}

/** Writes a message and sends it to everyone connected (a sealed arena submission: only to who may see it). */
export async function publishMessage(input: NewMessage) {
  const result = await createMessage(input);
  const message = serializeMessage(result.row);
  if (result.created) {
    await emitMessage(result.row, 'message:new', message);
    if (input.threadRootId) await publishUpdate(input.threadRootId);
  }
  return { message, created: result.created };
}

/** A message written by the system: a card, a reminder, a bot's answer. */
export function publishBotMessage(input: { spaceId: string; botKey: string; body: string; kind?: string; meta?: any; stationId?: string; threadRootId?: string }) {
  return publishMessage({ ...input, attachmentIds: [], mentions: [] });
}

export async function publishUpdate(messageId: string) {
  const row = await prisma.chatMessage.findUniqueOrThrow({ where: { id: messageId }, include: MESSAGE_INCLUDE });
  await emitMessage(row, 'message:update', serializeMessage(row));
  return row;
}

/** People who are offline hear about a mention or a private message through the app's notifications. */
export async function notifyAbsent(space: { id: string; type: string }, senderId: string, senderName: string, body: string, mentions: string[]) {
  const targets = new Set(mentions);
  if (space.type === 'direct' || space.type === 'support') {
    const others = await prisma.chatMember.findMany({ where: { spaceId: space.id, userId: { not: senderId } }, select: { userId: true } });
    others.forEach(o => targets.add(o.userId));
  }
  targets.delete(senderId);
  const absent = Array.from(targets).filter(id => !isOnline(id));
  if (absent.length === 0) return;
  await prisma.notification.createMany({
    data: absent.map(userId => ({ userId, title: `پیام از ${senderName}`, message: body.slice(0, 140) || 'فایل', type: 'chat' })),
  });
}
