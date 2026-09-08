import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/db';

export async function createChallenge(req: AuthRequest, res: Response) {
  try {
    if (!req.user || (req.user.role !== 'mentor' && req.user.role !== 'admin')) {
      return res.status(403).json({ error: 'تنها مربی‌ها و مدیران می‌توانند چالش ایجاد کنند' });
    }

    const { id, title, description, type, questions, rewardZarik, caravanId, targetMentorId } = req.body;

    if (!title || !description || !type) {
      return res.status(400).json({ error: 'فیلدهای عنوان، توضیحات و نوع چالش الزامی هستند' });
    }

    let creatorId = req.user.id;
    let assignedCaravanId: string | null = null;

    if (req.user.role === 'mentor') {
      // Mentors can only create challenges for their own caravan
      const mentorCaravan = await prisma.caravan.findFirst({
        where: { mentorId: req.user.id }
      });
      if (!mentorCaravan) {
        return res.status(400).json({ error: 'شما به عنوان راهبر به کاروانی متصل نیستید' });
      }
      assignedCaravanId = mentorCaravan.id;
      creatorId = req.user.id;
    } else if (req.user.role === 'admin') {
      if (targetMentorId) {
        creatorId = targetMentorId;
      }
      if (caravanId && caravanId !== 'all') {
        assignedCaravanId = caravanId;
      }
    }

    // Generate readable ID if not provided, e.g. CH + random
    const challengeId = id && id.trim() ? id.trim() : `CH${Math.floor(100 + Math.random() * 900)}`;

    const challenge = await prisma.challenge.create({
      data: {
        id: challengeId,
        title,
        description,
        type,
        questions: questions ? (typeof questions === 'string' ? questions : JSON.stringify(questions)) : null,
        rewardZarik: Number(rewardZarik) || 50,
        createdByMentorId: creatorId,
        caravanId: assignedCaravanId
      }
    });

    // Notify: "ایجاد و نتیجه هر چالش باید درون برنامه به فرد و راهبر اطلاع داده شود و اعلان داده شود."
    const isByAdmin = req.user.role === 'admin';
    const creatorName = isByAdmin ? 'مدیر سیستم' : ((req.user as any).name || 'راهبر');

    let targetStudents: { id: string }[] = [];
    if (assignedCaravanId) {
      targetStudents = await prisma.user.findMany({
        where: { caravanId: assignedCaravanId, role: 'student' },
        select: { id: true }
      });
      // Also notify caravan mentor if created by admin
      const caravan = await prisma.caravan.findUnique({ where: { id: assignedCaravanId } });
      if (caravan?.mentorId && isByAdmin) {
        await prisma.notification.create({
          data: {
            userId: caravan.mentorId,
            title: 'ابلاغ چالش جدید در کاروان 🚩',
            message: `چالش جدید "${title}" توسط ${creatorName} برای اعضای کاروان "${caravan.name}" ثبت گردید.`,
            type: 'challenge'
          }
        });
      }
    } else {
      // General challenge for all students (only admin can create)
      targetStudents = await prisma.user.findMany({
        where: { role: 'student' },
        select: { id: true }
      });
      // Notify all mentors
      const mentors = await prisma.user.findMany({
        where: { role: 'mentor' },
        select: { id: true }
      });
      if (mentors.length > 0) {
        await prisma.notification.createMany({
          data: mentors.map(m => ({
            userId: m.id,
            title: 'چالش عمومی جدید ابلاغ شد 🏆',
            message: `چالش جدید "${title}" توسط ${creatorName} برای تمامی کاروان‌ها منتشر گردید.`,
            type: 'challenge'
          }))
        });
      }
    }

    if (targetStudents.length > 0) {
      await prisma.notification.createMany({
        data: targetStudents.map(s => ({
          userId: s.id,
          title: 'چالش جدید ابلاغ شد 🏆',
          message: `چالش جدید "${title}" توسط ${creatorName} منتشر گردید. پاداش: ${rewardZarik || 50} زریک 🪙`,
          type: 'challenge'
        }))
      });
    }

    res.status(201).json(challenge);
  } catch (error) {
    console.error('createChallenge error:', error);
    res.status(500).json({ error: 'خطایی در ایجاد چالش رخ داد' });
  }
}

