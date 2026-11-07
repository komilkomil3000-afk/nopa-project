import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { ChatActor, loadActor, NOT_YOUR_CARAVAN, NOT_YOUR_MENTOR } from './access';
import { isMentorRole } from '../../utils/roles';
import { ChatError, findVisibleSpace } from './service';
import { isSealedFor } from './arenaPrivacy';
import prisma from '../../config/db';

type Handler = (req: AuthRequest, res: Response, actor: ChatActor) => Promise<unknown>;

/** Loads the caller and turns a ChatError into its response. */
export function handler(fn: Handler) {
  return async (req: AuthRequest, res: Response) => {
    try {
      const actor = await loadActor(req.user!.id);
      if (!actor) return res.status(401).json({ error: 'کاربر یافت نشد' });
      await fn(req, res, actor);
    } catch (e: any) {
      if (e instanceof ChatError) return res.status(e.status).json({ error: e.message });
      console.error('chat error:', e);
      res.status(500).json({ error: 'خطای سرور در چت' });
    }
  };
}

export async function requireSpace(actor: ChatActor, spaceId: string) {
  const found = await findVisibleSpace(actor, spaceId);
  if (!found) {
    // A group of a caravan one is not in (any more) says why instead of «not found»: a mentor who no longer leads it,
    // or a member moved to another caravan
    const space = await prisma.chatSpace.findUnique({ where: { id: spaceId }, select: { type: true, caravanId: true } });
    if (space?.caravanId && ['caravan', 'challenges', 'media'].includes(space.type)) {
      if (isMentorRole(actor.role)) throw new ChatError(403, NOT_YOUR_CARAVAN);
      if (['student', 'dual'].includes(String(actor.role).toLowerCase())) throw new ChatError(403, NOT_YOUR_MENTOR);
    }
    throw new ChatError(404, 'گفتگو یافت نشد');
  }
  return found;
}

export async function requireMessage(actor: ChatActor, messageId: string) {
  const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  if (!message) throw new ChatError(404, 'پیام یافت نشد');
  const { space } = await requireSpace(actor, message.spaceId);
  // A rival's sealed work in the arena looks the same as a missing message
  if (await isSealedFor(actor, message, space.type)) throw new ChatError(404, 'پیام یافت نشد');
  return { message, space };
}
