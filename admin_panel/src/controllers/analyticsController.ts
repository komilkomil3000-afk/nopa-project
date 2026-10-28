import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

export const getDashboardAnalytics = async (req: Request, res: Response) => {
  try {
    const { timeframe } = req.query; // 'daily', 'weekly', 'monthly', 'annual'
    
    // Construct date filter
    const now = new Date();
    let startDate = new Date();
    if (timeframe === 'daily') startDate.setDate(now.getDate() - 1);
    else if (timeframe === 'weekly') startDate.setDate(now.getDate() - 7);
    else if (timeframe === 'monthly') startDate.setMonth(now.getMonth() - 1);
    else if (timeframe === 'annual') startDate.setFullYear(now.getFullYear() - 1);
    else startDate = new Date(0); // all-time

    const dateFilter = { gte: startDate };

    // Financial & Economy Analytics
    const zarikTransactions = await prisma.zarikTransaction.findMany({
      where: { createdAt: dateFilter }
    });
    
    let totalCirculation = 0;
    let totalPurchased = 0;
    zarikTransactions.forEach(t => {
      totalCirculation += t.amount;
      if (t.category.includes('Purchase') || t.category === 'Store') {
        totalPurchased += t.amount;
      }
    });

    const topEarners = await prisma.user.findMany({
      orderBy: { zarikBalance: 'desc' },
      take: 5,
      select: { name: true, zarikBalance: true }
    });

    // Product & Course Engagement
    const submissions = await prisma.submission.findMany({
      where: { submittedAt: dateFilter }
    });
    const totalSubmissions = submissions.length;
    const approvedSubmissions = submissions.filter(s => s.status === 'approved').length;
    const completionRate = totalSubmissions > 0 ? (approvedSubmissions / totalSubmissions) * 100 : 0;
    const avgScore = totalSubmissions > 0 ? submissions.reduce((sum, s) => sum + s.score, 0) / totalSubmissions : 0;

    // Mentor Evaluation Index
    const mentorRatings = await prisma.mentorRating.findMany({
      where: { createdAt: dateFilter },
      include: { mentor: true }
    });
    const avgMentorRating = mentorRatings.length > 0 
      ? mentorRatings.reduce((sum, r) => sum + r.ratingValue, 0) / mentorRatings.length 
      : 0;

    // Chart.js friendly time-series data (mocked aggregated data for charts)
    const labels = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
    const economyData = [1200, 1900, 3000, 5000, 2000, 3000, 4500];
    const engagementData = [20, 35, 40, 60, 45, 55, 70];

    res.json({
      financial: {
        totalCirculation,
        totalPurchased,
        topEarners
      },
      engagement: {
        totalSubmissions,
        completionRate: completionRate.toFixed(1) + '%',
        avgQuizScore: avgScore.toFixed(1)
      },
      evaluation: {
        avgMentorRating: avgMentorRating.toFixed(1),
        totalRatings: mentorRatings.length
      },
      charts: {
        labels,
        economyData,
        engagementData
      }
    });
  } catch (error) {
    console.error('Analytics Error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};

export const getMentorAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'کاربر احراز هویت نشده است' });
    }
    const userId = req.user.id;

    const assignmentsPending = await prisma.quizSubmission.count({
      where: { mentorId: userId, status: 'PENDING' }
    });

    const assignmentsReviewed = await prisma.quizSubmission.count({
      where: { mentorId: userId, status: { in: ['APPROVED', 'REJECTED', 'REVISION_NEEDED'] } }
    });

    const avgScore = await prisma.quizSubmission.aggregate({
      _avg: { score: true },
      where: { mentorId: userId, status: 'APPROVED' }
    });

    const reviewStats = await prisma.quizSubmission.groupBy({
      by: ['status'],
      where: { mentorId: userId },
      _count: { status: true }
    });

    const studentsUnderMentor = await prisma.user.count({
      where: { caravan: { mentorId: userId }, role: 'student' }
    });

    res.json({
      pendingReviews: assignmentsPending,
      totalReviewed: assignmentsReviewed,
      averageApprovedScore: avgScore._avg.score ?? 0,
      reviewBreakdown: reviewStats.reduce((acc: any, item: any) => ({
        ...acc,
        [item.status]: item._count.status
      }), {} as Record<string, number>),
      studentsUnderMentor
    });
  } catch (error) {
    console.error('getMentorAnalytics Error:', error);
    res.status(500).json({ error: 'Failed to fetch mentor analytics' });
  }
};
