import { NextFunction, Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateJWT, AuthRequest } from '../../middleware/auth';
import { requireChatEnabled } from '../../services/chatSettings';
import * as chat from './controller';

const router = Router();

// Signed link, checked in the handler: players cannot send the auth header
router.get('/files/:id', chat.serveFile as any);

// Everything else passes the login and the admin's switch first.
router.use(authenticateJWT as any);
router.use(requireChatEnabled as any);

const sendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  keyGenerator: (req) => (req as AuthRequest).user!.id,
  message: { error: 'تعداد پیام‌ها زیاد است؛ کمی صبر کنید' },
  standardHeaders: true,
  legacyHeaders: false,
});

function upload(req: AuthRequest, res: Response, next: NextFunction) {
  chat.chatUpload.single('file')(req as any, res as any, (err: any) => {
    if (!err) return next();
    const tooLarge = err.code === 'LIMIT_FILE_SIZE';
    res.status(400).json({ error: tooLarge ? 'حجم فایل نباید بیشتر از ۲۰ مگابایت باشد' : (err.message || 'فایل معتبر نیست') });
  });
}

router.get('/status', (_req, res) => res.json({ enabled: true }));
router.get('/spaces', chat.listSpaces as any);
router.get('/contacts', chat.listContacts as any);
router.post('/direct', chat.openDirect as any);
router.get('/spaces/:id/messages', chat.listMessages as any);
router.post('/spaces/:id/messages', sendLimiter as any, chat.sendMessage as any);
router.post('/spaces/:id/read', chat.markRead as any);
router.post('/spaces/:id/mute', chat.setMuted as any);
router.get('/spaces/:id/pins', chat.listPins as any);
router.get('/spaces/:id/search', chat.searchMessages as any);
router.get('/spaces/:id/people', chat.listPeople as any);
router.patch('/messages/:id', chat.editMessage as any);
router.delete('/messages/:id', chat.deleteMessage as any);
router.post('/messages/:id/reactions', chat.toggleReaction as any);
router.post('/messages/:id/pin', chat.togglePin as any);
router.post('/uploads', sendLimiter as any, upload as any, chat.uploadFile as any);

export default router;
