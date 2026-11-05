import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/db';
import { addActivity } from '../services/activity';
import { logLiveEvent, markAppAway, parseArea, touchApp } from '../services/liveActivity';
import { APP_AREAS, isAppSection, logUserEvents, UserLogEntry } from '../services/userLog';
import { CATEGORY_ORDER_BY, trackTypeFor } from '../utils/stationCategories';

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
          title: 'چالش جدید کاروان ابلاغ شد',
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

/** "YYYY-MM-DD" of a moment in Asia/Tehran (the day the app usage is counted on). */
export function tehranDay(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** The app reports the seconds it was open in the foreground; they are added to today's row (capped per call).
 *  Newer app versions send it every ~15 s (also a heartbeat for «online now») with:
 *    area      the part of the app on screen (services/userLog.ts APP_AREAS) or "away" (went to the background)
 *    playing   a video is playing now
 *    areas     { part: seconds } how the seconds were spent among the parts of the app
 *    chatSeconds / videoSeconds   seconds in the chat / with any video playing (older versions send only these)
 *    events    [{ type: "enter", area, label, refId, at }] parts of the app entered since the last report (the
 *              person's activity log in the panel) */
export async function recordAppUsage(req: AuthRequest, res: Response) {
  try {
    const body = req.body || {};
    const seconds = Math.max(0, Math.min(300, Math.round(Number(body.seconds) || 0)));
    // times the app was opened (or came back after a while) since the last report; sent by newer app versions
    const opens = Math.max(0, Math.min(20, Math.round(Number(body.opens) || 0)));
    const chatSeconds = Math.max(0, Math.min(seconds, Math.round(Number(body.chatSeconds) || 0)));
    const videoSeconds = Math.max(0, Math.min(seconds, Math.round(Number(body.videoSeconds) || 0)));
    const { area, playing } = parseArea(body.area, body.playing);
    const userId = req.user!.id;

    // seconds per part of the app (never more than the reported seconds in all)
    const areas: [string, number][] = [];
    if (body.areas && typeof body.areas === 'object') {
      let left = seconds;
      for (const k of APP_AREAS) {
        const v = Math.max(0, Math.min(left, Math.round(Number(body.areas[k]) || 0)));
        if (v > 0) { areas.push([k, v]); left -= v; }
      }
    }

    const events: UserLogEntry[] = [];
    if (opens > 0) events.push({ type: 'open', label: 'اپ را باز کرد' });
    if (Array.isArray(body.events)) {
      for (const e of body.events.slice(0, 40)) {
        if (!e || e.type !== 'enter' || !isAppSection(e.area)) continue;
        events.push({ type: 'enter', area: e.area, refId: e.refId, label: e.label, at: e.at ? new Date(e.at) : undefined });
      }
    }
    if (area === 'away') events.push({ type: 'away', label: 'از اپ بیرون رفت' });
    void logUserEvents(userId, events);

    if (opens > 0) logLiveEvent(userId, 'open');
    if (area === 'away') markAppAway(userId); else touchApp(userId, area, playing);
    if (opens > 0) await addActivity(userId, 'open', opens);
    if (seconds === 0) return res.json({ ok: true });
    await Promise.all([
      addActivity(userId, 'app', seconds),
      chatSeconds ? addActivity(userId, 'chat', chatSeconds) : null,
      videoSeconds ? addActivity(userId, 'appvideo', videoSeconds) : null,
      ...areas.map(([k, v]) => addActivity(userId, 'area', v, k)),
    ]);
    const day = tehranDay(new Date());
    await prisma.userUsageDay.upsert({
      where: { userId_day: { userId, day } },
      create: { userId, day, seconds },
      update: { seconds: { increment: seconds } }
    });
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

/** The signed-in user's own challenge participation and time in the app (same shape as one member of caravan-progress). */
export async function getMyActivityStats(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { caravanId: true, caravan: { select: { id: true, mentorId: true } } }
    });
    const caravan = me?.caravan || null;

    // Challenges this user can see (same rules as the mentor's view of a caravan member)
    const adminIds = (await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } })).map(a => a.id);
    const challengeOr: any[] = [];
    if (caravan) {
      challengeOr.push({ caravanId: caravan.id });
      if (caravan.mentorId) challengeOr.push({ createdByMentorId: caravan.mentorId });
    }
    if (adminIds.length > 0) challengeOr.push({ AND: [{ caravanId: null }, { createdByMentorId: { in: adminIds } }] });
    const challenges = challengeOr.length > 0
      ? await prisma.challenge.findMany({ where: { OR: challengeOr }, select: { id: true, recipientIds: true, stationId: true } })
      : [];
    const visible = challenges.filter(c => c.recipientIds.length === 0 || c.recipientIds.includes(userId));
    const visibleIds = new Set(visible.map(c => c.id));
    const submissions = await prisma.submission.findMany({ where: { studentId: userId }, select: { challengeId: true } });
    const participated = new Set(submissions.map(s => s.challengeId).filter(id => visibleIds.has(id)));

    const challengesByStation: Record<string, { total: number; participated: number }> = {};
    for (const c of visible) {
      const key = c.stationId || '';
      const row = challengesByStation[key] || (challengesByStation[key] = { total: 0, participated: 0 });
      row.total++;
      if (participated.has(c.id)) row.participated++;
    }

    const usageSince = tehranDay(new Date(Date.now() - 29 * 86400000));
    const usageRows = await prisma.userUsageDay.findMany({
      where: { userId, day: { gte: usageSince } },
      select: { day: true, seconds: true }
    });
    const usageDays: Record<string, number> = {};
    usageRows.forEach(u => { usageDays[u.day] = u.seconds; });

    res.json({
      challengesTotal: visible.length,
      challengesParticipated: participated.size,
      challengesByStation,
      usageDays
    });
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
          orderBy: CATEGORY_ORDER_BY
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

    // Format stations: every class category (any number, in admin-panel order, under its own title) with its
    // sessions, plus the quizzes. skillSessions / mediaSessions are the first two categories, kept for older app builds.
    const stations = rawStations.map((st, sIdx) => {
      const liveSessions = (cat: any): any[] => (cat.sessions || []).filter((x: any) => !x.isDeleted);
      const toReportSessions = (cat: any) => liveSessions(cat).map((sess: any, idx: number) => ({
        id: sess.id,
        title: sess.title || `جلسه ${idx + 1}`,
        totalParts: sess.videoClips.length,
        clips: sess.videoClips
      }));

      const classCategories = st.categories.map((cat: any, ci: number) => ({
        id: cat.id,
        title: cat.title,
        orderIndex: cat.orderIndex,
        trackType: trackTypeFor(ci),
        sessions: toReportSessions(cat)
      }));
      const skillSessions = classCategories[0]?.sessions || [];
      const mediaSessions = classCategories[1]?.sessions || [];

      // One entry per quiz ("آزمونک" of a part) with the clip it belongs to, so a member's result can be matched
      const allQuizzes: any[] = [];
      for (let ci = 0; ci < st.categories.length; ci++) {
        const cat = st.categories[ci];
        const trackType = trackTypeFor(ci);
        for (const sess of liveSessions(cat)) {
          for (const q of sess.quizzes) {
            const clip = (q.clipId && sess.videoClips.find((c: any) => c.id === q.clipId))
              || sess.videoClips.find((c: any) => c.clipOrder === q.orderIndex)
              || null;
            allQuizzes.push({
              id: q.id,
              title: q.title || `آزمون ${sess.title}`,
              sessionId: sess.id,
              sessionTitle: sess.title,
              clipId: clip ? clip.id : null,
              clipTitle: clip ? clip.title : null,
              trackType,
              categoryId: cat.id,
              categoryTitle: cat.title,
              orderIndex: q.orderIndex,
              type: q.type,
              totalQuestions: parseQuestions(q.questionsJson).length || 1
            });
          }
        }
      }

      // The station's gallery (نگارستان), same shape as the student's station list
      let stationAnimations: any[] = [];
      if (st.animationsJson) {
        try {
          const parsed = JSON.parse(st.animationsJson);
          if (Array.isArray(parsed)) stationAnimations = parsed;
        } catch (_) {}
      }
      if (stationAnimations.length === 0 && st.animationUrl) {
        stationAnimations.push({
          id: `anim-${st.id}`,
          title: st.animationTitle || 'انیمیشن معرفی منزلگاه',
          url: st.animationUrl,
          videoUrl: st.animationUrl,
          description: st.description || ''
        });
      }

      return {
        id: st.id,
        title: st.title,
        description: st.subtitle || st.description || 'توضیحات منزلگاه',
        imageUrl: st.iconUrl || stationAnimations.map((a: any) => a?.coverImageUrl || (/.(jpe?g|png|webp|gif|avif|bmp|svg)$/i.test(String(a?.url || a?.videoUrl || '').split('?')[0]) ? (a.url || a.videoUrl) : '')).find((x: string) => x) || '',
        orderIndex: st.orderIndex,
        classCategories,
        skillSessions,
        mediaSessions,
        quizzes: allQuizzes,
        stayDuration: st.stayDuration || null,
        animationCount: (st as any).animationCount ?? null,
        animations: stationAnimations,
        animationTitle: st.animationTitle,
        animationUrl: st.animationUrl,
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
      ? await prisma.challenge.findMany({ where: { OR: challengeOr }, select: { id: true, recipientIds: true, stationId: true } })
      : [];
    const challengeSubmissions = memberIds.length > 0
      ? await prisma.submission.findMany({ where: { studentId: { in: memberIds } }, select: { challengeId: true, studentId: true } })
      : [];

    // Time in the app per member and day (last 30 days, Asia/Tehran days)
    const usageSince = tehranDay(new Date(Date.now() - 29 * 86400000));
    const usageRows = memberIds.length > 0
      ? await prisma.userUsageDay.findMany({ where: { userId: { in: memberIds }, day: { gte: usageSince } }, select: { userId: true, day: true, seconds: true } })
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

      // Participation per station (challenges without a station are filed under "")
      const challengesByStation: Record<string, { total: number; participated: number }> = {};
      for (const c of visibleChallenges) {
        const key = c.stationId || '';
        const row = challengesByStation[key] || (challengesByStation[key] = { total: 0, participated: 0 });
        row.total++;
        if (participated.has(c.id)) row.participated++;
      }
      const usageDays: Record<string, number> = {};
      usageRows.filter(u => u.userId === m.id).forEach(u => { usageDays[u.day] = u.seconds; });

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
        challengesByStation,
        usageDays,
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
    const mentorScope = isAdmin ? {} : { mentorId: req.user!.id };
    let caravans = await prisma.caravan.findMany({
      where: { ...mentorScope, ...(caravanId ? { id: String(caravanId) } : {}) },
      select: { id: true, name: true }
    });
    // A stale/foreign caravanId from the app must not block the message: fall back to the mentor's own caravans
    if (caravans.length === 0 && caravanId) {
      caravans = await prisma.caravan.findMany({ where: mentorScope, select: { id: true, name: true } });
    }
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

    // Keep a copy of every sent message in the mentor's private notes about each student
    await prisma.privateStudentNote.createMany({
      data: recipients.map(r => ({
        mentorId: req.user!.id,
        studentId: r.id,
        noteText: `${cleanTitle}\n${cleanMessage}`
      }))
    });

    res.status(201).json({ sent: recipients.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
