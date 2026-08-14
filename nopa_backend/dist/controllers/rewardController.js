"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.grantPromotionalZarik = grantPromotionalZarik;
exports.getZarikSalesStats = getZarikSalesStats;
const client_1 = require("@prisma/client");
const adminController_1 = require("./adminController");
const prisma = new client_1.PrismaClient();
async function grantPromotionalZarik(req, res) {
    try {
        const { targetUserId, amount, reason } = req.body;
        if (!targetUserId || !amount || !reason) {
            return res.status(400).json({ error: 'کاربر هدف، مقدار و دلیل الزامی است' });
        }
        const user = await prisma.user.findUnique({ where: { id: targetUserId } });
        if (!user)
            return res.status(404).json({ error: 'کاربر یافت نشد' });
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
                    createdBy: req.user.id
                }
            })
        ]);
        await (0, adminController_1.logAdminAction)(req.user.id, 'Admin', 'GRANT_ZARIK', 'User', targetUserId, `Granted ${amount} Zarik. Reason: ${reason}`, req.ip || '');
        res.json({ message: 'زریک با موفقیت به کیف پول کاربر اضافه شد.' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function getZarikSalesStats(req, res) {
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
