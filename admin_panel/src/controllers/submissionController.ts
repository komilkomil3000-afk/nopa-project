import { isMentorRole } from '../utils/roles';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/db';

export async function submitTask(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'کاربر احراز هویت نشده است' });
    }

    // Mentors and admins only manage challenges; they do not take part in them
    if (isMentorRole(req.user.role) || req.user.role === 'admin') {
      return res.status(403).json({ error: 'راهبر و مدیر در چالش شرکت نمی‌کنند و فقط آن را مدیریت می‌کنند' });
    }

    const { challengeId, answerText, fileUrl } = req.body;

    if (!challengeId) {
      return res.status(400).json({ error: 'شناسه چالش الزامی است' });
    }

    const student = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId }
    });

    if (!challenge) {
      return res.status(404).json({ error: 'چالش مورد نظر یافت نشد' });
    }

    const existingSubmission = await prisma.submission.findFirst({
      where: { challengeId, studentId: req.user.id }
    });

    if (challenge.type === 'quiz') {
      return res.status(400).json({ error: 'پاسخ آزمون‌های تستی از مسیر آزمون ثبت می‌شود' });
    }

    if (existingSubmission && existingSubmission.status === 'approved') {
      return res.status(400).json({ error: 'این تکلیف قبلاً تایید شده و پاداش آن دریافت گردیده است' });
    }

    // Awaiting the mentor's verdict: the answer is locked until it is approved or sent back for correction
    if (existingSubmission && ['pending', 'PENDING_REVIEW'].includes(existingSubmission.status)) {
      return res.status(409).json({ error: 'پاسخ شما در انتظار بررسی راهبر است و تا اعلام نتیجه قابل ویرایش نیست' });
    }

    if (challenge.startDate && new Date() < challenge.startDate) {
      return res.status(400).json({ error: 'این چالش هنوز شروع نشده است' });
    }

    // A new participation closes with the deadline (a correction requested by the mentor is still allowed)
    if (!existingSubmission && challenge.dueDate && new Date() > challenge.dueDate) {
      return res.status(400).json({ error: 'مهلت شرکت در این چالش به پایان رسیده است' });
    }

    if (challenge.recipientIds.length > 0 && !challenge.recipientIds.includes(req.user.id)) {
      return res.status(403).json({ error: 'این چالش برای شما تعیین نشده است' });
    }

    // Validate caravan isolation: student can only submit to their own caravan's challenge unless it's a re-submission
    if (challenge.caravanId && student?.caravanId && challenge.caravanId !== student.caravanId && !existingSubmission) {
      return res.status(403).json({ error: 'شما فقط مجاز به ارسال پاسخ برای چالش‌های کاروان خود هستید' });
    }

    let submission;
    if (existingSubmission) {
      submission = await prisma.submission.update({
        where: { id: existingSubmission.id },
        data: {
          answerText,
          fileUrl,
          status: 'PENDING_REVIEW',
          score: 0,
          submittedAt: new Date()
        }
      });
    } else {
      submission = await prisma.submission.create({
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
      const caravan = await prisma.caravan.findUnique({
        where: { id: student.caravanId }
      });

      if (caravan?.mentorId) {
        await prisma.notification.create({
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
  } catch (error) {
    console.error('submitTask error:', error);
    res.status(500).json({ error: 'خطایی در ارسال پاسخ تکلیف رخ داد' });
  }
}

export async function getPendingSubmissions(req: AuthRequest, res: Response) {
  try {
    if (!req.user || (req.user.role !== 'mentor' && req.user.role !== 'admin')) {
      return res.status(403).json({ error: 'تنها راهبران و مدیران به این بخش دسترسی دارند' });
    }

    const { status, challengeId, studentId, caravanId, mentorId, search } = req.query;
    const whereClause: any = {};

    if (status && status !== 'all') {
      if (status === 'pending') {
        whereClause.status = { in: ['pending', 'PENDING_REVIEW'] };
      } else {
        whereClause.status = status as string;
      }
    } else if (!status) {
      // By default, return pending and pending_review
      whereClause.status = { in: ['pending', 'PENDING_REVIEW'] };
    }

    if (challengeId) {
      whereClause.challengeId = challengeId as string;
    }

    if (studentId && studentId !== 'all') {
      whereClause.studentId = studentId as string;
    }

    if (caravanId && caravanId !== 'all') {
      whereClause.OR = [
        { student: { caravanId: caravanId as string } },
        { challenge: { caravanId: caravanId as string } }
      ];
    }

    if (mentorId && mentorId !== 'all') {
      whereClause.OR = [
        ...(whereClause.OR || []),
        { challenge: { createdByMentorId: mentorId as string } },
        { student: { caravan: { mentorId: mentorId as string } } }
      ];
    }

    if (search && typeof search === 'string' && search.trim().length > 0) {
      const q = search.trim();
      const searchConditions = [
        { student: { name: { contains: q, mode: 'insensitive' } } },
        { student: { phoneNumber: { contains: q, mode: 'insensitive' } } },
        { challenge: { title: { contains: q, mode: 'insensitive' } } },
        { answerText: { contains: q, mode: 'insensitive' } }
      ];
      if (whereClause.OR) {
        whereClause.AND = [
          { OR: whereClause.OR },
          { OR: searchConditions }
        ];
        delete whereClause.OR;
      } else {
        whereClause.OR = searchConditions;
      }
    }

    // Caravan isolation for mentor: only view submissions from mentor's caravan / challenges
    if (req.user.role === 'mentor') {
      const mentorCaravans = await prisma.caravan.findMany({
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
      } else if (whereClause.OR) {
        whereClause.AND = [
          { OR: whereClause.OR },
          { OR: mentorConditions }
        ];
        delete whereClause.OR;
      } else {
        whereClause.OR = mentorConditions;
      }
    }

    const submissions = await prisma.submission.findMany({
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
    const creators = creatorIds.length > 0 ? await prisma.user.findMany({
      where: { id: { in: creatorIds as string[] } },
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
  } catch (error) {
    console.error('getPendingSubmissions error:', error);
    res.status(500).json({ error: 'خطایی در دریافت تکالیف معلق رخ داد' });
  }
}

export async function reviewSubmission(req: AuthRequest, res: Response) {
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

    const submission = await prisma.submission.findUnique({
      where: { id },
      include: { challenge: true, student: true }
    });

    if (!submission) {
      return res.status(404).json({ error: 'پاسخ مورد نظر یافت نشد' });
    }

    if (req.user.role === 'mentor') {
      const mentorCaravans = await prisma.caravan.findMany({
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

    // The challenge decides what an approval pays (zarik or nakh) and between which bounds the reviewer may choose
    const assetType = submission.challenge.rewardAssetType === 'nakh' ? 'nakh' : 'zarik';
    const assetLabel = assetType === 'nakh' ? 'نخ' : 'زریک';
    const rewardMin = submission.challenge.rewardMin || 0;
    const rewardMax = submission.challenge.rewardMax || 0;
    const hasRange = rewardMax > 0;

    const reward = score !== undefined ? Number(score) : (hasRange ? rewardMax : (submission.challenge.rewardZarik || 200));
    if (status === 'approved' && (!Number.isFinite(reward) || reward < 0)) {
      return res.status(400).json({ error: 'مقدار پاداش نامعتبر است' });
    }
    if (status === 'approved' && hasRange && req.user.role === 'mentor' && (!Number.isInteger(reward) || reward < rewardMin || reward > rewardMax)) {
      return res.status(400).json({ error: `مقدار پاداش باید بین ${rewardMin} و ${rewardMax} ${assetLabel} باشد` });
    }

    let updatedSubmission;
    try {
    await prisma.$transaction(async (tx) => {
      // Atomic claim: only one concurrent request can move the row to "approved".
      // The pre-check above is only a fast path; this is what actually prevents double rewards.
      const claimed = await tx.submission.updateMany({
        where: status === 'approved' ? { id, status: { not: 'approved' } } : { id },
        data: {
          status,
          score: status === 'approved' ? reward : 0,
          mentorFeedback
        }
      });
      if (claimed.count !== 1) throw new Error('ALREADY_APPROVED');
      updatedSubmission = await tx.submission.findUnique({ where: { id } });

      if (status === 'approved') {
        // Credit the asset the challenge pays in
        await tx.user.update({
          where: { id: submission.studentId },
          data: assetType === 'nakh' ? { nakh: { increment: reward } } : { zarikBalance: { increment: reward } }
        });

        // Zarik movements are ledgered; nakh has no ledger table
        if (assetType === 'zarik') {
          await tx.zarikTransaction.create({
            data: {
              userId: submission.studentId,
              amount: reward,
              category: 'Skill Tasks',
              reason: `پاداش تایید تکلیف: ${submission.challenge.title}`,
              createdBy: req.user!.id
            }
          });
        }
      }
    });
    } catch (e: any) {
      if (e?.message === 'ALREADY_APPROVED') {
        return res.status(400).json({ error: 'این تکلیف قبلاً تایید شده و پاداش آن ثبت گردیده است' });
      }
      throw e;
    }

    // Trigger notification
    await prisma.notification.create({
      data: {
        userId: submission.studentId,
        title: status === 'approved' ? 'تکلیف تایید شد ✅' : 'تکلیف رد شد ❌',
        message: status === 'approved'
            ? `پاسخ شما به چالش "${submission.challenge.title}" تایید شد و +${reward} ${assetLabel} به حساب شما اضافه گردید.`
            : `پاسخ شما به چالش "${submission.challenge.title}" رد شد. فیدبک: ${mentorFeedback || 'اصلاح و مجدداً ارسال کنید.'}`,
        type: 'alert'
      }
    });

    // Also notify caravan mentor: "ایجاد و نتیجه هر چالش باید درون برنامه به فرد و راهبر اطلاع داده شود و اعلان داده شود."
    if (submission.student?.caravanId) {
      const caravan = await prisma.caravan.findUnique({
        where: { id: submission.student.caravanId }
      });
      if (caravan?.mentorId && caravan.mentorId !== req.user?.id) {
        await prisma.notification.create({
          data: {
            userId: caravan.mentorId,
            title: status === 'approved' ? 'نتیجه تکلیف دانش‌آموز کاروان ✅' : 'نتیجه تکلیف دانش‌آموز کاروان ❌',
            message: `تکلیف دانش‌آموز "${submission.student.name}" در چالش "${submission.challenge.title}" توسط ${req.user?.role === 'admin' ? 'مدیر سیستم' : 'راهبر'} ${status === 'approved' ? 'تایید شد (+ ' + reward + ' ' + assetLabel + ')' : 'رد شد'}.`,
            type: 'alert'
          }
        });
      }
    }

    res.json(updatedSubmission);
  } catch (error) {
    console.error('reviewSubmission error:', error);
    res.status(500).json({ error: 'خطایی در ثبت ارزیابی تکلیف رخ داد' });
  }
}
