import { Router } from 'express';
import { authenticateJWT, authorizeRoles } from '../middleware/auth';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  toggleBlockUser,
  deleteUser,
  overridePasswordOrOtp,
  exportUsersCsv,
  getZarikLedger,
  adjustZarik,
  getZarikAnalytics,
  getRolePermissions,
  updateRolePermissions,
  getCaravansAdmin,
  getMentorScorecards,
  createGlobalAnnouncement,
  getMentorEvaluations,
  grantUserLevel,
  getUserMetrics,
  getEconomyHub,
  getUserAnalytics,
  getRewardRules,
  upsertRewardRule,
  getAssetLeaderboard,
  getAuditLogs,
  setAccountStatus,
  getMentorDossier,
  updateMentor,
  moderateMentor,
  getLevelsAndCertificates,
} from '../controllers/adminController';
import { sendMessage, getAdminMessages, replyToMessage } from '../controllers/messageController';
import { getStations, getClasses, getSessions, getClips, getQuizzes, createStation, updateStation, deleteStation, reorderStations, createClass, updateClass, deleteCategory as deleteClass, createSession, updateSession, deleteSession, createPart, updatePart, deleteClip, deleteClip as deletePart, reorderClips, createQuestion, updateQuestion, deleteQuiz, deleteQuiz as deleteQuestion, createOrUpdateStation, createOrUpdateCategory, createOrUpdateSession, createOrUpdateClip, createOrUpdateQuiz, setBatchCategoryZarik, setBatchCategoryInstructor, batchSaveStationContent } from '../controllers/lmsController';
import { getForms, createOrUpdateForm, deleteForm, createOrUpdateField, deleteField, submitForm, getFormSubmissions } from '../controllers/formController';
import { getAllChatsAdmin, deleteMessage } from '../controllers/chatController';
import { exportData } from '../controllers/exportController';
import { revokeAllSessions, addBlacklist, removeBlacklist, getBlacklist } from '../controllers/securityController';
import { toggleCaravanStatus, bulkTransferMembers, approveAssetConversion, getAssetConversionsAdmin, getCaravanRequests } from '../controllers/caravanController';
import { grantPromotionalZarik, getZarikSalesStats, getMentorRewardRules, createMentorRewardRule, deleteMentorRewardRule } from '../controllers/rewardController';
import { getTickets } from '../controllers/supportController';
import { getPendingSubmissions, reviewSubmission } from '../controllers/submissionController';
import { getEconomyHubAnalytics } from '../controllers/walletController';
import { 
  broadcastNotification, 
  getTemplates, 
  createTemplate, 
  getOverrides, 
  toggleOverride, 
  getLogs 
} from '../controllers/notificationController';
import { getDashboardAnalytics } from '../controllers/analyticsController';
import { getMentors, createOrUpdateMentor, grantFiveStars } from '../controllers/mentorController';
import { getPendingDocuments, approveDocument, rejectDocument, getMentorHistory, assignCaravans } from '../controllers/mentorController';
import { createOrUpdateStudent, adjustBalance, adjustLevelFrame } from '../controllers/studentController';
import { getSystemSetting, setSystemSetting } from '../controllers/settingController';
import { createCaravan, addMemberToCaravan, removeMemberFromCaravan, transferMember, broadcastToCaravan, getCaravanDetails, updateCaravan, bulkAddMembersToCaravan, deleteCaravan, blockCaravanMembers } from '../controllers/caravanController';
import { getCaravanLeague, getIndividualsLeaderboard, getCaravansLeaderboardDetailed } from '../controllers/leagueController';

const router = Router();

// Apply JWT authentication and authorize only admin or mentor roles to the admin panel
router.use(authenticateJWT as any);
router.use(authorizeRoles('admin', 'mentor', 'SUPER_MENTOR') as any);

// 1. High-Scale User & Contact Directory
router.get('/users', getUsers as any);
router.post('/users', createUser as any);
router.put('/users/:id', updateUser as any);
router.patch('/users/:id/block', toggleBlockUser as any);
router.patch('/users/:id/status', setAccountStatus as any);
router.delete('/users/:id', deleteUser as any);
router.post('/users/:id/override-password', overridePasswordOrOtp as any);
router.get('/users/export', exportUsersCsv as any);
router.get('/users/metrics', getUserMetrics as any);
router.get('/users/:id', getUserById as any);
router.post('/students', createOrUpdateStudent as any);
router.post('/students/:id/adjust-balance', adjustBalance as any);
router.post('/students/:id/level-frame', adjustLevelFrame as any);
router.get('/levels-and-certificates', getLevelsAndCertificates as any);

