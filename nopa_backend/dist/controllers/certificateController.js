"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestPhysicalCertificate = exports.evaluateStudentProgress = void 0;
const client_1 = require("@prisma/client");
const uuid_1 = require("uuid");
const prisma = new client_1.PrismaClient();
const evaluateStudentProgress = async (userId) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.role !== 'student')
            return;
        // 1. Calculate Overall Progress
        const totalSessions = await prisma.classSession.count({ where: { isDeleted: false } });
        // We consider a session "completed" if watchedPercentage >= 70% or if they passed the quiz.
        // For simplicity, let's use the number of approved QuizSubmissions to avoid double counting
        // if a session has multiple quizzes (assuming 1 quiz per session for progress tracking).
        // To be more precise, let's count unique session IDs from approved quiz submissions
        const approvedQuizzes = await prisma.quizSubmission.findMany({
            where: { studentId: userId, status: 'APPROVED' },
            include: { quiz: true }
        });
        const completedSessionIds = new Set(approvedQuizzes.map(aq => aq.quiz.sessionId));
        const completedCount = completedSessionIds.size;
        const progressPercentage = totalSessions > 0 ? (completedCount / totalSessions) * 100 : 0;
        let newLevelFrame = user.levelFrame;
        if (progressPercentage >= 80) {
            newLevelFrame = Math.max(newLevelFrame, 3); // Gold
        }
        else if (progressPercentage >= 50) {
            newLevelFrame = Math.max(newLevelFrame, 2); // Silver
        }
        if (newLevelFrame !== user.levelFrame) {
            await prisma.user.update({
                where: { id: userId },
                data: { levelFrame: newLevelFrame }
            });
            const levelNames = { 2: 'نقره‌ای', 3: 'طلایی' };
            await prisma.notification.create({
                data: {
                    userId,
                    title: 'ارتقای سطح قاب پروفایل 🏆',
                    message: `تبریک! با توجه به پیشرفت شما، قاب پروفایل شما به سطح ${levelNames[newLevelFrame]} ارتقا یافت.`,
                    type: 'reward'
                }
            });
        }
        // 2. Automated Category Certificate Engine
        // Let's check if the user has completed all required classes in any specific Category
        const categories = await prisma.classCategory.findMany({
            include: { sessions: { where: { isDeleted: false }, include: { quizzes: true } } }
        });
        for (const category of categories) {
            // Check if user has a Certificate for this category (we can use category title for simplicity)
            const certificateTitle = `گواهی دوره ${category.title}`;
            const existingCert = await prisma.certificate.findFirst({
                where: { userId, title: certificateTitle }
            });
            if (!existingCert) {
                // Are all sessions in this category completed?
                let allCompleted = true;
                if (category.sessions.length === 0)
                    continue; // Skip empty categories
                for (const session of category.sessions) {
                    if (!completedSessionIds.has(session.id)) {
                        allCompleted = false;
                        break;
                    }
                }
                if (allCompleted) {
                    await prisma.certificate.create({
                        data: {
                            userId,
                            title: certificateTitle,
                            verifyId: `NOPA-${(0, uuid_1.v4)().substring(0, 8).toUpperCase()}`,
                        }
                    });
                    await prisma.notification.create({
                        data: {
                            userId,
                            title: 'صدور گواهینامه جدید 📜',
                            message: `تبریک! شما تمامی دروس دوره "${category.title}" را با موفقیت گذراندید و گواهینامه مربوطه برای شما صادر شد.`,
                            type: 'reward'
                        }
                    });
                }
            }
        }
    }
    catch (error) {
        console.error('Error in evaluateStudentProgress:', error);
    }
};
exports.evaluateStudentProgress = evaluateStudentProgress;
const requestPhysicalCertificate = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const { id: certificateId } = req.params;
        const { recipientName, postalAddress, postalCode, phoneNumber } = req.body;
        if (!recipientName || !postalAddress || !postalCode || !phoneNumber) {
            return res.status(400).json({ error: 'تمام اطلاعات پستی الزامی است' });
        }
        const cert = await prisma.certificate.findFirst({
            where: { id: certificateId, userId }
        });
        if (!cert) {
            return res.status(404).json({ error: 'گواهینامه یافت نشد' });
        }
        // Simulate payment processing...
        const order = await prisma.physicalCertificateOrder.create({
            data: {
                userId,
                certificateId,
                recipientName,
                postalAddress,
                postalCode,
                phoneNumber,
                status: 'PENDING_PRINT'
            }
        });
        res.status(201).json(order);
    }
    catch (error) {
        console.error('Error requesting physical certificate:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
exports.requestPhysicalCertificate = requestPhysicalCertificate;
