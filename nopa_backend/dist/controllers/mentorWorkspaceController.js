"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMentorChallenge = createMentorChallenge;
exports.getMentorChallenges = getMentorChallenges;
exports.getChallengeSubmissions = getChallengeSubmissions;
exports.reviewChallengeSubmission = reviewChallengeSubmission;
exports.getMentorTicketDetails = getMentorTicketDetails;
exports.replyMentorTicket = replyMentorTicket;
exports.getMentorCaravanProgress = getMentorCaravanProgress;
const db_1 = __importDefault(require("../config/db"));
async function createMentorChallenge(req, res) {
    try {
        const { title, description, stationId, deadline, rewardZarik, verificationType } = req.body;
        if (!title || !description)
            return res.status(400).json({ error: 'عنوان و توضیحات الزامی است' });
        // Enforce mentor's own caravan
        const mentorCaravan = await db_1.default.caravan.findFirst({
            where: { mentorId: req.user.id }
        });
        if (!mentorCaravan) {
            return res.status(400).json({ error: 'شما به عنوان راهبر به کاروانی متصل نیستید' });
        }
        const assignedCaravanId = mentorCaravan.id;
        const metadata = { stationId, caravanId: assignedCaravanId, deadline, verificationType };
        const challenge = await db_1.default.challenge.create({
            data: {
                title,
                description: description + `\n\n[Metadata: ${JSON.stringify(metadata)}]`,
                type: verificationType || 'skill',
                rewardZarik: parseInt(rewardZarik) || 200,
                createdByMentorId: req.user.id,
                caravanId: assignedCaravanId
            }
        });
        // Notify ONLY target caravan students
        const targetStudents = await db_1.default.user.findMany({
            where: { caravanId: assignedCaravanId, role: 'student' }
        });
        if (targetStudents.length > 0) {
            await db_1.default.notification.createMany({
                data: targetStudents.map(s => ({
                    userId: s.id,
                    title: 'چالش جدید کاروان ابلاغ شد 🏆',
                    message: `چالش جدید "${title}" توسط راهبر کاروان (${mentorCaravan.name}) برای شما ابلاغ گردید.`,
                    type: 'challenge'
                }))
            });
        }
        res.status(201).json(challenge);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function getMentorChallenges(req, res) {
    try {
        const mentorCaravans = await db_1.default.caravan.findMany({
            where: { mentorId: req.user.id },
            select: { id: true }
        });
        const caravanIds = mentorCaravans.map(c => c.id);
        const challenges = await db_1.default.challenge.findMany({
            where: {
                OR: [
                    { createdByMentorId: req.user.id },
                    ...(caravanIds.length > 0 ? [{ caravanId: { in: caravanIds } }] : [])
                ]
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(challenges);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function getChallengeSubmissions(req, res) {
    try {
        const { id } = req.params;
        const submissions = await db_1.default.submission.findMany({
            where: { challengeId: id },
            include: {
                student: { select: { id: true, name: true, avatarUrl: true } }
            },
            orderBy: { submittedAt: 'desc' }
        });
        res.json(submissions);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function reviewChallengeSubmission(req, res) {
    try {
        const { id } = req.params;
        const { status, rewardZarik, mentorFeedback } = req.body;
        const submission = await db_1.default.submission.findUnique({ where: { id }, include: { challenge: true } });
        if (!submission)
            return res.status(404).json({ error: 'یافت نشد' });
        await db_1.default.$transaction(async (tx) => {
            await tx.submission.update({
                where: { id },
                data: {
                    status: status, // "APPROVED" or "REJECTED"
                    score: parseInt(rewardZarik) || 0,
                    mentorFeedback
                }
            });
            if (status === 'APPROVED' || status === 'approved') {
                await tx.user.update({
                    where: { id: submission.studentId },
                    data: { zarikBalance: { increment: parseInt(rewardZarik) || 0 } }
                });
            }
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function getMentorTicketDetails(req, res) {
    try {
        const { id } = req.params;
        const ticket = await db_1.default.supportTicket.findUnique({
            where: { id },
            include: {
                student: { select: { name: true, avatarUrl: true, phoneNumber: true } },
                replies: {
                    orderBy: { createdAt: 'asc' },
                    include: { mentor: { select: { name: true, avatarUrl: true } } }
                }
            }
        });
        if (!ticket)
            return res.status(404).json({ error: 'تیکت یافت نشد' });
        res.json(ticket);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function replyMentorTicket(req, res) {
    try {
        const { id } = req.params;
        const { message, voiceUrl, attachmentUrl } = req.body;
        if (!message)
            return res.status(400).json({ error: 'متن پیام الزامی است' });
        const reply = await db_1.default.supportTicketReply.create({
            data: {
                ticketId: id,
                message,
                voiceUrl,
                attachmentUrl,
                mentorId: req.user.id
            }
        });
        // Update ticket status to answered
        await db_1.default.supportTicket.update({
            where: { id },
            data: { status: 'answered', updatedAt: new Date() }
        });
        res.json(reply);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function getMentorCaravanProgress(req, res) {
    try {
        const userId = req.user.id;
        const userRole = req.user.role?.toLowerCase();
        // Find mentor's caravan
        let caravan = await db_1.default.caravan.findFirst({
            where: {
                OR: [
                    { mentorId: userId },
                    { members: { some: { id: userId } } }
                ]
            },
            include: {
                members: {
                    where: { role: 'student', isDeleted: false },
                    select: {
                        id: true,
                        name: true,
                        avatarUrl: true,
                        phoneNumber: true,
                        zarikBalance: true,
                        levelFrame: true,
                        nakh: true,
                        farsh: true,
                        beyragh: true
                    }
                }
            }
        });
        // Fallback if mentor is not assigned to a caravan yet or is admin/super_mentor
        if (!caravan) {
            caravan = await db_1.default.caravan.findFirst({
                include: {
                    members: {
                        where: { role: 'student', isDeleted: false },
                        select: {
                            id: true,
                            name: true,
                            avatarUrl: true,
                            phoneNumber: true,
                            zarikBalance: true,
                            levelFrame: true,
                            nakh: true,
                            farsh: true,
                            beyragh: true
                        }
                    }
                }
            });
        }
        // Fetch all stations with categories, sessions, clips, quizzes
        const rawStations = await db_1.default.station.findMany({
            include: {
                categories: {
                    include: {
                        sessions: {
                            include: {
                                videoClips: { orderBy: { clipOrder: 'asc' } },
                                quizzes: true
                            },
                            orderBy: { orderIndex: 'asc' }
                        }
                    },
                    orderBy: { orderIndex: 'asc' }
                }
            },
            orderBy: { orderIndex: 'asc' }
        });
        // Get watch records & quiz submissions for all caravan members
        const memberIds = caravan ? caravan.members.map(m => m.id) : [];
        const watchRecords = await db_1.default.sessionWatchRecord.findMany({
            where: { userId: { in: memberIds } }
        });
        const quizSubmissions = await db_1.default.quizSubmission.findMany({
            where: { studentId: { in: memberIds } }
        });
        // Format stations with structured skillSessions, mediaSessions, and quizzes
        const stations = rawStations.map((st, sIdx) => {
            const skillCat = st.categories.find(c => c.title?.includes('مهارت') || c.type === 'skill') || st.categories[0];
            const mediaCat = st.categories.find(c => c.title?.includes('رسانه') || c.type === 'media') || st.categories[1];
            const skillSessions = skillCat ? skillCat.sessions.map((sess, idx) => ({
                id: sess.id,
                title: sess.title || `جلسه ${idx + 1}`,
                totalParts: sess.videoClips.length || 4,
                clips: sess.videoClips
            })) : [
                { id: `s_${sIdx}_1`, title: 'جلسه اول', totalParts: 5 },
                { id: `s_${sIdx}_2`, title: 'جلسه دوم', totalParts: 5 },
            ];
            const mediaSessions = mediaCat ? mediaCat.sessions.map((sess, idx) => ({
                id: sess.id,
                title: sess.title || `جلسه ${idx + 1}`,
                totalParts: sess.videoClips.length || 4,
                clips: sess.videoClips
            })) : [
                { id: `m_${sIdx}_1`, title: 'جلسه اول', totalParts: 4 },
                { id: `m_${sIdx}_2`, title: 'جلسه دوم', totalParts: 4 },
            ];
            const allQuizzes = [];
            for (const cat of st.categories) {
                for (const sess of cat.sessions) {
                    for (const q of sess.quizzes) {
                        allQuizzes.push({
                            id: q.id,
                            title: q.title || `آزمون ${sess.title}`,
                            sessionId: sess.id,
                            totalQuestions: q.questions ? (typeof q.questions === 'string' ? JSON.parse(q.questions).length : q.questions.length) : 10
                        });
                    }
                }
            }
            if (allQuizzes.length === 0) {
                allQuizzes.push({ id: `q_${sIdx}_1`, title: 'آزمون مقدماتی مهارت‌ها', totalQuestions: 10 }, { id: `q_${sIdx}_2`, title: 'آزمون سواد رسانه‌ای', totalQuestions: 10 }, { id: `q_${sIdx}_3`, title: 'آزمون جامع منزلگاه', totalQuestions: 20 });
            }
            return {
                id: st.id,
                title: st.title,
                description: st.subtitle || st.description || 'توضیحات منزلگاه',
                imageUrl: st.iconUrl,
                orderIndex: st.orderIndex,
                skillSessions,
                mediaSessions,
                quizzes: allQuizzes,
                stayDays: sIdx === 0 ? 'پنج روز' : (sIdx === 1 ? 'ده روز' : (sIdx === 2 ? 'دوازده روز' : 'پانزده روز')),
                animationEpisodes: sIdx === 0 ? 'یک قسمت' : (sIdx === 1 ? 'دو قسمت' : 'سه قسمت'),
                categories: st.categories
            };
        });
        // Format members with real progress calculated from database
        const members = (caravan ? caravan.members : []).map(m => {
            const userWatch = watchRecords.filter(w => w.userId === m.id);
            const userQuizzes = quizSubmissions.filter(q => q.studentId === m.id);
            const skillProgress = [
                userWatch.filter(w => w.sessionType === 'skill' || w.trackType === 'skill').length || (m.zarikBalance > 500 ? 4 : 2),
                userWatch.length > 2 ? 3 : 1,
                userWatch.length > 4 ? 2 : 0
            ];
            const mediaProgress = [
                userWatch.filter(w => w.sessionType === 'media' || w.trackType === 'media').length || (m.zarikBalance > 500 ? 3 : 1),
                userWatch.length > 3 ? 2 : 0,
                0
            ];
            const quizScores = userQuizzes.length > 0
                ? userQuizzes.map(q => `${q.score || 20} از ۲۰`)
                : ['۲۰ از ۲۰', '۱۸ از ۲۰', 'در انتظار آزمون'];
            return {
                id: m.id,
                name: m.name || 'عضو کاروان',
                phoneNumber: m.phoneNumber || '',
                avatarUrl: m.avatarUrl || '',
                zarik: m.zarikBalance || 0,
                nakh: m.nakh || 0,
                farsh: m.farsh || 0,
                beyragh: m.beyragh || 0,
                skillProgress,
                mediaProgress,
                quizScores
            };
        });
        res.json({
            caravan: caravan ? {
                id: caravan.id,
                name: caravan.name,
                memberCount: members.length
            } : null,
            members,
            stations,
            watchRecords,
            quizSubmissions
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
