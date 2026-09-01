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
const db_1 = __importDefault(require("../config/db"));
async function createMentorChallenge(req, res) {
    try {
        const { title, description, stationId, caravanId, deadline, rewardZarik, verificationType } = req.body;
        if (!title || !description)
            return res.status(400).json({ error: 'عنوان و توضیحات الزامی است' });
        // Pack extra fields into questions JSON or just append to description if not available in schema
        // Since schema doesn't have stationId/deadline, we'll store them in description or questions
        const metadata = { stationId, caravanId, deadline, verificationType };
        const challenge = await db_1.default.challenge.create({
            data: {
                title,
                description: description + `\n\n[Metadata: ${JSON.stringify(metadata)}]`,
                type: verificationType || 'skill',
                rewardZarik: parseInt(rewardZarik) || 200,
                createdByMentorId: req.user.id
            }
        });
        // Notify target caravan students
        const targetStudents = caravanId
            ? await db_1.default.user.findMany({ where: { caravanId, role: 'student' } })
            : await db_1.default.user.findMany({ where: { role: 'student' } });
        if (targetStudents.length > 0) {
            await db_1.default.notification.createMany({
                data: targetStudents.map(s => ({
                    userId: s.id,
                    title: 'چالش جدید ابلاغ شد 🏆',
                    message: `چالش جدید "${title}" توسط راهبر برای شما ابلاغ گردید.`,
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
        const challenges = await db_1.default.challenge.findMany({
            where: { createdByMentorId: req.user.id },
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