export async function updateChallenge(req: AuthRequest, res: Response) {
  try {
    if (!req.user || (req.user.role !== 'mentor' && req.user.role !== 'admin')) {
      return res.status(403).json({ error: 'تنها راهبران و مدیران می‌توانند چالش‌ها را ویرایش کنند' });
    }

    const { id } = req.params;
    const { title, description, type, questions, rewardZarik, caravanId, targetMentorId } = req.body;

    const existing = await prisma.challenge.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'چالش مورد نظر یافت نشد' });
    }

    if (req.user.role === 'mentor') {
      const mentorCaravan = await prisma.caravan.findFirst({ where: { mentorId: req.user.id } });
      const isOwner = existing.createdByMentorId === req.user.id || (mentorCaravan && existing.caravanId === mentorCaravan.id);
      if (!isOwner) {
        return res.status(403).json({ error: 'شما فقط مجاز به مدیریت چالش‌های کاروان خود هستید' });
      }
    }

    const updateData: any = {};
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (type) updateData.type = type;
    if (questions !== undefined) {
      updateData.questions = typeof questions === 'string' ? questions : JSON.stringify(questions);
    }
    if (rewardZarik !== undefined) updateData.rewardZarik = Number(rewardZarik);
    if (req.user.role === 'admin') {
      if (targetMentorId) {
        updateData.createdByMentorId = targetMentorId;
      }
      if (caravanId !== undefined) {
        updateData.caravanId = caravanId === 'all' ? null : caravanId;
      }
    }

    const updated = await prisma.challenge.update({
      where: { id },
      data: updateData
    });

    res.json(updated);
  } catch (error) {
    console.error('updateChallenge error:', error);
    res.status(500).json({ error: 'خطایی در به‌روزرسانی چالش رخ داد' });
  }
}

export async function deleteChallenge(req: AuthRequest, res: Response) {
  try {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'mentor')) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }

    const { id } = req.params;
    const existing = await prisma.challenge.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'چالش مورد نظر یافت نشد' });
    }

    if (req.user.role === 'mentor') {
      const mentorCaravan = await prisma.caravan.findFirst({ where: { mentorId: req.user.id } });
      const isOwner = existing.createdByMentorId === req.user.id || (mentorCaravan && existing.caravanId === mentorCaravan.id);
      if (!isOwner) {
        return res.status(403).json({ error: 'شما فقط مجاز به حذف چالش‌های کاروان خود هستید' });
      }
    }

    // Cascade delete submissions
    await prisma.submission.deleteMany({ where: { challengeId: id } });
    await prisma.challenge.delete({ where: { id } });

    res.json({ message: 'چالش و پاسخ‌های مرتبط با موفقیت حذف گردیدند' });
  } catch (error) {
    console.error('deleteChallenge error:', error);
    res.status(500).json({ error: 'خطایی در حذف چالش رخ داد' });
  }
}

