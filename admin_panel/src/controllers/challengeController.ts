import { randomBytes } from 'crypto';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { stripAnswerKeys } from '../utils/answerKeys';
import { isMentorRole } from '../utils/roles';
import prisma from '../config/db';

/** Validates the reward asset and the min/max range a mentor chooses from when approving an answer. */
function parseRewardRange(body: any): { error: string } | { data: { rewardAssetType: string; rewardMin: number; rewardMax: number } } {
  const rewardAssetType = String(body.rewardAssetType || 'zarik').toLowerCase();
  if (!['zarik', 'nakh'].includes(rewardAssetType)) {
    return { error: 'نوع دارایی جایزه باید زریک یا نخ باشد' };
  }
  const rewardMin = Number(body.rewardMin ?? 0);
  const rewardMax = Number(body.rewardMax ?? 0);
  if (!Number.isInteger(rewardMin) || !Number.isInteger(rewardMax) || rewardMin < 0 || rewardMax < 0) {
    return { error: 'حداقل و حداکثر جایزه باید عدد صحیح نامنفی باشند' };
  }
  if (rewardMin > rewardMax) {
    return { error: 'حداقل جایزه نمی‌تواند از حداکثر بیشتر باشد' };
  }
  return { data: { rewardAssetType, rewardMin, rewardMax } };
}

/**
 * One quiz shape for app, API and panel: type 'quiz', questions [{ q, options, correct }].
 * The panel's older 'step_by_step_quiz' / { question, correctIndex } are mapped onto it.
 */
function normalizeQuizPayload(type: string, questions: any): { type: string; questions: string | null } {
  const isQuiz = type === 'quiz' || type === 'step_by_step_quiz';
  let parsed = questions;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { return { type, questions: parsed }; }
  }
  if (!isQuiz || !Array.isArray(parsed)) {
    return { type, questions: parsed ? JSON.stringify(parsed) : null };
  }
  const list = parsed.map((item: any) => ({
    q: String(item?.q ?? item?.question ?? item?.text ?? ''),
    options: Array.isArray(item?.options) ? item.options.map((o: any) => String(o)) : [],
    correct: Number(item?.correct ?? item?.correctIndex ?? 0) || 0,
  }));
  return { type: 'quiz', questions: list.length > 0 ? JSON.stringify(list) : null };
}

