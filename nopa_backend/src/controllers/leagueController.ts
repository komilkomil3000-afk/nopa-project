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
          select: { zarikBalance: true, nakh: true, farsh: true, beyragh: true }
        }
      }
    });

    const rankedCaravans = caravans.map(c => {
      const totalWealth = c.members.reduce((sum, m) => sum + m.zarikBalance + m.nakh * 100 + m.farsh * 1000 + m.beyragh * 500, 0); // Approx wealth score
      const totalZarik = c.members.reduce((sum, m) => sum + m.zarikBalance, 0);
      const totalNakh = c.members.reduce((sum, m) => sum + m.nakh, 0);
      const totalFarsh = c.members.reduce((sum, m) => sum + m.farsh, 0);
      const totalBeyragh = c.members.reduce((sum, m) => sum + m.beyragh, 0);

      return {
        id: c.id,
        name: c.name,
        mentorName: c.mentor?.name || '-',
        memberCount: c.memberCount,
        capacityLimit: c.capacityLimit,
        overallProgress: c.overallProgress,
        totalWealth,
        assets: { zarik: totalZarik, nakh: totalNakh, farsh: totalFarsh, beyragh: totalBeyragh }
      };
    });

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
        caravan: true,
        submissions: { select: { id: true, status: true } },
        supportReplies: { select: { id: true, createdAt: true } },
      }
    });

    const rankedMentors = await Promise.all(mentors.map(async m => {
      const ratings = await prisma.mentorRating.findMany({
        where: { mentorId: m.id }
      });
      const avg = ratings.length > 0 
        ? ratings.reduce((sum, r) => sum + r.ratingValue, 0) / ratings.length 
        : 4.5;
        
      const caravanProgress = m.caravan ? m.caravan.overallProgress : 0;
      const activityScore = m.submissions.length * 2 + m.supportReplies.length * 5;

      return {
        id: m.id,
        name: m.name,
        phoneNumber: m.phoneNumber,
        avatarUrl: m.avatarUrl,
        caravanName: m.caravan?.name || '-',
        mentorLevel: m.mentorLevel,
        rating: parseFloat(avg.toFixed(1)),
        reviewsCount: ratings.length,
        caravanProgress,
        activityScore
      };
    }));

    if (sortBy === 'rating') {
      rankedMentors.sort((a, b) => b.rating - a.rating);
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
