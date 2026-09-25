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
        // Find mentor's caravan
        const caravan = await db_1.default.caravan.findFirst({
            where: {
                OR: [
                    { mentorId: userId },
                    { members: { some: { id: userId } } }
                ]
            },
            include: {
                members: {
                    where: { role: 'student' },
                    select: {
                        id: true,
                        name: true,
                        avatarUrl: true,
                        phoneNumber: true,
                        zarikBalance: true,
                        levelFrame: true
                    }
                }
            }
        });
        // Fetch all stations with categories, sessions, clips, quizzes
        const stations = await db_1.default.station.findMany({
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
        res.json({
            caravan: caravan ? {
                id: caravan.id,
                name: caravan.name,
                memberCount: caravan.members.length
            } : null,
            members: caravan ? caravan.members : [],
            stations,
            watchRecords,
            quizSubmissions
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