export async function createChallenge(req: AuthRequest, res: Response) {
  try {
    if (!req.user || (req.user.role !== 'mentor' && req.user.role !== 'admin')) {
      return res.status(403).json({ error: 'تنها مربی‌ها و مدیران می‌توانند چالش ایجاد کنند' });
    }

    const { id, title, description, type, questions, rewardZarik, caravanId, targetMentorId, stationId, dueDate, startDate } = req.body;

    const rewardRange = parseRewardRange(req.body);
    if ('error' in rewardRange) {
      return res.status(400).json({ error: rewardRange.error });
    }

    if (!title || !description || !type) {
      return res.status(400).json({ error: 'فیلدهای عنوان، توضیحات و نوع چالش الزامی هستند' });
    }

    let creatorId = req.user.id;
    let assignedCaravanId: string | null = null;
    let category: 'intra_group' | 'inter_group' | 'individual' = 'intra_group';
    let recipientIds: string[] = [];

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

      // Either every member of the caravan or a non-empty selection of them
      const picked: string[] = Array.isArray(req.body.recipientIds)
        ? Array.from(new Set(req.body.recipientIds.map((r: any) => String(r))))
        : [];
      if (req.body.allMembers !== true && picked.length === 0) {
        return res.status(400).json({ error: 'دریافت‌کننده‌ی چالش را انتخاب کنید (یک یا چند عضو، یا همه اعضا)' });
      }
      if (req.body.allMembers !== true) {
        const valid = await prisma.user.findMany({
          where: { id: { in: picked }, caravanId: mentorCaravan.id, role: 'student' },
          select: { id: true }
        });
        if (valid.length !== picked.length) {
          return res.status(400).json({ error: 'دریافت‌کننده‌ها باید اعضای کاروان شما باشند' });
        }
        recipientIds = picked;
        category = 'individual';
      }
    } else if (req.user.role === 'admin') {
      if (targetMentorId) {
        creatorId = targetMentorId;
      }
      if (caravanId === 'inter_group') {
        category = 'inter_group';
      } else if (caravanId && caravanId !== 'all') {
        assignedCaravanId = caravanId;
      }
    }

    // Generate readable ID if not provided, e.g. CH + random
    const challengeId = id && id.trim() ? id.trim() : `CH${randomBytes(4).toString('hex').toUpperCase()}`;

    if (startDate && dueDate && new Date(startDate) > new Date(dueDate)) {
      return res.status(400).json({ error: 'تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد' });
    }

    const normalized = normalizeQuizPayload(type, questions);

    const challenge = await prisma.challenge.create({
      data: {
        id: challengeId,
        title,
        description,
        type: normalized.type,
        questions: normalized.questions,
        // rewardZarik doubles as the headline amount: the top of the range when one is set
        rewardZarik: rewardRange.data.rewardMax > 0 ? rewardRange.data.rewardMax : (Number(rewardZarik) || 50),
        ...rewardRange.data,
        createdByMentorId: creatorId,
        caravanId: assignedCaravanId,
        category,
        recipientIds,
        stationId: stationId || null,
        startDate: startDate ? new Date(startDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null
      }
    });

    // Notify: "ایجاد و نتیجه هر چالش باید درون برنامه به فرد و راهبر اطلاع داده شود و اعلان داده شود."
    const isByAdmin = req.user.role === 'admin';
    const creatorName = isByAdmin ? 'مدیر سیستم' : ((req.user as any).name || 'راهبر');

    let targetStudents: { id: string }[] = [];
    if (assignedCaravanId) {
      targetStudents = recipientIds.length > 0
        ? recipientIds.map(id => ({ id }))
        : await prisma.user.findMany({
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
          message: `چالش جدید "${title}" توسط ${creatorName} منتشر گردید. پاداش: ${rewardRange.data.rewardMax > 0 ? `${rewardRange.data.rewardMin} تا ${rewardRange.data.rewardMax}` : (rewardZarik || 50)} ${rewardRange.data.rewardAssetType === 'nakh' ? 'نخ' : 'زریک'} 🪙`,
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
    const { title, description, type, questions, rewardZarik, caravanId, targetMentorId, stationId, dueDate, startDate } = req.body;

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
      // A mentor may only change a challenge nobody has taken part in yet
      const answered = await prisma.submission.count({ where: { challengeId: id } });
      if (answered > 0) {
        return res.status(409).json({ error: 'پس از شرکت اولین عضو، امکان ویرایش چالش وجود ندارد' });
      }
    }

    const updateData: any = {};
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    const normalized = normalizeQuizPayload(type || existing.type, questions !== undefined ? questions : existing.questions);
    if (type) updateData.type = normalized.type;
    if (questions !== undefined) updateData.questions = normalized.questions;
    if (rewardZarik !== undefined) updateData.rewardZarik = Number(rewardZarik);
    if (req.body.rewardAssetType !== undefined || req.body.rewardMin !== undefined || req.body.rewardMax !== undefined) {
      const range = parseRewardRange({
        rewardAssetType: req.body.rewardAssetType ?? existing.rewardAssetType,
        rewardMin: req.body.rewardMin ?? existing.rewardMin,
        rewardMax: req.body.rewardMax ?? existing.rewardMax
      });
      if ('error' in range) return res.status(400).json({ error: range.error });
      Object.assign(updateData, range.data);
      if (range.data.rewardMax > 0) updateData.rewardZarik = range.data.rewardMax;
    }
    if (stationId !== undefined) updateData.stationId = stationId || null;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
    const effStart = updateData.startDate !== undefined ? updateData.startDate : existing.startDate;
    const effDue = updateData.dueDate !== undefined ? updateData.dueDate : existing.dueDate;
    if (effStart && effDue && effStart > effDue) {
      return res.status(400).json({ error: 'تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد' });
    }
    if (req.user.role === 'admin') {
      if (targetMentorId) {
        updateData.createdByMentorId = targetMentorId;
      }
      if (caravanId !== undefined) {
        const isInter = caravanId === 'inter_group';
        updateData.caravanId = (caravanId === 'all' || isInter) ? null : caravanId;
        updateData.category = isInter ? 'inter_group' : (existing.recipientIds.length > 0 ? 'individual' : 'intra_group');
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

    // Reward reversal is opt-in (?revertRewards=true). By default deleting a challenge never touches
    // balances or the ledger: students keep what they legitimately earned and history stays intact.
    // (The old code decremented by `score`, which is not the reward for quizzes, and deleted every
    // ledger row whose reason merely contained the challenge title - for ALL users.)
    const revertRewards = String(req.query.revertRewards || '').toLowerCase() === 'true';

    await prisma.$transaction(async (tx) => {
      if (revertRewards) {
        const approved = await tx.submission.findMany({
          where: { challengeId: id, status: 'approved' },
          select: { studentId: true }
        });
        const studentIds = Array.from(new Set(approved.map(a => a.studentId)));

        if (studentIds.length > 0) {
          // Exact reason strings written when these rewards were granted, limited to the students
          // who actually have an approved submission on this challenge.
          const reasons = [
            `پاداش شرکت در آزمون چالش: ${existing.title}`,
            `پاداش تایید تکلیف: ${existing.title}`
          ];
          const granted = await tx.zarikTransaction.findMany({
            where: { userId: { in: studentIds }, reason: { in: reasons }, amount: { gt: 0 } }
          });

          const perStudent = new Map<string, number>();
          for (const g of granted) {
            perStudent.set(g.userId, (perStudent.get(g.userId) || 0) + g.amount);
          }

          for (const [studentId, total] of perStudent) {
            const student = await tx.user.findUnique({ where: { id: studentId }, select: { zarikBalance: true } });
            if (!student) continue;
            const clawback = Math.min(total, Math.max(student.zarikBalance, 0)); // never below zero
            if (clawback <= 0) continue;
            await tx.user.update({
              where: { id: studentId },
              data: { zarikBalance: { decrement: clawback } }
            });
            // Compensating ledger entry instead of deleting history
            await tx.zarikTransaction.create({
              data: {
                userId: studentId,
                amount: -clawback,
                category: 'Reversal',
                reason: `بازگشت پاداش به دلیل حذف چالش: ${existing.title}`,
                createdBy: req.user!.id
              }
            });
          }
        }
      }

      await tx.submission.deleteMany({ where: { challengeId: id } });
      await tx.challenge.delete({ where: { id } });
    });

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
    // Mentors only see (and count) the answers of their own caravans' students
    let mentorStudentIds: Set<string> | null = null;

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

        // Challenges an admin sent to every caravan (no caravan set) are managed by each mentor too
        const adminUsers = await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } });
        const adminIds = adminUsers.map(a => a.id);
        const caravanStudents = mentorCaravanIds.length > 0
          ? await prisma.user.findMany({ where: { caravanId: { in: mentorCaravanIds } }, select: { id: true } })
          : [];
        mentorStudentIds = new Set(caravanStudents.map(st => st.id));

        whereClause = {
          OR: [
            { createdByMentorId: user.id },
            ...(mentorCaravanIds.length > 0 ? [{ caravanId: { in: mentorCaravanIds } }] : []),
            ...(adminIds.length > 0 ? [{ AND: [{ caravanId: null }, { createdByMentorId: { in: adminIds } }] }] : [])
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

    if (user?.role === 'student') {
      whereClause = { AND: [whereClause, { OR: [{ recipientIds: { isEmpty: true } }, { recipientIds: { has: user.id } }] }] };
    }

    if (req.query.stationId && req.query.stationId !== 'all') {
      whereClause.stationId = req.query.stationId as string;
    }

    const { limit, page, take, skip } = req.query;
    const parsedTake = limit || take ? Math.min(Number(limit || take), 100) : undefined;
    const parsedSkip = skip ? Number(skip) : (page && parsedTake ? (Number(page) - 1) * parsedTake : undefined);

    const challenges = await prisma.challenge.findMany({
      where: whereClause,
      take: parsedTake,
      skip: parsedSkip,
      include: {
        station: {
          select: { id: true, title: true }
        },
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
            fileUrl: true,
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

    // Only staff may see answer keys; students get the questions without them
    const viewerRole = String(user?.role || '').toLowerCase();
    const viewerIsStaff = ['admin', 'mentor', 'super_mentor'].includes(viewerRole);

    const parsedChallenges = challenges.map(rawChallenge => {
      const c = mentorStudentIds
        ? { ...rawChallenge, submissions: rawChallenge.submissions.filter(sub => mentorStudentIds!.has(sub.studentId)) }
        : rawChallenge;
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
        // Students must not receive other students' answers; they only get their own submission
        submissions: viewerIsStaff ? c.submissions : c.submissions.filter(s => s.studentId === user?.id),
        questions: viewerIsStaff ? parsedQuestions : stripAnswerKeys(parsedQuestions),
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
          fileUrl: mySub.fileUrl,
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

    if (isMentorRole(req.user.role) || req.user.role === 'admin') {
      return res.status(403).json({ error: 'راهبر و مدیر در چالش شرکت نمی‌کنند و فقط آن را مدیریت می‌کنند' });
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

    if (!challenge || (challenge.type !== 'quiz' && challenge.type !== 'step_by_step_quiz')) {
      return res.status(404).json({ error: 'آزمون مورد نظر یافت نشد' });
    }

    if (challenge.recipientIds.length > 0 && !challenge.recipientIds.includes(req.user.id)) {
      return res.status(403).json({ error: 'این آزمون برای شما تعیین نشده است' });
    }
    if (challenge.startDate && new Date() < challenge.startDate) {
      return res.status(400).json({ error: 'این آزمون هنوز شروع نشده است' });
    }
    if (challenge.dueDate && new Date() > challenge.dueDate) {
      return res.status(400).json({ error: 'مهلت شرکت در این آزمون به پایان رسیده است' });
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

    // Prevent multiple submissions / repeat coin exploitation
    const existingSubmission = await prisma.submission.findFirst({
      where: { challengeId: id, studentId: req.user.id }
    });
    if (existingSubmission) {
      return res.status(400).json({ error: 'شما قبلاً در این آزمون شرکت کرده‌اید و ثبت مجدد امکان‌پذیر نیست' });
    }

    const questionsList = challenge.questions ? JSON.parse(challenge.questions) : [];
    let correctCount = 0;

    for (let i = 0; i < questionsList.length; i++) {
      if (answers[i] === (questionsList[i].correct ?? questionsList[i].correctIndex)) {
        correctCount++;
      }
    }

    // The challenge decides the asset and the range; the final amount follows the share of correct answers
    const assetType = challenge.rewardAssetType === 'nakh' ? 'nakh' : 'zarik';
    const assetLabel = assetType === 'nakh' ? 'نخ' : 'زریک';
    let calculatedReward: number;
    if (challenge.rewardMax > 0) {
      const share = questionsList.length > 0 ? correctCount / questionsList.length : 0;
      calculatedReward = Math.round(challenge.rewardMin + (challenge.rewardMax - challenge.rewardMin) * share);
    } else {
      calculatedReward = correctCount * 10; // legacy quizzes without a range
    }

    let submission: any;
    let updatedUser: any;

    await prisma.$transaction(async (tx) => {
      // Save submission record
      submission = await tx.submission.create({
        data: {
          challengeId: id,
          studentId: req.user!.id,
          status: 'approved',
          score: correctCount,
          mentorFeedback: `ثبت خودکار پاسخنامه آزمون. نمره: ${correctCount}/${questionsList.length}`,
          answerText: `پاسخ‌ها: ${JSON.stringify(answers)}`
        }
      });

      if (calculatedReward > 0) {
        // Credit the asset the challenge pays in
        updatedUser = await tx.user.update({
          where: { id: req.user!.id },
          data: assetType === 'nakh' ? { nakh: { increment: calculatedReward } } : { zarikBalance: { increment: calculatedReward } }
        });

        // Zarik movements are ledgered; nakh has no ledger table
        if (assetType === 'zarik') {
          await tx.zarikTransaction.create({
            data: {
              userId: req.user!.id,
              amount: calculatedReward,
              category: 'Quiz Rewards',
              reason: `پاداش شرکت در آزمون چالش: ${challenge.title}`,
              createdBy: req.user!.id
            }
          });
        }
      } else {
        updatedUser = await tx.user.findUnique({
          where: { id: req.user!.id }
        });
      }
    });

    // Result notification: score plus the asset that was added
    await prisma.notification.create({
      data: {
        userId: req.user.id,
        title: calculatedReward > 0 ? 'ثبت پاداش آزمون 💰' : 'نتیجه آزمون',
        message: `آزمون "${challenge.title}" بررسی شد. پاسخ‌های صحیح: ${correctCount} از ${questionsList.length}.` +
          (calculatedReward > 0 ? ` مقدار پاداش: +${calculatedReward} ${assetLabel} به حساب شما اضافه شد.` : ''),
        type: 'reward'
      }
    });

    res.json({
      score: correctCount,
      total: questionsList.length,
      rewardZarik: assetType === 'zarik' ? calculatedReward : 0,
      rewardAmount: calculatedReward,
      rewardAssetType: assetType,
      zarikBalance: updatedUser.zarikBalance,
      submissionId: submission.id
    });
  } catch (error: any) {
    // Unique (challengeId, studentId): a concurrent duplicate submit lost the race -> nothing was credited
    if (error?.code === 'P2002') {
      return res.status(400).json({ error: 'شما قبلاً در این آزمون شرکت کرده‌اید و ثبت مجدد امکان‌پذیر نیست' });
    }
    console.error('submitQuiz error:', error);
    res.status(500).json({ error: 'خطایی در تصحیح و ثبت آزمون رخ داد' });
  }
}