// 2. Zarik Ledger & Categorized Rewards
router.get('/rewards/ledger', getZarikLedger as any);
router.post('/rewards/adjust', adjustZarik as any);
router.get('/rewards/analytics', getZarikAnalytics as any);
router.post('/rewards/grant', grantPromotionalZarik as any);
router.get('/rewards/stats', getZarikSalesStats as any);
router.get('/zarik/economy-hub', getEconomyHub as any);
router.get('/wallet/economy-hub-analytics', getEconomyHubAnalytics as any);

// 3. Role-Based Access Control (RBAC) & Security
router.get('/roles', getRolePermissions as any);
router.post('/roles', updateRolePermissions as any);
router.post('/security/revoke', revokeAllSessions as any);
router.post('/security/blacklist', addBlacklist as any);
router.delete('/security/blacklist', removeBlacklist as any);
router.get('/security/blacklist', getBlacklist as any);

// System Settings
router.get('/settings/:key', getSystemSetting as any);
router.post('/settings/:key', setSystemSetting as any);

// 4. Caravans & Mentors Operations Center
router.get('/caravans', getCaravansAdmin as any);
router.post('/caravans', createCaravan as any);
router.get('/caravans/league', getCaravanLeague as any);
router.get('/caravans/:id', getCaravanDetails as any);
router.put('/caravans/:id/status', toggleCaravanStatus as any);
router.post('/caravans/bulk-transfer', bulkTransferMembers as any);
router.post('/caravans/transfer', transferMember as any);
router.post('/caravans/:id/members/bulk-add', bulkAddMembersToCaravan as any);
router.post('/caravans/:id/members/:studentId', addMemberToCaravan as any);
router.delete('/caravans/:id/members/:studentId', removeMemberFromCaravan as any);
router.patch('/caravans/:id', updateCaravan as any);
router.post('/caravans/:id/broadcast', broadcastToCaravan as any);
router.delete('/caravans/:id', deleteCaravan as any);
router.put('/caravans/:id/block-members', blockCaravanMembers as any);

router.get('/caravans/requests', getCaravanRequests as any);
router.get('/asset-conversions', getAssetConversionsAdmin as any);
router.post('/asset-conversions/:id/approve', approveAssetConversion as any);
router.get('/tickets', getTickets as any);
router.get('/submissions', getPendingSubmissions as any);
router.post('/submissions/:id/review', reviewSubmission as any);
router.get('/mentors/scorecards', getMentorScorecards as any);
router.get('/mentors', getMentors as any);
router.post('/mentors', createOrUpdateMentor as any);
router.post('/mentors/:id/grant-stars', grantFiveStars as any);
router.post('/mentors/:id/assign-caravans', assignCaravans as any);
router.get('/mentors/documents/pending', getPendingDocuments as any);
router.post('/mentors/documents/:id/approve', approveDocument as any);
router.post('/mentors/documents/:id/reject', rejectDocument as any);
router.get('/mentors/:id/history', getMentorHistory as any);
router.get('/mentors/:id/dossier', getMentorDossier as any);
router.put('/mentors/:id', updateMentor as any);
router.post('/mentors/:id/moderate', moderateMentor as any);
router.get('/users/:id/analytics', getUserAnalytics as any);

import { getAdminNews, createNews, updateNews, deleteNews } from '../controllers/newsController';
import { getAdminBanners, createBanner, updateBanner, deleteBanner } from '../controllers/bannerController';
import { upload } from '../controllers/mediaController';

// 5. Educational Content, Banners, News & Announcements
router.post('/announcements/broadcast', createGlobalAnnouncement as any);

router.get('/news', getAdminNews as any);
router.post('/news', upload.single('image') as any, createNews as any);
router.put('/news/:id', upload.single('image') as any, updateNews as any);
router.delete('/news/:id', deleteNews as any);

router.get('/banners', getAdminBanners as any);
router.post('/banners', upload.single('image') as any, createBanner as any);
router.put('/banners/:id', upload.single('image') as any, updateBanner as any);
router.delete('/banners/:id', deleteBanner as any);
router.post('/notifications/broadcast', broadcastNotification as any);
router.get('/notifications/templates', getTemplates as any);
router.post('/notifications/templates', createTemplate as any);
router.get('/notifications/overrides', getOverrides as any);
router.post('/notifications/overrides', toggleOverride as any);
router.get('/notifications/logs', getLogs as any);

