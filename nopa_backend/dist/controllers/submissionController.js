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
        const student = await db_1.default.user.findUnique({
            where: { id: req.user.id }
        });
        const challenge = await db_1.default.challenge.findUnique({
            where: { id: challengeId }
        });
        if (!challenge) {
            return res.status(404).json({ error: 'چالش مورد نظر یافت نشد' });
        }
        const existingSubmission = await db_1.default.submission.findFirst({
            where: { challengeId, studentId: req.user.id }
        });
        if (existingSubmission && existingSubmission.status === 'approved') {
            return res.status(400).json({ error: 'این تکلیف قبلاً تایید شده و پاداش آن دریافت گردیده است' });
        }
        // Validate caravan isolation: student can only submit to their own caravan's challenge unless it's a re-submission
        if (challenge.caravanId && student?.caravanId && challenge.caravanId !== student.caravanId && !existingSubmission) {
            return res.status(403).json({ error: 'شما فقط مجاز به ارسال پاسخ برای چالش‌های کاروان خود هستید' });
        }
        let submission;
        if (existingSubmission) {
            submission = await db_1.default.submission.update({
                where: { id: existingSubmission.id },
                data: {
                    answerText,
                    fileUrl,
                    status: 'PENDING_REVIEW',
                    score: 0,
                    submittedAt: new Date()
                }
            });
        }
        else {
            submission = await db_1.default.submission.create({
                data: {
                    challengeId,
                    studentId: req.user.id,
                    answerText,
                    fileUrl,
                    status: 'PENDING_REVIEW'
                }
            });
        }
        // Notify caravan mentor
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
        if (!req.user || (req.user.role !== 'mentor' && req.user.role !== 'admin')) {
            return res.status(403).json({ error: 'تنها راهبران و مدیران به این بخش دسترسی دارند' });
        }
        const { status, challengeId, studentId, caravanId, mentorId, search } = req.query;
        const whereClause = {};
        if (status && status !== 'all') {
            if (status === 'pending') {
                whereClause.status = { in: ['pending', 'PENDING_REVIEW'] };
            }
            else {
                whereClause.status = status;
            }
        }
        else if (!status) {
            // By default, return pending and pending_review
            whereClause.status = { in: ['pending', 'PENDING_REVIEW'] };
        }
        if (challengeId) {
            whereClause.challengeId = challengeId;
        }
        if (studentId && studentId !== 'all') {
            whereClause.studentId = studentId;
        }
        if (caravanId && caravanId !== 'all') {
            whereClause.OR = [
                { student: { caravanId: caravanId } },
                { challenge: { caravanId: caravanId } }
            ];
        }
        if (mentorId && mentorId !== 'all') {
            whereClause.OR = [
                ...(whereClause.OR || []),
                { challenge: { createdByMentorId: mentorId } },
                { student: { caravan: { mentorId: mentorId } } }
            ];
        }
        if (search && typeof search === 'string' && search.trim().length > 0) {
            const q = search.trim();
            const searchConditions = [
                { student: { name: { contains: q } } },
                { student: { phoneNumber: { contains: q } } },
                { challenge: { title: { contains: q } } },
                { answerText: { contains: q } }
            ];
            if (whereClause.OR) {
                whereClause.AND = [
                    { OR: whereClause.OR },
                    { OR: searchConditions }
                ];
                delete whereClause.OR;
            }
            else {
                whereClause.OR = searchConditions;
            }
        }
        // Caravan isolation for mentor: only view submissions from mentor's caravan / challenges
        if (req.user.role === 'mentor') {
            const mentorCaravans = await db_1.default.caravan.findMany({
                where: { mentorId: req.user.id },
                select: { id: true }
            });
            const caravanIds = mentorCaravans.map(c => c.id);
            const mentorConditions = [
                { challenge: { createdByMentorId: req.user.id } },
                ...(caravanIds.length > 0 ? [{ student: { caravanId: { in: caravanIds } } }] : [])
            ];
            if (whereClause.AND) {
                whereClause.AND.push({ OR: mentorConditions });
            }
            else if (whereClause.OR) {
                whereClause.AND = [
                    { OR: whereClause.OR },
                    { OR: mentorConditions }
                ];
                delete whereClause.OR;
            }
            else {
                whereClause.OR = mentorConditions;
            }
        }
        const submissions = await db_1.default.submission.findMany({
            where: whereClause,
            include: {
                challenge: {
                    include: {
                        caravan: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                },
                student: {
                    select: {
                        id: true,
                        name: true,
                        phoneNumber: true,
                        caravanId: true,
                        avatarUrl: true,
                        caravan: {
                            select: {
                                id: true,
                                name: true,
                                mentorId: true,
                                mentor: {
                                    select: {
                                        id: true,
                                        name: true,
                                        phoneNumber: true
                                    }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: { submittedAt: 'desc' }
        });
        const creatorIds = Array.from(new Set(submissions.map(s => s.challenge?.createdByMentorId).filter(Boolean)));
        const creators = creatorIds.length > 0 ? await db_1.default.user.findMany({
            where: { id: { in: creatorIds } },
            select: { id: true, name: true, phoneNumber: true, role: true }
        }) : [];
        const creatorMap = new Map(creators.map(c => [c.id, c]));
        const enriched = submissions.map(s => {
            const creator = s.challenge?.createdByMentorId ? creatorMap.get(s.challenge.createdByMentorId) : null;
            return {
                ...s,
                challenge: s.challenge ? {
                    ...s.challenge,
                    creatorInfo: creator ? {
                        id: creator.id,
                        name: creator.name,
                        phoneNumber: creator.phoneNumber,
                        isByAdmin: creator.role === 'admin'
                    } : (s.challenge.createdByMentorId?.toLowerCase().includes('admin') ? {
                        id: 'admin',
                        name: 'مدیر سیستم',
                        isByAdmin: true
                    } : null)
                } : null
            };
        });
        res.json(enriched);
    }
    catch (error) {
        console.error('getPendingSubmissions error:', error);
        res.status(500).json({ error: 'خطایی در دریافت تکالیف معلق رخ داد' });
    }
}
async function reviewSubmission(req, res) {
    try {
        if (!req.user || (req.user.role !== 'mentor' && req.user.role !== 'admin')) {
            return res.status(403).json({ error: 'تنها راهبران و مدیران می‌توانند تکالیف را تصحیح کنند' });
        }
        const { id } = req.params;
        let { status, score, mentorFeedback, isApproved } = req.body;
        if (isApproved !== undefined && !status) {
            status = isApproved ? 'approved' : 'rejected';
        }
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
        if (req.user.role === 'mentor') {
            const mentorCaravans = await db_1.default.caravan.findMany({
                where: { mentorId: req.user.id },
                select: { id: true }
            });
            const caravanIds = mentorCaravans.map(c => c.id);
            const isOwner = submission.challenge.createdByMentorId === req.user.id ||
                (submission.student?.caravanId && caravanIds.includes(submission.student.caravanId)) ||
                (submission.challenge.caravanId && caravanIds.includes(submission.challenge.caravanId));
            if (!isOwner) {
                return res.status(403).json({ error: 'شما فقط مجاز به بررسی تکالیف اعضای کاروان خود هستید' });
            }
        }
        if (submission.status === 'approved' && status === 'approved') {
            return res.status(400).json({ error: 'این تکلیف قبلاً تایید شده و پاداش آن ثبت گردیده است' });
        }
        const reward = score !== undefined ? Number(score) : (submission.challenge.rewardZarik || 200);
        let updatedSubmission;
        await db_1.default.$transaction(async (tx) => {
            updatedSubmission = await tx.submission.update({
                where: { id },
                data: {
                    status,
                    score: status === 'approved' ? reward : 0,
                    mentorFeedback
                }
            });
            if (status === 'approved') {
                // Credit student wallet and increment assets
                await tx.user.update({
                    where: { id: submission.studentId },
                    data: {
                        zarikBalance: { increment: reward }
                    }
                });
                // Log transaction in ZarikTransaction
                await tx.zarikTransaction.create({
                    data: {
                        userId: submission.studentId,
                        amount: reward,
                        category: 'Skill Tasks',
                        reason: `پاداش تایید تکلیف: ${submission.challenge.title}`,
                        createdBy: req.user.id
                    }
                });
            }
        });
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
        // Also notify caravan mentor: "ایجاد و نتیجه هر چالش باید درون برنامه به فرد و راهبر اطلاع داده شود و اعلان داده شود."
        if (submission.student?.caravanId) {
            const caravan = await db_1.default.caravan.findUnique({
                where: { id: submission.student.caravanId }
            });
            if (caravan?.mentorId && caravan.mentorId !== req.user?.id) {
                await db_1.default.notification.create({
                    data: {
                        userId: caravan.mentorId,
                        title: status === 'approved' ? 'نتیجه تکلیف دانش‌آموز کاروان ✅' : 'نتیجه تکلیف دانش‌آموز کاروان ❌',
                        message: `تکلیف دانش‌آموز "${submission.student.name}" در چالش "${submission.challenge.title}" توسط ${req.user?.role === 'admin' ? 'مدیر سیستم' : 'راهبر'} ${status === 'approved' ? 'تایید شد (+ ' + reward + ' زریک)' : 'رد شد'}.`,
                        type: 'alert'
                    }
                });
            }
        }
        res.json(updatedSubmission);
    }
    catch (error) {
        console.error('reviewSubmission error:', error);
        res.status(500).json({ error: 'خطایی در ثبت ارزیابی تکلیف رخ داد' });
    }
}
