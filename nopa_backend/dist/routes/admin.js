"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const adminController_1 = require("../controllers/adminController");
const messageController_1 = require("../controllers/messageController");
const courseHierarchyController_1 = require("../controllers/courseHierarchyController");
const courseContentController_1 = require("../controllers/courseContentController");
const chatController_1 = require("../controllers/chatController");
const exportController_1 = require("../controllers/exportController");
const securityController_1 = require("../controllers/securityController");
const caravanController_1 = require("../controllers/caravanController");
const rewardController_1 = require("../controllers/rewardController");
const notificationController_1 = require("../controllers/notificationController");
const analyticsController_1 = require("../controllers/analyticsController");
const mentorController_1 = require("../controllers/mentorController");
const studentController_1 = require("../controllers/studentController");
const router = (0, express_1.Router)();
// Apply JWT authentication and authorize only admin or mentor roles to the admin panel
router.use(auth_1.authenticateJWT);
router.use((0, auth_1.authorizeRoles)('admin'));
// 1. High-Scale User & Contact Directory
router.get('/users', adminController_1.getUsers);
router.post('/users', adminController_1.createUser);
router.put('/users/:id', adminController_1.updateUser);
router.patch('/users/:id/block', adminController_1.toggleBlockUser);
router.delete('/users/:id', adminController_1.deleteUser);
router.post('/users/:id/override-password', adminController_1.overridePasswordOrOtp);
router.get('/users/export', adminController_1.exportUsersCsv);
router.get('/users/metrics', adminController_1.getUserMetrics);
router.post('/students', studentController_1.createOrUpdateStudent);
router.post('/students/:id/adjust-balance', studentController_1.adjustBalance);
router.post('/students/:id/level-frame', studentController_1.adjustLevelFrame);
// 2. Zarik Ledger & Categorized Rewards
router.get('/rewards/ledger', adminController_1.getZarikLedger);
router.post('/rewards/adjust', adminController_1.adjustZarik);
router.get('/rewards/analytics', adminController_1.getZarikAnalytics);
router.post('/rewards/grant', rewardController_1.grantPromotionalZarik);
router.get('/rewards/stats', rewardController_1.getZarikSalesStats);
router.get('/zarik/economy-hub', adminController_1.getEconomyHub);
// 3. Role-Based Access Control (RBAC) & Security
router.get('/roles', adminController_1.getRolePermissions);
router.post('/roles', adminController_1.updateRolePermissions);
router.post('/security/revoke', securityController_1.revokeAllSessions);
router.post('/security/blacklist', securityController_1.addBlacklist);
router.delete('/security/blacklist', securityController_1.removeBlacklist);
router.get('/security/blacklist', securityController_1.getBlacklist);
// 4. Caravans & Mentors Operations Center
router.get('/caravans', adminController_1.getCaravansAdmin);
router.put('/caravans/:id/status', caravanController_1.toggleCaravanStatus);
router.post('/caravans/bulk-transfer', caravanController_1.bulkTransferMembers);
router.get('/asset-conversions', caravanController_1.getAssetConversionsAdmin);
router.post('/asset-conversions/:id/approve', caravanController_1.approveAssetConversion);
router.get('/mentors/scorecards', adminController_1.getMentorScorecards);
router.get('/mentors', mentorController_1.getMentors);
router.post('/mentors', mentorController_1.createOrUpdateMentor);
router.post('/mentors/:id/grant-stars', mentorController_1.grantFiveStars);
// 5. Educational Content & Global Announcements
router.post('/announcements/broadcast', adminController_1.createGlobalAnnouncement);
router.post('/notifications/broadcast', notificationController_1.broadcastNotification);
router.get('/notifications/templates', notificationController_1.getTemplates);
router.post('/notifications/templates', notificationController_1.createTemplate);
router.get('/notifications/overrides', notificationController_1.getOverrides);
router.post('/notifications/overrides', notificationController_1.toggleOverride);
router.get('/notifications/logs', notificationController_1.getLogs);
// 6. Analytics Dashboard
router.get('/analytics', analyticsController_1.getDashboardAnalytics);
// 7. System Audit Logs & Export Center
router.get('/audit/logs', adminController_1.getAuditLogs);
router.get('/export', exportController_1.exportData);
// 8. User Messages & Escalations
router.post('/messages', messageController_1.sendMessage); // also should be in user routes, but we can keep it here for simplicity since mock app uses it directly
router.get('/messages', messageController_1.getAdminMessages);
router.post('/messages/:id/reply', messageController_1.replyToMessage);
const quizController_1 = require("../controllers/quizController");
// 9. Hierarchical Course Management
router.get('/courses/hierarchy', courseHierarchyController_1.getCourseHierarchy);
router.post('/courses/packages', courseHierarchyController_1.createPackage);
router.post('/courses/subcourses', courseHierarchyController_1.createSubCourse);
router.post('/courses/classes', courseHierarchyController_1.createOrUpdateClass);
router.post('/courses/sessions', courseContentController_1.createClassSession);
router.post('/courses/assignments', courseContentController_1.createSessionAssignment);
router.post('/quizzes', quizController_1.createQuizMock);
// 10. Deep Mentor Evaluations & Level Gifting
router.get('/mentors/evaluations', adminController_1.getMentorEvaluations);
router.post('/levels/grant', adminController_1.grantUserLevel);
// 11. Chat Oversight
router.get('/chat', chatController_1.getAllChatsAdmin);
router.delete('/chat/:id', chatController_1.deleteMessage);
exports.default = router;
