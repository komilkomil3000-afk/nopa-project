import { Router } from 'express';
import { authenticateJWT } from '../../middleware/auth';
import { requireChatEnabled } from '../../services/chatSettings';

// Everything under /chat passes the admin's switch first.
const router = Router();
router.use(authenticateJWT as any);
router.use(requireChatEnabled as any);

router.get('/status', (_req, res) => res.json({ enabled: true }));

export default router;
