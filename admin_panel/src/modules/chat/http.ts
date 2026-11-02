import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { ChatActor, loadActor } from './access';
import { ChatError, findVisibleSpace } from './service';
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
  if (!found) throw new ChatError(404, 'گفتگو یافت نشد');
  return found;
}

export async function requireMessage(actor: ChatActor, messageId: string) {
  const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  if (!message) throw new ChatError(404, 'پیام یافت نشد');
  const { space } = await requireSpace(actor, message.spaceId);
  return { message, space };
}
