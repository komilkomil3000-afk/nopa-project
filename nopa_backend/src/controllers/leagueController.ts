import { Request, Response } from 'express';
import prisma from '../config/db';

export async function getCaravanLeague(req: Request, res: Response) {
  try {
    const sortBy = (req.query.sortBy as string) || 'progress';
    const exportAs = req.query.exportAs as string;
    
    const caravans = await prisma.caravan.findMany({
      include: {
        mentor: {
          select: { name: true }
        },
        members: {
          select: { id: true, zarikBalance: true, nakh: true, farsh: true, beyragh: true }
        }
      }
    });

    const totalSessions = await prisma.classSession.count({ where: { isDeleted: false } });
    const totalQuizzes = await prisma.quiz.count();
    const totalAvailableCurriculumItems = totalSessions + totalQuizzes;

    const rankedCaravans = await Promise.all(caravans.map(async c => {
      const totalWealth = c.members.reduce((sum, m) => sum + m.zarikBalance + m.nakh * 100 + m.farsh * 1000 + m.beyragh * 500, 0);
      const totalZarik = c.members.reduce((sum, m) => sum + m.zarikBalance, 0);
      const totalNakh = c.members.reduce((sum, m) => sum + m.nakh, 0);
      const totalFarsh = c.members.reduce((sum, m) => sum + m.farsh, 0);
      const totalBeyragh = c.members.reduce((sum, m) => sum + m.beyragh, 0);

      let caravanProgress = 0;
      const totalMembers = c.members.length;

      if (totalMembers > 0 && totalAvailableCurriculumItems > 0) {
        let passedQuizzesCount = 0;
        let watchedSessionsCount = 0;

        for (const member of c.members) {
          const passedQuizzes = await prisma.quizSubmission.count({
            where: {
              studentId: member.id,
              OR: [{ score: { gt: 0 } }, { status: 'approved' }]
            }
          });

          const watchedSessions = await prisma.sessionWatchRecord.count({
            where: {
              userId: member.id,
              watchedPercentage: { gte: 70.0 }
            }
          });

          passedQuizzesCount += passedQuizzes;
          watchedSessionsCount += watchedSessions;
        }

        const calcProgress = ((passedQuizzesCount + watchedSessionsCount) / (totalAvailableCurriculumItems * totalMembers)) * 100;
        caravanProgress = Math.min(100, parseFloat(calcProgress.toFixed(2)));
      }

      return {
        id: c.id,
        name: c.name,
        mentorName: c.mentor?.name || '-',
        memberCount: c.members.length,
        capacityLimit: c.capacityLimit,
        overallProgress: caravanProgress,
        totalWealth,
        assets: { zarik: totalZarik, nakh: totalNakh, farsh: totalFarsh, beyragh: totalBeyragh }
      };
    }));

    if (sortBy === 'wealth') {
      rankedCaravans.sort((a, b) => b.totalWealth - a.totalWealth);
    } else {
      rankedCaravans.sort((a, b) => b.overallProgress - a.overallProgress);
    }

    if (exportAs === 'csv') {
      let csv = 'Name,Mentor,Members,Progress,Total Zarik,Total Nakh,Total Farsh,Total Beyragh\n';
      rankedCaravans.forEach(c => {
        csv += `${c.name},${c.mentorName},${c.memberCount},${c.overallProgress},${c.assets.zarik},${c.assets.nakh},${c.assets.farsh},${c.assets.beyragh}\n`;
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="caravan_league.csv"');
      return res.send(Buffer.from('\uFEFF' + csv, 'utf-8'));
    }

    res.json(rankedCaravans);
  } catch (error) {
    console.error('getCaravanLeague error:', error);
    res.status(500).json({ error: 'خطایی در دریافت جدول لیگ کاروان‌ها رخ داد' });
  }
}

export async function getWealthiestLeague(req: Request, res: Response) {
  try {
    const wealthiest = await prisma.user.findMany({
      where: { role: 'student' },
      orderBy: { zarikBalance: 'desc' },
      select: {
        id: true,
        name: true,
        zarikBalance: true,
        avatarUrl: true,
        levelFrame: true
      }
    });

    res.json(wealthiest);
  } catch (error) {
    console.error('getWealthiestLeague error:', error);
    res.status(500).json({ error: 'خطایی در دریافت جدول ثروتمندترین‌ها رخ داد' });
  }
}

export async function getMentorLeague(req: Request, res: Response) {
  try {
    const search = (req.query.search as string) || '';
    const sortBy = (req.query.sortBy as string) || 'rating';
    const exportAs = req.query.exportAs as string;
    
    const whereClause: any = { role: 'mentor' };
    
    if (search) {
      whereClause.OR = [
        { name: { contains: search } },
        { phoneNumber: { contains: search } }
      ];
    }

    const mentors = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        avatarUrl: true,
        mentorLevel: true,
        mentoredCaravans: { select: { id: true, name: true, overallProgress: true } },
        submissions: { select: { id: true, status: true } },
        supportReplies: { select: { id: true, createdAt: true } },
        evaluationsReceived: true,
      }
    });

    const rankedMentors = mentors.map(m => {
      const evals = m.evaluationsReceived || [];
      const avg = evals.length > 0 
        ? evals.reduce((sum, e) => sum + e.rating, 0) / evals.length 
        : 0; // Return 0 instead of mock 4.5
        
      const caravanNames = m.mentoredCaravans.length > 0 
        ? m.mentoredCaravans.map(c => c.name).join(', ') 
        : '-';

      const caravanProgress = m.mentoredCaravans.length > 0
        ? m.mentoredCaravans.reduce((sum, c) => sum + c.overallProgress, 0) / m.mentoredCaravans.length
        : 0;

      const activityScore = m.submissions.length * 2 + m.supportReplies.length * 5;

      return {
        id: m.id,
        name: m.name,
        phoneNumber: m.phoneNumber,
        avatarUrl: m.avatarUrl,
        caravanName: caravanNames,
        mentorLevel: m.mentorLevel,
        rating: avg > 0 ? parseFloat(avg.toFixed(1)) : '-',
        reviewsCount: evals.length,
        caravanProgress: parseFloat(caravanProgress.toFixed(1)),
        activityScore
      };
    });

    if (sortBy === 'rating') {
      rankedMentors.sort((a, b) => (typeof b.rating === 'number' ? b.rating : 0) - (typeof a.rating === 'number' ? a.rating : 0));
    } else if (sortBy === 'progress') {
      rankedMentors.sort((a, b) => b.caravanProgress - a.caravanProgress);
    } else if (sortBy === 'activity') {
      rankedMentors.sort((a, b) => b.activityScore - a.activityScore);
    } else if (sortBy === 'level') {
      rankedMentors.sort((a, b) => b.mentorLevel - a.mentorLevel);
    }

    if (exportAs === 'csv') {
      let csv = 'Name,Phone,Caravan,Level,Rating,Progress,Activity\n';
      rankedMentors.forEach(m => {
        csv += `${m.name},${m.phoneNumber},${m.caravanName},${m.mentorLevel},${m.rating},${m.caravanProgress},${m.activityScore}\n`;
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="mentors_league.csv"');
      return res.send(Buffer.from('\uFEFF' + csv, 'utf-8'));
    }

    res.json(rankedMentors);
  } catch (error) {
    console.error('getMentorLeague error:', error);
    res.status(500).json({ error: 'خطایی در دریافت جدول امتیازدهی راهبران رخ داد' });
  }
}
