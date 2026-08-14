import { Router } from 'express';
import { authenticateJWT, authorizeRoles } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimit';
import { login, verifyPhone, changePassword } from '../controllers/authController';
import { getMe, getMentorById, completeProfile } from '../controllers/userController';
import { evaluateMentor as newEvaluateMentor, savePrivateNote, getPrivateNotes } from '../controllers/mentorController';
import { createChallenge, getChallenges, submitQuiz } from '../controllers/challengeController';
import { submitTask, getPendingSubmissions, reviewSubmission } from '../controllers/submissionController';
import { getStations, getBookmarks, addBookmark } from '../controllers/lmsController';
import { getForms, submitForm } from '../controllers/formController';
import { getCaravanLeague, getWealthiestLeague, getMentorLeague } from '../controllers/leagueController';
import { evaluateMentor } from '../controllers/evaluationController';
import { getNotifications, markNotificationAsRead } from '../controllers/notificationController';
import { getMentorAnalytics } from '../controllers/analyticsController';
import { upload, uploadMedia, getMediaAssets } from '../controllers/mediaController';
import { getDirectMessages, getCaravanMessages, sendMessage } from '../controllers/chatController';
import { convertAssets } from '../controllers/caravanController';
import { createTicket, getTickets, replyTicket, resolveTicket } from '../controllers/supportController';
import adminRouter from './admin';

const router = Router();

// A. Auth & User Profile Routes
router.post('/auth/verify-phone', authLimiter, verifyPhone as any);
router.post('/auth/login', authLimiter, login as any);
router.post('/auth/change-password', authenticateJWT as any, changePassword as any);
router.get('/users/me', authenticateJWT as any, getMe as any);
router.get('/users/mentor/:id', authenticateJWT as any, getMentorById as any);
router.post('/users/complete-profile', authenticateJWT as any, completeProfile as any);

// B. Challenges Routes
router.post('/challenges', authenticateJWT as any, authorizeRoles('mentor', 'admin') as any, createChallenge as any);
router.get('/challenges', authenticateJWT as any, getChallenges as any);
router.post('/challenges/:id/submit-quiz', authenticateJWT as any, submitQuiz as any);

// C. Submissions Routes
router.post('/submissions', authenticateJWT as any, submitTask as any);
router.get('/submissions/pending', authenticateJWT as any, authorizeRoles('mentor') as any, getPendingSubmissions as any);
router.patch('/submissions/:id/review', authenticateJWT as any, authorizeRoles('mentor') as any, reviewSubmission as any);

// D. Leagues Routes
router.get('/leagues/caravans', authenticateJWT as any, getCaravanLeague);
router.get('/leagues/wealthiest', authenticateJWT as any, getWealthiestLeague);
router.get('/leagues/mentors', authenticateJWT as any, getMentorLeague);

// E. Evaluations Routes
router.post('/evaluations/mentor', authenticateJWT as any, evaluateMentor as any);
router.post('/mentors/evaluate', authenticateJWT as any, newEvaluateMentor as any);
router.post('/mentors/notes', authenticateJWT as any, savePrivateNote as any);
router.get('/mentors/notes/:studentId', authenticateJWT as any, getPrivateNotes as any);

// F. Notifications Routes
router.get('/notifications', authenticateJWT as any, getNotifications as any);
router.patch('/notifications/:id/read', authenticateJWT as any, markNotificationAsRead as any);

// G. Admin CRM Routes
router.use('/admin', adminRouter);

// H. Media Routes
router.post('/media/upload', authenticateJWT as any, authorizeRoles('admin','mentor') as any, upload.single('file'), uploadMedia as any);
router.get('/media', authenticateJWT as any, authorizeRoles('admin') as any, getMediaAssets as any);

// I. LMS and Forms
router.get('/classes', authenticateJWT as any, getStations as any);
router.get('/courses', authenticateJWT as any, getStations as any);
router.get('/courses/hierarchy', authenticateJWT as any, getStations as any);
router.get('/lms/bookmarks/:sessionId', authenticateJWT as any, getBookmarks as any);
router.post('/lms/bookmarks', authenticateJWT as any, addBookmark as any);
router.get('/forms', authenticateJWT as any, getForms as any);
router.post('/forms/submit', authenticateJWT as any, submitForm as any);

// J. Chat & Messaging Routes
router.get('/chat/direct/:mentorId', authenticateJWT as any, getDirectMessages as any);
router.get('/chat/caravan/:caravanId', authenticateJWT as any, getCaravanMessages as any);
router.post('/chat/send', authenticateJWT as any, sendMessage as any);

// K. Support Tickets
router.post('/support/tickets', authenticateJWT as any, createTicket as any);
router.get('/support/tickets', authenticateJWT as any, getTickets as any);
router.post('/support/tickets/:id/reply', authenticateJWT as any, replyTicket as any);
router.patch('/support/tickets/:id/resolve', authenticateJWT as any, resolveTicket as any);

// L. Caravans & Assets
router.post('/caravans/convert-assets', authenticateJWT as any, convertAssets as any);

export default router;

