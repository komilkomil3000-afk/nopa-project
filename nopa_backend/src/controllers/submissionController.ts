import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/db';

export async function submitTask(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'کاربر احراز هویت نشده است' });
    }

    const { challengeId, answerText, fileUrl } = req.body;

    if (!challengeId) {
      return res.status(400).json({ error: 'شناسه چالش الزامی است' });
    }

    const submission = await prisma.submission.create({
      data: {
        challengeId,
        studentId: req.user.id,
        answerText,
        fileUrl,
        status: 'PENDING_REVIEW'
      }
    });

    // Notify caravan mentor
    const student = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId }
    });

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

    const submissions = await prisma.submission.findMany({
      where: { status: { in: ['pending', 'PENDING_REVIEW'] } },
      include: {
        challenge: true,
        student: true
      },
      orderBy: { submittedAt: 'desc' }
    });

    res.json(submissions);
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
    const { status, score, mentorFeedback } = req.body; // status: "approved" | "rejected"

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

    const reward = score !== undefined ? Number(score) : (submission.challenge.rewardZarik || 200);

    let updatedSubmission;
    await prisma.$transaction(async (tx) => {
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
            createdBy: req.user!.id
          }
        });
      }
    });

    // Trigger notification
    await prisma.notification.create({
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
  } catch (error) {
    console.error('reviewSubmission error:', error);
    res.status(500).json({ error: 'خطایی در ثبت ارزیابی تکلیف رخ داد' });
  }
}
