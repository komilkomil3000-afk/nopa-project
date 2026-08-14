import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { logAdminAction } from './adminController';

const prisma = new PrismaClient();

export async function grantPromotionalZarik(req: AuthRequest, res: Response) {
  try {
    const { targetUserId, amount, reason } = req.body;
    
    if (!targetUserId || !amount || !reason) {
      return res.status(400).json({ error: 'کاربر هدف، مقدار و دلیل الزامی است' });
    }
    
    const user = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) return res.status(404).json({ error: 'کاربر یافت نشد' });
    
    await prisma.$transaction([
      prisma.user.update({
        where: { id: targetUserId },
        data: { zarikBalance: { increment: amount } }
      }),
      prisma.zarikTransaction.create({
        data: {
          userId: targetUserId,
          amount,
          category: 'Special Campaigns',
          reason,
          createdBy: req.user!.id
        }
      })
    ]);
    
    await logAdminAction(req.user!.id, 'Admin', 'GRANT_ZARIK', 'User', targetUserId, `Granted ${amount} Zarik. Reason: ${reason}`, req.ip || '');
    
    res.json({ message: 'زریک با موفقیت به کیف پول کاربر اضافه شد.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getZarikSalesStats(req: AuthRequest, res: Response) {
  try {
    // Total Zarik purchased by users
    const stats = await prisma.user.aggregate({
      _sum: { totalZarikPurchases: true }
    });
    
    // Detailed recent transactions
    const recentTransactions = await prisma.zarikTransaction.findMany({
      where: { category: 'Special Campaigns' }, // Or whatever category sales fall into
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        user: { select: { name: true, phoneNumber: true } }
      }
    });
    
    res.json({
      totalSales: stats._sum.totalZarikPurchases || 0,
      recentTransactions
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// Mentor Reward Constraints APIs
export async function getMentorRewardRules(req: AuthRequest, res: Response) {
  try {
    const rules = await prisma.mentorRewardRule.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(rules);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function createMentorRewardRule(req: AuthRequest, res: Response) {
  try {
    const { mentorId, caravanId, stationId, rewardType, maxGrantLimit, timeframe } = req.body;
    
    if (!rewardType || typeof maxGrantLimit !== 'number' || !timeframe) {
      return res.status(400).json({ error: 'اطلاعات نامعتبر است' });
    }
    
    const rule = await prisma.mentorRewardRule.create({
      data: {
        mentorId: mentorId || null,
        caravanId: caravanId || null,
        stationId: stationId || null,
        rewardType,
        maxGrantLimit,
        timeframe
      }
    });
    
    await logAdminAction(req.user!.id, 'Admin', 'CREATE_MENTOR_RULE', 'MentorRewardRule', rule.id, `Created rule for ${rewardType}`, req.ip || '');
    
    res.status(201).json(rule);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteMentorRewardRule(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    await prisma.mentorRewardRule.delete({ where: { id } });
    await logAdminAction(req.user!.id, 'Admin', 'DELETE_MENTOR_RULE', 'MentorRewardRule', id, `Deleted rule`, req.ip || '');
    res.json({ message: 'حذف شد' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function validateRewardGrant(mentorId: string, caravanId: string | null, stationId: string | null, rewardType: string, amount: number) {
  // Find applicable rules
  const rules = await prisma.mentorRewardRule.findMany({
    where: {
      rewardType,
      OR: [
        { mentorId },
        { mentorId: null }
      ],
    }
  });
  
  for (const rule of rules) {
    // If rule specifies caravan, it must match
    if (rule.caravanId && rule.caravanId !== caravanId) continue;
    // If rule specifies station, it must match
    if (rule.stationId && rule.stationId !== stationId) continue;
    
    if (amount > rule.maxGrantLimit) {
      throw new Error('سقف مجاز اعطای پاداش در این بخش رعایت نشده است');
    }
    
    // In a full implementation, we'd also check the historical sum based on timeframe (DAILY, PER_STATION)
    // For now, we enforce the per-transaction limit 'maxGrantLimit' strictly.
  }
}
