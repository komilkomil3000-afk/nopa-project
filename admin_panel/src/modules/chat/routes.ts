import { NextFunction, Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateJWT, AuthRequest } from '../../middleware/auth';
import { requireChatEnabled } from '../../services/chatSettings';
import * as chat from './controller';
import { createTag, archiveTag, closeTopic, listTags, reopenTopic, setFinalAnswer, toggleMark, toggleMessageTag, topicByChallenge } from './topics';
import { addGroupMembers, createGroup, deleteGroup, groupCandidates, listGroups, removeGroupMember, renameGroup, requestGroupDeletion } from './groups';
import { correctEvaluation, fileObjection, getEvaluation, myReport, payEvaluation, resolveObjection, saveEvaluation } from './evaluation';
import { askJudge, getTiers, judgeEntry, judgeList, myQuestions, saveTiers, submitEntry } from './intergroup';
import { exportTopic, exportTopicLink, mentorDashboard, reportMessage, serveTopicExport, topicInsight } from './reports';
import { myCases, openSupport, rateCase } from './support';
import { getTopicQuiz, submitTopicQuiz, topicQuizResults } from './quiz';
import { coverUpload, memberProfile, setSpaceCover, setSpaceSlogan, spaceMedia, spaceProfile } from './profiles';

const router = Router();

// Signed link, checked in the handler: players cannot send the auth header
router.get('/files/:id', chat.serveFile as any);
router.get('/exports/:id', serveTopicExport as any);

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
    res.status(400).json({ error: tooLarge ? 'حجم فایل نباید بیشتر از ۳۰ مگابایت باشد' : (err.message || 'فایل معتبر نیست') });
  });
}

function coverMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  coverUpload.single('file')(req as any, res as any, (err: any) => {
    if (!err) return next();
    res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'حجم عکس نباید بیشتر از ۵ مگابایت باشد' : (err.message || 'فایل معتبر نیست') });
  });
}

router.get('/status',(_req, res) => res.json({ enabled: true }));
router.get('/spaces', chat.listSpaces as any);
router.get('/caravans', chat.listCaravans as any);
router.get('/contacts', chat.listContacts as any);
router.post('/direct', chat.openDirect as any);
router.get('/spaces/:id/messages', chat.listMessages as any);
router.post('/spaces/:id/messages', sendLimiter as any, chat.sendMessage as any);
router.post('/spaces/:id/read', chat.markRead as any);
router.post('/spaces/:id/mute', chat.setMuted as any);
router.get('/spaces/:id/pins', chat.listPins as any);
router.get('/spaces/:id/search', chat.searchMessages as any);
router.get('/spaces/:id/people', chat.listPeople as any);
router.post('/spaces/:id/members/:userId/mute', chat.muteMember as any);
router.get('/spaces/:id/stations', chat.listSpaceStations as any);
router.get('/spaces/:id/profile', spaceProfile as any);
router.put('/spaces/:id/cover', coverMiddleware as any, setSpaceCover as any);
router.delete('/spaces/:id/cover', setSpaceCover as any);
router.put('/spaces/:id/slogan', setSpaceSlogan as any);
router.get('/spaces/:id/media', spaceMedia as any);
router.get('/spaces/:id/members/:userId', memberProfile as any);
router.patch('/messages/:id', chat.editMessage as any);
router.delete('/messages/:id', chat.deleteMessage as any);
router.post('/messages/:id/reactions', chat.toggleReaction as any);
router.get('/attachments/:id/link', chat.attachmentLink as any);
router.post('/messages/:id/pin', chat.togglePin as any);
router.post('/uploads', sendLimiter as any, upload as any, chat.uploadFile as any);

router.post('/messages/:id/vote', chat.votePoll as any);
router.post('/messages/:id/tags', toggleMessageTag as any);
router.post('/messages/:id/mark', toggleMark as any);
router.post('/messages/:id/report', reportMessage as any);
router.get('/spaces/:id/tags', listTags as any);
router.post('/spaces/:id/tags', createTag as any);
router.delete('/tags/:id', archiveTag as any);

router.get('/topics/by-challenge/:id', topicByChallenge as any);
router.post('/topics/:id/close', closeTopic as any);
router.post('/topics/:id/final-answer', setFinalAnswer as any);
router.post('/topics/:id/objection/resolve', resolveObjection as any);
router.post('/topics/:id/reopen', reopenTopic as any);
router.get('/topics/:id/evaluation', getEvaluation as any);
router.put('/topics/:id/evaluation', saveEvaluation as any);
router.post('/topics/:id/pay', payEvaluation as any);
router.post('/topics/:id/correct', correctEvaluation as any);
router.get('/topics/:id/my-report', myReport as any);
router.post('/topics/:id/objection', fileObjection as any);
router.get('/topics/:id/insight', topicInsight as any);
router.get('/topics/:id/quiz', getTopicQuiz as any);
router.post('/topics/:id/quiz', submitTopicQuiz as any);
router.get('/topics/:id/quiz/results', topicQuizResults as any);
router.get('/topics/:id/export', exportTopic as any);
router.post('/topics/:id/export-link', exportTopicLink as any);

router.get('/dashboard', mentorDashboard as any);

router.get('/groups', listGroups as any);
router.get('/groups/candidates', groupCandidates as any);
router.post('/groups', createGroup as any);
router.patch('/groups/:id', renameGroup as any);
router.delete('/groups/:id', deleteGroup as any);
router.post('/groups/:id/deletion-request', requestGroupDeletion as any);
router.post('/groups/:id/members', addGroupMembers as any);
router.delete('/groups/:id/members/:userId', removeGroupMember as any);

router.post('/support/open', openSupport as any);
router.get('/support/cases', myCases as any);
router.post('/support/cases/:id/rate', rateCase as any);

router.post('/intergroup/:id/entry', submitEntry as any);
router.post('/intergroup/:id/question', askJudge as any);
router.get('/intergroup/:id/questions', myQuestions as any);
router.get('/intergroup/:id/judge', judgeList as any);
router.post('/intergroup/entries/:entryId/judge', judgeEntry as any);
router.get('/intergroup/:id/tiers', getTiers as any);
router.put('/intergroup/:id/tiers', saveTiers as any);

export default router;