// 6. Analytics Dashboard
router.get('/analytics', getDashboardAnalytics as any);

// 7. System Audit Logs & Export Center
router.get('/audit/logs', getAuditLogs as any);
router.get('/export', exportData as any);

// 8. User Messages & Escalations
router.post('/messages', sendMessage as any); // also should be in user routes, but we can keep it here for simplicity since mock app uses it directly
router.get('/messages', getAdminMessages as any);
router.post('/messages/:id/reply', replyToMessage as any);

import { createQuizMock } from '../controllers/quizController';

// 9. Hierarchical Course Management
// 6. LMS and Form Builder
router.get('/lms/stations', getStations as any);
router.get('/lms/classes', getClasses as any);
router.get('/lms/sessions', getSessions as any);
router.get('/lms/clips', getClips as any);
router.get('/lms/quizzes', getQuizzes as any);

router.post('/lms/stations/reorder', reorderStations as any);
router.put('/lms/stations/reorder', reorderStations as any);
router.post('/lms/stations', createStation as any);
router.post('/lms/stations/:id/batch-content', batchSaveStationContent as any);
router.put('/lms/stations/:id/batch-content', batchSaveStationContent as any);
router.put('/lms/stations/:id', updateStation as any);
router.delete('/lms/stations/:id', deleteStation as any);

router.post('/lms/classes', createClass as any);
router.put('/lms/classes/:id', updateClass as any);
router.delete('/lms/classes/:id', deleteClass as any);

router.post('/lms/sessions', createSession as any);
router.put('/lms/sessions/:id', updateSession as any);
router.delete('/lms/sessions/:id', deleteSession as any);

router.post('/lms/sessions/:id/parts', createPart as any);
router.put('/lms/sessions/:id/parts/:clipId', updatePart as any);
router.delete('/lms/parts/:id', deletePart as any);

router.post('/lms/clips', createOrUpdateClip as any);
router.put('/lms/clips/:id', createOrUpdateClip as any);
router.delete('/lms/clips/:id', deleteClip as any);
router.post('/lms/sessions/:id/clips/reorder', reorderClips as any);

router.post('/lms/categories/:id/batch-zarik', setBatchCategoryZarik as any);
router.post('/lms/categories/:id/batch-instructor', setBatchCategoryInstructor as any);
router.post('/lms/quizzes', createOrUpdateQuiz as any);
router.put('/lms/quizzes/:id', createOrUpdateQuiz as any);
router.delete('/lms/quizzes/:id', deleteQuiz as any);

router.post('/lms/questions', createQuestion as any);
router.put('/lms/questions/:id', updateQuestion as any);
router.delete('/lms/questions/:id', deleteQuestion as any);

// Non-prefixed alias routes for robustness
router.post('/stations', createOrUpdateStation as any);
router.put('/stations/:id', createOrUpdateStation as any);
router.delete('/stations/:id', deleteStation as any);

router.get('/courses/hierarchy', getStations as any);
router.post('/courses/subcourses', createOrUpdateCategory as any);
router.post('/courses/classes', createOrUpdateSession as any);
router.post('/lms/sessions/:id/clips', createOrUpdateClip as any);

router.get('/forms', getForms as any);
router.post('/forms', createOrUpdateForm as any);
router.delete('/forms/:id', deleteForm as any);
router.post('/forms/fields', createOrUpdateField as any);
router.delete('/forms/fields/:id', deleteField as any);
router.post('/forms/submit', submitForm as any);
router.get('/forms/:formId/submissions', getFormSubmissions as any);
router.post('/quizzes', createQuizMock as any);

// 10. Deep Mentor Evaluations & Level Gifting
router.get('/mentors/evaluations', getMentorEvaluations as any);
router.post('/levels/grant', grantUserLevel as any);

router.get('/leaderboard/assets', getAssetLeaderboard as any);
router.get('/leaderboard/individuals', getIndividualsLeaderboard as any);
router.get('/leaderboard/caravans', getCaravansLeaderboardDetailed as any);
router.get('/rewards/rules', getRewardRules as any);
router.post('/rewards/rules', upsertRewardRule as any);
router.get('/rewards/mentor-rules', getMentorRewardRules as any);
router.post('/rewards/mentor-rules', createMentorRewardRule as any);
router.delete('/rewards/mentor-rules/:id', deleteMentorRewardRule as any);

// 11. Chat Oversight
router.get('/chat', getAllChatsAdmin as any);
router.delete('/chat/:id', deleteMessage as any);

export default router;
