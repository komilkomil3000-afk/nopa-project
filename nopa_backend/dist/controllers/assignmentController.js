"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStudentAssignments = getStudentAssignments;
exports.submitAssignment = submitAssignment;
exports.getPendingAssignmentSubmissions = getPendingAssignmentSubmissions;
exports.reviewAssignmentSubmission = reviewAssignmentSubmission;
const db_1 = __importDefault(require("../config/db"));
async function getStudentAssignments(req, res) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'کاربر احراز هویت نشده است' });
        }
        const submissions = await db_1.default.assignmentSubmission.findMany({
            where: { studentId: req.user.id },
            include: {
                assignment: {
                    include: {
                        session: {
                            include: {
                                courseClass: true,
                            },
                        },
                    },
                },
            },
            orderBy: { submittedAt: 'desc' },
        });
        res.json(submissions);
    }
    catch (error) {
        console.error('getStudentAssignments error:', error);
        res.status(500).json({ error: 'خطا در دریافت تکالیف شما رخ داد' });
    }
}
async function submitAssignment(req, res) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'کاربر احراز هویت نشده است' });
        }
        const { assignmentId, textResponse, fileUrl, selectedOptions } = req.body;
        if (!assignmentId) {
            return res.status(400).json({ error: 'شناسه تکلیف الزامی است' });
        }
        const assignment = await db_1.default.sessionAssignment.findUnique({
            where: { id: assignmentId },
            include: {
                session: {
                    include: {
                        courseClass: true,
                    },
                },
            },
        });
        if (!assignment) {
            return res.status(404).json({ error: 'تکلیف مورد نظر یافت نشد' });
        }
        const submission = await db_1.default.assignmentSubmission.create({
            data: {
                assignmentId,
                studentId: req.user.id,
                textResponse: textResponse || null,
                fileUrl: fileUrl || null,
                selectedOptions: selectedOptions || null,
                status: 'PENDING',
            },
        });
        const student = await db_1.default.user.findUnique({ where: { id: req.user.id } });
        if (student?.caravanId) {
            const caravan = await db_1.default.caravan.findUnique({ where: { id: student.caravanId } });
            if (caravan?.mentorId) {
                await db_1.default.notification.create({
                    data: {
                        userId: caravan.mentorId,
                        title: 'ارسال تکلیف جدید',
                        message: `دانش‌آموز ${student.name} تکلیف "${assignment.title}" را ارسال کرد.`,
                        type: 'challenge',
                    },
                });
            }
        }
        res.status(201).json(submission);
    }
    catch (error) {
        console.error('submitAssignment error:', error);
        res.status(500).json({ error: 'خطا در ارسال تکلیف رخ داد' });
    }
}
async function getPendingAssignmentSubmissions(req, res) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'کاربر احراز هویت نشده است' });
        }
        const submissions = await db_1.default.assignmentSubmission.findMany({
            where: { status: 'PENDING' },
            include: {
                assignment: {
                    include: {
                        session: {
                            include: {
                                courseClass: true,
                            },
                        },
                    },
                },
                student: true,
            },
            orderBy: { submittedAt: 'desc' },
        });
        res.json(submissions);
    }
    catch (error) {
        console.error('getPendingAssignmentSubmissions error:', error);
        res.status(500).json({ error: 'خطا در دریافت تکالیف معلق رخ داد' });
    }
}
async function reviewAssignmentSubmission(req, res) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'کاربر احراز هویت نشده است' });
        }
        const { id } = req.params;
        const { status, score, mentorFeedback } = req.body;
        if (!['APPROVED', 'REJECTED', 'REVISION_NEEDED'].includes(status)) {
            return res.status(400).json({ error: 'وضعیت جدید نامعتبر است' });
        }
        const submission = await db_1.default.assignmentSubmission.findUnique({
            where: { id },
            include: {
                assignment: true,
                student: true,
            },
        });
        if (!submission) {
            return res.status(404).json({ error: 'پاسخ مورد نظر یافت نشد' });
        }
        const updated = await db_1.default.assignmentSubmission.update({
            where: { id },
            data: {
                status,
                score: score || 0,
                mentorId: req.user.id,
            },
        });
        if (mentorFeedback) {
            await db_1.default.mentorFeedback.create({
                data: {
                    submissionId: id,
                    mentorId: req.user.id,
                    comment: mentorFeedback,
                    isPrivate: false,
                },
            });
        }
        if (status === 'APPROVED') {
            const assignment = await db_1.default.sessionAssignment.findUnique({ where: { id: submission.assignmentId } });
            const reward = assignment?.rewardZarik || 0;
            if (reward > 0) {
                await db_1.default.user.update({
                    where: { id: submission.studentId },
                    data: { zarikBalance: { increment: reward } },
                });
            }
        }
        await db_1.default.notification.create({
            data: {
                userId: submission.studentId,
                title: status === 'APPROVED' ? 'تکلیف تایید شد' : status === 'REJECTED' ? 'تکلیف رد شد' : 'نیاز به بازنگری',
                message: status === 'APPROVED'
                    ? `تکلیف "${submission.assignment.title}" تایید شد.`
                    : status === 'REJECTED'
                        ? `تکلیف شما رد شد. ${mentorFeedback || ''}`
                        : `لطفا تکلیف خود را بازنگری کنید. ${mentorFeedback || ''}`,
                type: 'alert',
            },
        });
        res.json(updated);
    }
    catch (error) {
        console.error('reviewAssignmentSubmission error:', error);
        res.status(500).json({ error: 'خطا در بررسی تکلیف رخ داد' });
    }
}
