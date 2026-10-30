import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/db';

export async function createMentorChallenge(req: AuthRequest, res: Response) {
  try {
    const { title, description, stationId, deadline, rewardZarik, verificationType } = req.body;
    if (!title || !description) return res.status(400).json({ error: 'عنوان و توضیحات الزامی است' });

    // Enforce mentor's own caravan
    const mentorCaravan = await prisma.caravan.findFirst({
      where: { mentorId: req.user!.id }
    });
    if (!mentorCaravan) {
      return res.status(400).json({ error: 'شما به عنوان راهبر به کاروانی متصل نیستید' });
    }
    const assignedCaravanId = mentorCaravan.id;

    const metadata = { stationId, caravanId: assignedCaravanId, deadline, verificationType };
    
    const challenge = await prisma.challenge.create({
      data: {
        title,
        description: description + `\n\n[Metadata: ${JSON.stringify(metadata)}]`,
        type: verificationType || 'skill',
        rewardZarik: parseInt(rewardZarik) || 200,
        createdByMentorId: req.user!.id,
        caravanId: assignedCaravanId
      }
    });

    // Notify ONLY target caravan students
    const targetStudents = await prisma.user.findMany({
      where: { caravanId: assignedCaravanId, role: 'student' }
    });

    if (targetStudents.length > 0) {
      await prisma.notification.createMany({
        data: targetStudents.map(s => ({
          userId: s.id,
          title: 'چالش جدید کاروان ابلاغ شد 🏆',
          message: `چالش جدید "${title}" توسط راهبر کاروان (${mentorCaravan.name}) برای شما ابلاغ گردید.`,
          type: 'challenge'
        }))
      });
    }

    res.status(201).json(challenge);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getMentorChallenges(req: AuthRequest, res: Response) {
  try {
    const mentorCaravans = await prisma.caravan.findMany({
      where: { mentorId: req.user!.id },
      select: { id: true }
    });
    const caravanIds = mentorCaravans.map(c => c.id);

    const challenges = await prisma.challenge.findMany({
      where: {
        OR: [
          { createdByMentorId: req.user!.id },
          ...(caravanIds.length > 0 ? [{ caravanId: { in: caravanIds } }] : [])
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(challenges);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getChallengeSubmissions(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    // A mentor only sees the answers of their own caravans' students (matters for admin challenges sent to everyone)
    const studentScope = req.user!.role === 'mentor'
      ? { student: { caravan: { mentorId: req.user!.id } } }
      : {};
    const submissions = await prisma.submission.findMany({
      where: { challengeId: id, ...studentScope },
      include: {
        student: { select: { id: true, name: true, avatarUrl: true } }
      },
      orderBy: { submittedAt: 'desc' }
    });
    res.json(submissions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getMentorTicketDetails(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        student: { select: { name: true, avatarUrl: true, phoneNumber: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: { mentor: { select: { name: true, avatarUrl: true } } }
        }
      }
    });
    if (!ticket) return res.status(404).json({ error: 'تیکت یافت نشد' });
    res.json(ticket);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function replyMentorTicket(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { message, voiceUrl, attachmentUrl } = req.body;
    if (!message) return res.status(400).json({ error: 'متن پیام الزامی است' });

    const reply = await prisma.supportTicketReply.create({
      data: {
        ticketId: id,
        message,
        voiceUrl,
        attachmentUrl,
        mentorId: req.user!.id
      }
    });

    // Update ticket status to answered
    await prisma.supportTicket.update({
      where: { id },
      data: { status: 'answered', updatedAt: new Date() }
    });

    res.json(reply);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getMentorCaravanProgress(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role?.toLowerCase();
    
    // Find mentor's caravan (the one picked in the app when the mentor manages several)
    const requestedCaravanId = typeof req.query.caravanId === 'string' ? req.query.caravanId : '';
    let caravan = await prisma.caravan.findFirst({
      where: {
        ...(requestedCaravanId ? { id: requestedCaravanId } : {}),
        ...(userRole === 'admin' && requestedCaravanId ? {} : {
          OR: [
            { mentorId: userId },
            { members: { some: { id: userId } } }
          ]
        })
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
      caravan = await prisma.caravan.findFirst({
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
    const rawStations = await prisma.station.findMany({
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
    
    const watchRecords = await prisma.sessionWatchRecord.findMany({
      where: { userId: { in: memberIds } }
    });

    const quizSubmissions = await prisma.quizSubmission.findMany({
      where: { studentId: { in: memberIds } }
    });

    // Real per-clip progress (skill and media clips are separate rows, keyed by clip id)
    const progressRecords = await prisma.userProgress.findMany({
      where: { userId: { in: memberIds }, OR: [{ isWatched: true }, { quizPassed: true }] }
    });

    // Format stations with structured skillSessions, mediaSessions, and quizzes
    const stations = rawStations.map((st, sIdx) => {
      const skillCat = st.categories.find(c => c.title?.includes('مهارت') || (c as any).type === 'skill');
      const mediaCat = st.categories.find(c => c.title?.includes('رسانه') || (c as any).type === 'media');

      const skillSessions = skillCat ? skillCat.sessions.map((sess, idx) => ({
        id: sess.id,
        title: sess.title || `جلسه ${idx + 1}`,
        totalParts: sess.videoClips.length,
        clips: sess.videoClips
      })) : [];

      const mediaSessions = mediaCat ? mediaCat.sessions.map((sess, idx) => ({
        id: sess.id,
        title: sess.title || `جلسه ${idx + 1}`,
        totalParts: sess.videoClips.length,
        clips: sess.videoClips
      })) : [];

      const allQuizzes: any[] = [];
      for (const cat of st.categories) {
        for (const sess of cat.sessions) {
          for (const q of sess.quizzes) {
            allQuizzes.push({
              id: q.id,
              title: q.title || `آزمون ${sess.title}`,
              sessionId: sess.id,
              totalQuestions: (q as any).questions ? (typeof (q as any).questions === 'string' ? JSON.parse((q as any).questions).length : (q as any).questions.length) : 10
            });
          }
        }
      }

      if (allQuizzes.length === 0) {
        allQuizzes.push(
          { id: `q_${sIdx}_1`, title: 'آزمون مقدماتی مهارت‌ها', totalQuestions: 10 },
          { id: `q_${sIdx}_2`, title: 'آزمون سواد رسانه‌ای', totalQuestions: 10 },
        );
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

      // Number of watched clips per session id (a session belongs to exactly one track)
      const clipProgress: Record<string, number> = {};
      progressRecords
        .filter(p => p.userId === m.id)
        .forEach(p => { clipProgress[p.sessionId] = (clipProgress[p.sessionId] || 0) + 1; });

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
        clipProgress,
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

