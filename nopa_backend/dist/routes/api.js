"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const authController_1 = require("../controllers/authController");
const userController_1 = require("../controllers/userController");
const challengeController_1 = require("../controllers/challengeController");
const submissionController_1 = require("../controllers/submissionController");
const assignmentController_1 = require("../controllers/assignmentController");
const courseHierarchyController_1 = require("../controllers/courseHierarchyController");
const leagueController_1 = require("../controllers/leagueController");
const evaluationController_1 = require("../controllers/evaluationController");
const notificationController_1 = require("../controllers/notificationController");
const analyticsController_1 = require("../controllers/analyticsController");
const mediaController_1 = require("../controllers/mediaController");
const classController_1 = require("../controllers/classController");
const chatController_1 = require("../controllers/chatController");
const caravanController_1 = require("../controllers/caravanController");
const supportController_1 = require("../controllers/supportController");
const admin_1 = __importDefault(require("./admin"));
const router = (0, express_1.Router)();
// A. Auth & User Profile Routes
router.post('/auth/verify-phone', authController_1.verifyPhone);
router.post('/auth/login', authController_1.login);
router.post('/auth/change-password', auth_1.authenticateJWT, authController_1.changePassword);
router.get('/users/me', auth_1.authenticateJWT, userController_1.getMe);
router.get('/users/mentor/:id', auth_1.authenticateJWT, userController_1.getMentorById);
router.post('/users/complete-profile', auth_1.authenticateJWT, userController_1.completeProfile);
// B. Challenges Routes
router.post('/challenges', auth_1.authenticateJWT, (0, auth_1.authorizeRoles)('mentor', 'admin'), challengeController_1.createChallenge);
router.get('/challenges', auth_1.authenticateJWT, challengeController_1.getChallenges);
router.post('/challenges/:id/submit-quiz', auth_1.authenticateJWT, challengeController_1.submitQuiz);
// C. Submissions Routes
router.post('/submissions', auth_1.authenticateJWT, submissionController_1.submitTask);
router.get('/submissions/pending', auth_1.authenticateJWT, (0, auth_1.authorizeRoles)('mentor'), submissionController_1.getPendingSubmissions);
router.patch('/submissions/:id/review', auth_1.authenticateJWT, (0, auth_1.authorizeRoles)('mentor'), submissionController_1.reviewSubmission);
// D. Leagues Routes
router.get('/leagues/caravans', auth_1.authenticateJWT, leagueController_1.getCaravanLeague);
router.get('/leagues/wealthiest', auth_1.authenticateJWT, leagueController_1.getWealthiestLeague);
router.get('/leagues/mentors', auth_1.authenticateJWT, leagueController_1.getMentorLeague);
// E. Evaluations Routes
router.post('/evaluations/mentor', auth_1.authenticateJWT, evaluationController_1.evaluateMentor);
// F. Notifications Routes
router.get('/notifications', auth_1.authenticateJWT, notificationController_1.getNotifications);
router.patch('/notifications/:id/read', auth_1.authenticateJWT, notificationController_1.markNotificationAsRead);
// G. Admin CRM Routes
router.use('/admin', admin_1.default);
// H. Media Routes
router.post('/media/upload', auth_1.authenticateJWT, (0, auth_1.authorizeRoles)('admin'), mediaController_1.upload.single('file'), mediaController_1.uploadMedia);
router.get('/media', auth_1.authenticateJWT, (0, auth_1.authorizeRoles)('admin'), mediaController_1.getMediaAssets);
// I. Classes Routes
router.get('/classes', auth_1.authenticateJWT, classController_1.getClasses);
router.get('/courses', auth_1.authenticateJWT, courseHierarchyController_1.getCourseHierarchy);
router.get('/courses/hierarchy', auth_1.authenticateJWT, courseHierarchyController_1.getCourseHierarchy);
// H. Mentor Analytics Routes
router.get('/mentors/analytics', auth_1.authenticateJWT, (0, auth_1.authorizeRoles)('mentor'), analyticsController_1.getMentorAnalytics);
// J. Assignment Routes
router.get('/assignments', auth_1.authenticateJWT, assignmentController_1.getStudentAssignments);
router.post('/assignments/submit', auth_1.authenticateJWT, assignmentController_1.submitAssignment);
router.get('/assignments/pending', auth_1.authenticateJWT, (0, auth_1.authorizeRoles)('mentor'), assignmentController_1.getPendingAssignmentSubmissions);
router.patch('/assignments/:id/review', auth_1.authenticateJWT, (0, auth_1.authorizeRoles)('mentor'), assignmentController_1.reviewAssignmentSubmission);
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
exports.default = router;
