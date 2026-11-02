import { Response } from 'express';
import prisma from '../config/db';
import { changeBalance } from '../services/ledger';
import { AuthRequest } from '../middleware/auth';
import { logAdminAction } from './adminController';


export async function grantPromotionalZarik(req: AuthRequest, res: Response) {
  try {
    const { targetUserId, amount, reason } = req.body;
    
    if (!targetUserId || !amount || !reason) {
      return res.status(400).json({ error: 'کاربر هدف، مقدار و دلیل الزامی است' });
    }
    
    const user = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) return res.status(404).json({ error: 'کاربر یافت نشد' });
    
    await prisma.$transaction(tx => changeBalance(tx, {
      userId: targetUserId,
      asset: 'zarik',
      amount,
      sourceType: 'promotional_grant',
      reason,
      createdBy: req.user!.id,
      zarikCategory: 'Special Campaigns'
    }));
    
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

/** What a mentor already paid inside a rule's window. */
async function grantedSoFar(mentorId: string, timeframe: string, stationId: string | null): Promise<number> {
  const where: any = { createdBy: mentorId, sourceType: 'submission_review', amount: { gt: 0 } };
  if (timeframe === 'DAILY') where.createdAt = { gte: new Date(new Date().setHours(0, 0, 0, 0)) };
  if (timeframe === 'PER_STATION' && stationId) {
    const subs = await prisma.submission.findMany({ where: { challenge: { stationId } }, select: { id: true } });
    where.sourceId = { in: subs.map(s => s.id) };
  }
  const sum = await prisma.assetTransaction.aggregate({ where, _sum: { amount: true } });
  return sum._sum.amount || 0;
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
    
    const granted = await grantedSoFar(mentorId, rule.timeframe, rule.stationId || stationId);
    if (granted + amount > rule.maxGrantLimit) {
      throw new Error('سقف مجاز اعطای پاداش در این بخش رعایت نشده است');
    }
  }
}
