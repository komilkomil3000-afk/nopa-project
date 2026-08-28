"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const rateLimit_1 = require("../middleware/rateLimit");
const authController_1 = require("../controllers/authController");
const userController_1 = require("../controllers/userController");
const mentorController_1 = require("../controllers/mentorController");
const challengeController_1 = require("../controllers/challengeController");
const submissionController_1 = require("../controllers/submissionController");
const lmsController_1 = require("../controllers/lmsController");
const formController_1 = require("../controllers/formController");
const calendarController_1 = require("../controllers/calendarController");
const leagueController_1 = require("../controllers/leagueController");
const evaluationController_1 = require("../controllers/evaluationController");
const notificationController_1 = require("../controllers/notificationController");
const newsController_1 = require("../controllers/newsController");
const bannerController_1 = require("../controllers/bannerController");
const mediaController_1 = require("../controllers/mediaController");
const chatController_1 = require("../controllers/chatController");
const caravanController_1 = require("../controllers/caravanController");
const supportController_1 = require("../controllers/supportController");
const certificateController_1 = require("../controllers/certificateController");
const mentorWorkspaceController_1 = require("../controllers/mentorWorkspaceController");
const admin_1 = __importDefault(require("./admin"));
const router = (0, express_1.Router)();
// A. Auth & User Profile Routes
router.use('/auth', rateLimit_1.authLimiter);
router.post('/auth/verify-phone', authController_1.verifyPhone);
router.post('/auth/login', authController_1.login);
router.post('/auth/register', authController_1.register);
router.post('/auth/logout', auth_1.authenticateJWT, authController_1.logout);
router.post('/auth/change-password', auth_1.authenticateJWT, authController_1.changePassword);
router.get('/users/me', auth_1.authenticateJWT, userController_1.getMe);
router.get('/users/mentor/:id', auth_1.authenticateJWT, userController_1.getMentorById);
router.post('/users/complete-profile', auth_1.authenticateJWT, userController_1.completeProfile);
router.post('/certificates/:id/physical-order', auth_1.authenticateJWT, certificateController_1.requestPhysicalCertificate);
// B. Challenges Routes
router.post('/challenges', auth_1.authenticateJWT, (0, auth_1.authorizeRoles)('mentor', 'admin'), challengeController_1.createChallenge);
router.get('/challenges', auth_1.authenticateJWT, challengeController_1.getChallenges);
router.post('/challenges/:id/submit-quiz', auth_1.authenticateJWT, challengeController_1.submitQuiz);
// C. Submissions Routes
router.post('/submissions', auth_1.authenticateJWT, submissionController_1.submitTask);
router.get('/submissions/pending', auth_1.authenticateJWT, (0, auth_1.authorizeRoles)('mentor', 'admin'), submissionController_1.getPendingSubmissions);
router.patch('/submissions/:id/review', auth_1.authenticateJWT, (0, auth_1.authorizeRoles)('mentor', 'admin'), submissionController_1.reviewSubmission);
// D. Leagues Routes
router.get('/leagues/caravans', auth_1.authenticateJWT, leagueController_1.getCaravanLeague);
router.get('/leagues/wealthiest', auth_1.authenticateJWT, leagueController_1.getWealthiestLeague);
router.get('/leagues/mentors', auth_1.authenticateJWT, leagueController_1.getMentorLeague);
// E. Evaluations Routes
router.post('/evaluations/mentor', auth_1.authenticateJWT, evaluationController_1.evaluateMentor);
router.post('/mentors/evaluate', auth_1.authenticateJWT, mentorController_1.evaluateMentor);
router.post('/mentors/notes', auth_1.authenticateJWT, mentorController_1.savePrivateNote);
router.get('/mentors/notes/:studentId', auth_1.authenticateJWT, mentorController_1.getPrivateNotes);
// F. Notifications Routes
router.get('/notifications', auth_1.authenticateJWT, notificationController_1.getNotifications);
router.patch('/notifications/:id/read', auth_1.authenticateJWT, notificationController_1.markNotificationAsRead);
// G. Public/Misc Routes
router.get('/news', auth_1.authenticateJWT, newsController_1.getNews);
router.get('/banners', auth_1.authenticateJWT, bannerController_1.getBanners);
// H. Admin CRM Routes
router.use('/admin', admin_1.default);
// H. Media Routes
router.post('/media/upload', auth_1.authenticateJWT, (0, auth_1.authorizeRoles)('admin', 'mentor'), mediaController_1.upload.single('file'), mediaController_1.uploadMedia);
router.get('/media', auth_1.authenticateJWT, (0, auth_1.authorizeRoles)('admin'), mediaController_1.getMediaAssets);
// I. LMS and Forms
router.get('/lms/stations', auth_1.authenticateJWT, lmsController_1.getStations);
router.get('/courses', auth_1.authenticateJWT, lmsController_1.getStations);
router.get('/courses/hierarchy', auth_1.authenticateJWT, lmsController_1.getStations);
router.get('/lms/bookmarks/:sessionId', auth_1.authenticateJWT, lmsController_1.getBookmarks);
router.post('/lms/bookmarks', auth_1.authenticateJWT, lmsController_1.addBookmark);
router.post('/lms/sessions/:id/heartbeat', auth_1.authenticateJWT, lmsController_1.heartbeatSessionWatch);
router.get('/lms/user-progress', auth_1.authenticateJWT, lmsController_1.getUserProgress);
router.post('/lms/clips/:clipId/watched', auth_1.authenticateJWT, lmsController_1.markClipWatched);
router.get('/lms/sessions/:id/progress', auth_1.authenticateJWT, lmsController_1.getSessionWatchProgress);
router.post('/lms/sessions/:id/submit-quiz', auth_1.authenticateJWT, lmsController_1.submitSessionQuiz);
router.get('/forms', auth_1.authenticateJWT, formController_1.getForms);
router.post('/forms/submit', auth_1.authenticateJWT, formController_1.submitForm);
router.get('/calendar/events', auth_1.authenticateJWT, calendarController_1.getCalendarEvents);
// J. Chat & Messaging Routes
router.get('/chat/direct/:mentorId', auth_1.authenticateJWT, chatController_1.getDirectMessages);
router.get('/chat/caravan/:caravanId', auth_1.authenticateJWT, chatController_1.getCaravanMessages);
router.post('/chat/send', auth_1.authenticateJWT, chatController_1.sendMessage);
// K. Support Tickets
router.post('/support/tickets', auth_1.authenticateJWT, supportController_1.createTicket);
router.get('/support/tickets', auth_1.authenticateJWT, supportController_1.getTickets);
router.post('/support/tickets/:id/reply', auth_1.authenticateJWT, supportController_1.replyTicket);
router.patch('/support/tickets/:id/resolve', auth_1.authenticateJWT, supportController_1.resolveTicket);
// L. Caravans & Assets
router.post('/caravans/convert-assets', auth_1.authenticateJWT, caravanController_1.convertAssets);
// Mentor Workspace Routes
router.post('/mentor/challenges', auth_1.authenticateJWT, (0, auth_1.authorizeRoles)('mentor'), mentorWorkspaceController_1.createMentorChallenge);
router.get('/mentor/challenges', auth_1.authenticateJWT, (0, auth_1.authorizeRoles)('mentor'), mentorWorkspaceController_1.getMentorChallenges);
router.get('/mentor/challenges/:id/submissions', auth_1.authenticateJWT, (0, auth_1.authorizeRoles)('mentor'), mentorWorkspaceController_1.getChallengeSubmissions);
router.post('/mentor/submissions/:id/review', auth_1.authenticateJWT, (0, auth_1.authorizeRoles)('mentor'), mentorWorkspaceController_1.reviewChallengeSubmission);
router.get('/mentor/tickets/:id', auth_1.authenticateJWT, (0, auth_1.authorizeRoles)('mentor'), mentorWorkspaceController_1.getMentorTicketDetails);
router.post('/mentor/tickets/:id/messages', auth_1.authenticateJWT, (0, auth_1.authorizeRoles)('mentor'), mentorWorkspaceController_1.replyMentorTicket);
exports.default = router;
