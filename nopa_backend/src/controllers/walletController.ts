import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { logAdminAction } from './adminController';

const prisma = new PrismaClient();

export async function getEconomyHubAnalytics(req: AuthRequest, res: Response) {
  try {
    const { userId, caravanId } = req.query;

    const filters: any = {};
    if (userId) filters.userId = String(userId);
    if (caravanId) {
      // Find all users in caravan
      const caravanUsers = await prisma.user.findMany({ where: { caravanId: String(caravanId) }, select: { id: true } });
      const userIds = caravanUsers.map(u => u.id);
      if (filters.userId) {
         if (!userIds.includes(filters.userId)) {
             filters.userId = "none"; // impossible condition
         }
      } else {
         filters.userId = { in: userIds };
      }
    }

    // Transactions
    const transactions = await prisma.zarikTransaction.findMany({
      where: filters,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { name: true, phoneNumber: true, caravanId: true } }
      }
    });

    // Conversion queue
    let conversionFilters: any = {};
    if (userId) conversionFilters.requestedBy = String(userId);
    if (caravanId) conversionFilters.caravanId = String(caravanId);
    
    const conversions = await prisma.assetConversionRequest.findMany({
      where: conversionFilters,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: { select: { name: true, phoneNumber: true } },
        caravan: { select: { name: true } }
      }
    });

    res.json({
      transactions,
      conversions
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
