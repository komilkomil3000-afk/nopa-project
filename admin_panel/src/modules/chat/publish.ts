import prisma from '../../config/db';
import { emitToSpace, isOnline } from './realtime';
import { createMessage, MESSAGE_INCLUDE, NewMessage, serializeMessage } from './service';

/** Writes a message and sends it to everyone connected. */
export async function publishMessage(input: NewMessage) {
  const result = await createMessage(input);
  const message = serializeMessage(result.row);
  if (result.created) {
    emitToSpace(input.spaceId, 'message:new', message);
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
  emitToSpace(row.spaceId, 'message:update', serializeMessage(row));
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
