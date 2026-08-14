"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitTask = submitTask;
exports.getPendingSubmissions = getPendingSubmissions;
exports.reviewSubmission = reviewSubmission;
const db_1 = __importDefault(require("../config/db"));
async function submitTask(req, res) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'کاربر احراز هویت نشده است' });
        }
        const { challengeId, answerText, fileUrl } = req.body;
        if (!challengeId) {
            return res.status(400).json({ error: 'شناسه چالش الزامی است' });
        }
        const submission = await db_1.default.submission.create({
            data: {
                challengeId,
                studentId: req.user.id,
                answerText,
                fileUrl,
                status: 'pending'
            }
        });
        // Notify caravan mentor
        const student = await db_1.default.user.findUnique({
            where: { id: req.user.id }
        });
        const challenge = await db_1.default.challenge.findUnique({
            where: { id: challengeId }
        });
        if (student?.caravanId) {
            const caravan = await db_1.default.caravan.findUnique({
                where: { id: student.caravanId }
            });
            if (caravan?.mentorId) {
                await db_1.default.notification.create({
                    data: {
                        userId: caravan.mentorId,
                        title: 'پاسخ جدید دریافت شد 📝',
                        message: `دانش‌آموز "${student.name}" پاسخی برای چالش "${challenge?.title || 'تکلیف'}" ثبت کرد.`,
                        type: 'alert'
                    }
                });
            }
        }
        res.status(201).json(submission);
    }
    catch (error) {
        console.error('submitTask error:', error);
        res.status(500).json({ error: 'خطایی در ارسال پاسخ تکلیف رخ داد' });
    }
}
async function getPendingSubmissions(req, res) {
    try {
        if (!req.user || req.user.role !== 'mentor') {
            return res.status(403).json({ error: 'تنها راهبران به این بخش دسترسی دارند' });
        }
        const submissions = await db_1.default.submission.findMany({
            where: { status: 'pending' },
            include: {
                challenge: true,
                student: true
            },
            orderBy: { submittedAt: 'desc' }
        });
        res.json(submissions);
    }
    catch (error) {
        console.error('getPendingSubmissions error:', error);
        res.status(500).json({ error: 'خطایی در دریافت تکالیف معلق رخ داد' });
    }
}
async function reviewSubmission(req, res) {
    try {
        if (!req.user || req.user.role !== 'mentor') {
            return res.status(403).json({ error: 'تنها راهبران می‌توانند تکالیف را تصحیح کنند' });
        }
        const { id } = req.params;
        const { status, score, mentorFeedback } = req.body; // status: "approved" | "rejected"
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'وضعیت جدید نامعتبر است' });
        }
        const submission = await db_1.default.submission.findUnique({
            where: { id },
            include: { challenge: true, student: true }
        });
        if (!submission) {
            return res.status(404).json({ error: 'پاسخ مورد نظر یافت نشد' });
        }
        const updatedSubmission = await db_1.default.submission.update({
            where: { id },
            data: {
                status,
                score: score || 0,
                mentorFeedback
            }
        });
        const reward = submission.challenge.rewardZarik || 200;
        if (status === 'approved') {
            // Credit student wallet and increment assets
            await db_1.default.user.update({
                where: { id: submission.studentId },
                data: {
                    zarikBalance: { increment: reward }
                }
            });
        }
        // Trigger notification
        await db_1.default.notification.create({
            data: {
                userId: submission.studentId,
                title: status === 'approved' ? 'تکلیف تایید شد ✅' : 'تکلیف رد شد ❌',
                message: status === 'approved'
                    ? `پاسخ شما به چالش "${submission.challenge.title}" تایید شد و +${reward} زریک به ولت شما اضافه گردید.`
                    : `پاسخ شما به چالش "${submission.challenge.title}" رد شد. فیدبک: ${mentorFeedback || 'اصلاح و مجدداً ارسال کنید.'}`,
                type: 'alert'
            }
        });
        res.json(updatedSubmission);
    }
    catch (error) {
        console.error('reviewSubmission error:', error);
        res.status(500).json({ error: 'خطایی در ثبت ارزیابی تکلیف رخ داد' });
    }
}
