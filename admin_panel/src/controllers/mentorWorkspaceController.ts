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

// A category title is free text: the keyword wins, otherwise the first free kind by position
// (first = skill, second = media), the same rule the app and the admin panel use.
function categoryKinds(titles: string[]): Array<'skill' | 'media' | null> {
  const kinds: Array<'skill' | 'media' | null> = titles.map(t =>
    t.includes('مهارت') ? 'skill' : (t.includes('رسانه') ? 'media' : null));
  kinds.forEach((k, i) => {
    if (k) return;
    if (!kinds.includes('skill')) kinds[i] = 'skill';
    else if (!kinds.includes('media')) kinds[i] = 'media';
  });
  return kinds;
}

function parseQuestions(raw: any): any[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function correctIndexOf(q: any): number {
  return Number(q && (q.correctIndex !== undefined ? q.correctIndex : (q.correct !== undefined ? q.correct : q.correctAnswer)));
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
      const catKinds = categoryKinds(st.categories.map(c => c.title || ''));
      const skillCats = st.categories.filter((_, i) => catKinds[i] === 'skill');
      const mediaCats = st.categories.filter((_, i) => catKinds[i] === 'media');

      const liveSessions = (cat: any): any[] => (cat.sessions || []).filter((x: any) => !x.isDeleted);

      const skillSessions = skillCats.length ? skillCats.flatMap(c => liveSessions(c)).map((sess: any, idx: number) => ({
        id: sess.id,
        title: sess.title || `جلسه ${idx + 1}`,
        totalParts: sess.videoClips.length,
        clips: sess.videoClips
      })) : [];

      const mediaSessions = mediaCats.length ? mediaCats.flatMap(c => liveSessions(c)).map((sess: any, idx: number) => ({
        id: sess.id,
        title: sess.title || `جلسه ${idx + 1}`,
        totalParts: sess.videoClips.length,
        clips: sess.videoClips
      })) : [];

      // One entry per quiz ("آزمونک" of a part) with the clip it belongs to, so a member's result can be matched
      const allQuizzes: any[] = [];
      for (let ci = 0; ci < st.categories.length; ci++) {
        const cat = st.categories[ci];
        const trackType = catKinds[ci] === 'media' ? 'media' : 'skill';
        for (const sess of liveSessions(cat)) {
          for (const q of sess.quizzes) {
            const clip = (q.clipId && sess.videoClips.find((c: any) => c.id === q.clipId))
              || sess.videoClips.find((c: any) => c.clipOrder === q.orderIndex)
              || null;
            allQuizzes.push({
              id: q.id,
              title: q.title || `آزمون §{sess.title}`,
              sessionId: sess.id,
              sessionTitle: sess.title,
              clipId: clip ? clip.id : null,
              clipTitle: clip ? clip.title : null,
              trackType,
              orderIndex: q.orderIndex,
              type: q.type,
              totalQuestions: parseQuestions(q.questionsJson).length || 1
            });
          }
        }
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

    // Quiz definitions by id (answer keys stay on the server; only per-question right/wrong is sent)
    const quizQuestions = new Map<string, any[]>();
    // Clip ids of every station in order (a station counts as completed when all of them are done)
    const stationClipIds: string[][] = [];
    for (const st of rawStations) {
      const clipIds: string[] = [];
      for (const cat of st.categories) {
        for (const sess of (cat.sessions as any[]).filter(x => !x.isDeleted)) {
          sess.videoClips.forEach((c: any) => clipIds.push(c.id));
          sess.quizzes.forEach((q: any) => quizQuestions.set(q.id, parseQuestions(q.questionsJson)));
        }
      }
      stationClipIds.push(clipIds);
    }

    // The challenges every member of this caravan can see (same rules as the member's own challenge list)
    const adminIds = (await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } })).map(a => a.id);
    const challengeOr: any[] = [];
    if (caravan) {
      challengeOr.push({ caravanId: caravan.id });
      if ((caravan as any).mentorId) challengeOr.push({ createdByMentorId: (caravan as any).mentorId });
    }
    if (adminIds.length > 0) challengeOr.push({ AND: [{ caravanId: null }, { createdByMentorId: { in: adminIds } }] });
    const caravanChallenges = challengeOr.length > 0
      ? await prisma.challenge.findMany({ where: { OR: challengeOr }, select: { id: true, recipientIds: true } })
      : [];
    const challengeSubmissions = memberIds.length > 0
      ? await prisma.submission.findMany({ where: { studentId: { in: memberIds } }, select: { challengeId: true, studentId: true } })
      : [];

    // Format members with real progress calculated from database
    const members = (caravan ? caravan.members : []).map(m => {
      const userQuizzes = quizSubmissions
        .filter(q => q.studentId === m.id)
        .sort((x, y) => y.submittedAt.getTime() - x.submittedAt.getTime());
      const userProgress = progressRecords.filter(p => p.userId === m.id);

      // Number of watched clips per session id (a session belongs to exactly one track)
      const clipProgress: Record<string, number> = {};
      // Per clip: watched / quiz passed and when
      const clipStatus: Record<string, any> = {};
      userProgress.forEach(p => {
        clipProgress[p.sessionId] = (clipProgress[p.sessionId] || 0) + 1;
        clipStatus[p.clipId] = {
          isWatched: p.isWatched,
          quizPassed: p.quizPassed,
          watchedAt: (p.isWatched ? p.createdAt : p.updatedAt).toISOString(),
          updatedAt: p.updatedAt.toISOString()
        };
      });

      // Latest result per quiz (submissions are sorted newest first), with right/wrong per question
      const quizResults: Record<string, any> = {};
      const attempts: Record<string, number> = {};
      userQuizzes.forEach(q => { attempts[q.quizId] = (attempts[q.quizId] || 0) + 1; });
      userQuizzes.forEach(q => {
        if (quizResults[q.quizId]) return;
        const questions = quizQuestions.get(q.quizId) || [];
        let answers: any[] = [];
        try { const parsed = q.answersJson ? JSON.parse(q.answersJson) : []; if (Array.isArray(parsed)) answers = parsed; } catch {}
        quizResults[q.quizId] = {
          status: q.status,
          score: q.score,
          total: questions.length || 1,
          passed: q.status === 'APPROVED',
          submittedAt: q.submittedAt.toISOString(),
          attempts: attempts[q.quizId],
          questionResults: questions.map((question, i) =>
            Number(answers[i]) === correctIndexOf(question) || String(answers[i]) === String(correctIndexOf(question)))
        };
      });

      // Stations completed in order, computed like the member's own profile does
      const doneIds = new Set(userProgress.map(p => p.clipId));
      let completedStationsCount = 0;
      for (const ids of stationClipIds) {
        if (ids.every(id => doneIds.has(id))) completedStationsCount++;
        else break;
      }

      const visibleChallenges = caravanChallenges.filter(c => c.recipientIds.length === 0 || c.recipientIds.includes(m.id));
      const visibleIds = new Set(visibleChallenges.map(c => c.id));
      const participated = new Set(
        challengeSubmissions.filter(sub => sub.studentId === m.id && visibleIds.has(sub.challengeId)).map(sub => sub.challengeId)
      );

      return {
        id: m.id,
        name: m.name || 'عضو کاروان',
        phoneNumber: m.phoneNumber || '',
        avatarUrl: m.avatarUrl || '',
        zarik: m.zarikBalance || 0,
        nakh: m.nakh || 0,
        farsh: m.farsh || 0,
        beyragh: m.beyragh || 0,
        levelFrame: m.levelFrame || 1,
        completedStationsCount,
        challengesTotal: visibleChallenges.length,
        challengesParticipated: participated.size,
        clipProgress,
        clipStatus,
        quizResults
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


/**
 * A mentor writes a message to the students of their caravan (all of them, or one when userId is given).
 * Each student gets it as an in-app notification.
 */
export async function sendMentorMessage(req: AuthRequest, res: Response) {
  try {
    const { title, message, caravanId, userId } = req.body;
    const cleanTitle = String(title || '').trim();
    const cleanMessage = String(message || '').trim();
    if (!cleanTitle || !cleanMessage) {
      return res.status(400).json({ error: 'عنوان و متن پیام الزامی است' });
    }

    const isAdmin = String(req.user!.role || '').toLowerCase() === 'admin';
    const caravans = await prisma.caravan.findMany({
      where: {
        ...(isAdmin ? {} : { mentorId: req.user!.id }),
        ...(caravanId ? { id: String(caravanId) } : {})
      },
      select: { id: true, name: true }
    });
    if (caravans.length === 0) {
      return res.status(400).json({ error: 'شما به کاروانی متصل نیستید' });
    }

    // Without a caravan picked, a mentor with several caravans writes to all of them
    const recipients = await prisma.user.findMany({
      where: {
        caravanId: { in: caravans.map(c => c.id) },
        role: 'student',
        isDeleted: false,
        ...(userId ? { id: String(userId) } : {})
      },
      select: { id: true }
    });
    if (recipients.length === 0) {
      return res.status(404).json({ error: 'گیرنده‌ای برای این پیام یافت نشد' });
    }

    await prisma.notification.createMany({
      data: recipients.map(r => ({
        userId: r.id,
        title: cleanTitle,
        message: cleanMessage,
        type: 'alert'
      }))
    });

    res.status(201).json({ sent: recipients.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