export async function getChallenges(req: AuthRequest, res: Response) {
  try {
    const user = req.user;
    let whereClause: any = {};

    if (user) {
      if (user.role === 'student') {
        // Fetch student's assigned caravan
        const student = await prisma.user.findUnique({
          where: { id: user.id },
          select: { id: true, caravanId: true }
        });

        // Find admin IDs for general challenges
        const adminUsers = await prisma.user.findMany({
          where: { role: 'admin' },
          select: { id: true }
        });
        const adminIds = adminUsers.map(a => a.id);

        if (student?.caravanId) {
          const studentCaravan = await prisma.caravan.findUnique({
            where: { id: student.caravanId },
            select: { mentorId: true }
          });

          const orConditions: any[] = [
            { caravanId: student.caravanId }
          ];

          if (studentCaravan?.mentorId) {
            orConditions.push({ createdByMentorId: studentCaravan.mentorId });
          }

          if (adminIds.length > 0) {
            orConditions.push({
              AND: [
                { caravanId: null },
                { createdByMentorId: { in: adminIds } }
              ]
            });
          }

          whereClause = { OR: orConditions };
        } else {
          // No caravan yet: only see general admin challenges
          whereClause = adminIds.length > 0 ? {
            AND: [
              { caravanId: null },
              { createdByMentorId: { in: adminIds } }
            ]
          } : { id: '__none__' };
        }
      } else if (user.role === 'mentor') {
        // Mentor sees ONLY challenges for their own caravan or created by themselves
        const mentorCaravans = await prisma.caravan.findMany({
          where: { mentorId: user.id },
          select: { id: true }
        });
        const mentorCaravanIds = mentorCaravans.map(c => c.id);

        whereClause = {
          OR: [
            { createdByMentorId: user.id },
            ...(mentorCaravanIds.length > 0 ? [{ caravanId: { in: mentorCaravanIds } }] : [])
          ]
        };
      } else if (user.role === 'admin') {
        const { caravanId, mentorId } = req.query;
        if (caravanId && caravanId !== 'all') {
          whereClause.caravanId = caravanId as string;
        }
        if (mentorId && mentorId !== 'all') {
          whereClause.createdByMentorId = mentorId as string;
        }
      }
    }

    const challenges = await prisma.challenge.findMany({
      where: whereClause,
      include: {
        caravan: {
          include: {
            mentor: {
              select: { id: true, name: true, role: true }
            }
          }
        },
        submissions: {
          select: {
            id: true,
            status: true,
            score: true,
            studentId: true,
            mentorFeedback: true,
            answerText: true,
            submittedAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const creatorIds = Array.from(new Set(challenges.map(c => c.createdByMentorId).filter(Boolean)));
    const creators = await prisma.user.findMany({
      where: { id: { in: creatorIds } },
      select: { id: true, name: true, role: true, caravanId: true }
    });
    const creatorMap = new Map(creators.map(u => [u.id, u]));

    const caravans = await prisma.caravan.findMany({
      select: { id: true, name: true, mentorId: true, mentor: { select: { id: true, name: true } } }
    });
    const mentorCaravanMap = new Map(caravans.filter(c => c.mentorId).map(c => [c.mentorId!, c]));

    const parsedChallenges = challenges.map(c => {
      let parsedQuestions = null;
      if (c.questions) {
        try {
          parsedQuestions = JSON.parse(c.questions);
        } catch (e) {
          parsedQuestions = c.questions;
        }
      }
      const totalSubmissions = c.submissions.length;
      const pendingSubmissions = c.submissions.filter(s => s.status === 'pending' || s.status === 'PENDING_REVIEW').length;
      const approvedSubmissions = c.submissions.filter(s => s.status === 'approved').length;

      const creator = creatorMap.get(c.createdByMentorId);
      const isByAdmin = creator?.role === 'admin' || (!creator && c.createdByMentorId.toLowerCase().includes('admin'));
      
      const directCaravan = c.caravan;
      const mentorCaravan = creator ? mentorCaravanMap.get(creator.id) : null;
      const effectiveCaravan = directCaravan || mentorCaravan;

      const creatorInfo = {
        id: creator?.id || c.createdByMentorId,
        name: creator?.name || (isByAdmin ? 'مدیر سیستم' : 'راهبر کاروان'),
        role: isByAdmin ? 'admin' : 'mentor',
        isByAdmin: isByAdmin,
        label: isByAdmin ? 'مدیر سیستم' : `راهبر (${creator?.name || 'مربی'})`
      };

      const caravanInfo = effectiveCaravan ? {
        id: effectiveCaravan.id,
        name: effectiveCaravan.name,
        mentorName: effectiveCaravan.mentor?.name || (creator?.role === 'mentor' ? creator.name : 'نامشخص')
      } : null;

      const targetAudience = effectiveCaravan ? {
        type: 'caravan',
        id: effectiveCaravan.id,
        name: effectiveCaravan.name,
        mentorName: effectiveCaravan.mentor?.name || (creator?.role === 'mentor' ? creator.name : 'نامشخص'),
        label: `کاروان: ${effectiveCaravan.name}`
      } : {
        type: 'all',
        id: 'all',
        name: 'عمومی (همه کاروان‌ها)',
        mentorName: null,
        label: 'عمومی (همه کاروان‌ها)'
      };

      const mySub = user ? c.submissions.find(s => s.studentId === user.id) : null;
      const myStatus = mySub ? mySub.status : 'none';

      return {
        ...c,
        questions: parsedQuestions,
        totalSubmissions,
        pendingSubmissions,
        approvedSubmissions,
        creatorInfo,
        caravanInfo,
        targetAudience,
        mySubmission: mySub ? {
          id: mySub.id,
          status: mySub.status,
          score: mySub.score,
          mentorFeedback: mySub.mentorFeedback,
          answerText: mySub.answerText,
          submittedAt: mySub.submittedAt
        } : null,
        myStatus: myStatus
      };
    });

    res.json(parsedChallenges);
  } catch (error) {
    console.error('getChallenges error:', error);
    res.status(500).json({ error: 'خطایی در دریافت لیست چالش‌ها رخ داد' });
  }
}

export async function submitQuiz(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'کاربر احراز هویت نشده است' });
    }

    const { id } = req.params;
    const { answers } = req.body; // Array of selected options indices

    if (!Array.isArray(answers)) {
      return res.status(400).json({ error: 'فرمت پاسخ‌ها نامعتبر است' });
    }

    const challenge = await prisma.challenge.findUnique({
      where: { id },
      include: { caravan: true }
    });

    if (!challenge || challenge.type !== 'quiz') {
      return res.status(404).json({ error: 'آزمون مورد نظر یافت نشد' });
    }

    // Verify student belongs to this caravan if caravan-locked
    if (challenge.caravanId) {
      const student = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, caravanId: true }
      });
      if (student?.caravanId && student.caravanId !== challenge.caravanId) {
        return res.status(403).json({ error: 'این آزمون متعلق به کاروان شما نیست' });
      }
    }

    const questionsList = challenge.questions ? JSON.parse(challenge.questions) : [];
    let correctCount = 0;

    for (let i = 0; i < questionsList.length; i++) {
      if (answers[i] === questionsList[i].correct) {
        correctCount++;
      }
    }

    const calculatedReward = correctCount * 10; // 10 Zarik per correct answer

    // Update student balance
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        zarikBalance: { increment: calculatedReward }
      }
    });

    // Save submission record
    const submission = await prisma.submission.create({
      data: {
        challengeId: id,
        studentId: req.user.id,
        status: 'approved',
        score: correctCount,
        mentorFeedback: `ثبت خودکار پاسخنامه آزمون. نمره: ${correctCount}/${questionsList.length}`,
        answerText: `پاسخ‌ها: ${JSON.stringify(answers)}`
      }
    });

    // Send reward notification
    await prisma.notification.create({
      data: {
        userId: req.user.id,
        title: 'ثبت پاداش آزمون 💰',
        message: `آزمون شما بررسی شد. پاسخ‌های صحیح: ${correctCount} از ۵. مقدار پاداش: +${calculatedReward} زریک.`,
        type: 'reward'
      }
    });

    res.json({
      score: correctCount,
      total: questionsList.length,
      rewardZarik: calculatedReward,
      zarikBalance: updatedUser.zarikBalance,
      submissionId: submission.id
    });
  } catch (error) {
    console.error('submitQuiz error:', error);
    res.status(500).json({ error: 'خطایی در تصحیح و ثبت آزمون رخ داد' });
  }
}
