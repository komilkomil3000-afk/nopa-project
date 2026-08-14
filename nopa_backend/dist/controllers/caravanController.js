"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleCaravanStatus = toggleCaravanStatus;
exports.bulkTransferMembers = bulkTransferMembers;
exports.convertAssets = convertAssets;
exports.approveAssetConversion = approveAssetConversion;
exports.getAssetConversionsAdmin = getAssetConversionsAdmin;
const client_1 = require("@prisma/client");
const adminController_1 = require("./adminController");
const prisma = new client_1.PrismaClient();
async function toggleCaravanStatus(req, res) {
    try {
        const { id } = req.params;
        const caravan = await prisma.caravan.findUnique({ where: { id } });
        if (!caravan)
            return res.status(404).json({ error: 'کاروان یافت نشد' });
        const newStatus = caravan.status === 'active' ? 'suspended' : 'active';
        await prisma.caravan.update({
            where: { id },
            data: { status: newStatus }
        });
        await (0, adminController_1.logAdminAction)(req.user.id, 'Admin', 'TOGGLE_CARAVAN_STATUS', 'Caravan', id, `Set status to ${newStatus}`, req.ip || '');
        res.json({ message: `وضعیت کاروان به ${newStatus} تغییر یافت.` });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function bulkTransferMembers(req, res) {
    try {
        const { userIds, targetCaravanId } = req.body;
        if (!Array.isArray(userIds) || !targetCaravanId) {
            return res.status(400).json({ error: 'لیست کاربران و شناسه کاروان مقصد الزامی است' });
        }
        const targetCaravan = await prisma.caravan.findUnique({ where: { id: targetCaravanId } });
        if (!targetCaravan)
            return res.status(404).json({ error: 'کاروان مقصد یافت نشد' });
        await prisma.user.updateMany({
            where: { id: { in: userIds } },
            data: { caravanId: targetCaravanId }
        });
        // Update member counts (approximate, or recalculate)
        await (0, adminController_1.logAdminAction)(req.user.id, 'Admin', 'BULK_TRANSFER', 'Caravan', targetCaravanId, `Transferred ${userIds.length} users`, req.ip || '');
        res.json({ message: 'اعضا با موفقیت منتقل شدند.' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function convertAssets(req, res) {
    try {
        if (!req.user || req.user.role !== 'mentor') {
            return res.status(403).json({ error: 'تنها راهبران مجاز به ثبت درخواست تبدیل هستند' });
        }
        const mentor = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!mentor || !mentor.caravanId)
            return res.status(404).json({ error: 'کاربر یا کاروان یافت نشد' });
        if (mentor.nakh < 5) {
            return res.status(400).json({ error: 'موجودی نخ شما کافی نیست (حداقل 5 کلاف نخ نیاز است)' });
        }
        // Create a request in the queue
        await prisma.assetConversionRequest.create({
            data: {
                caravanId: mentor.caravanId,
                requestedBy: mentor.id,
                note: 'درخواست تبدیل ۵ کلاف نخ به ۱ فرش'
            }
        });
        res.json({ success: true, message: 'درخواست تبدیل با موفقیت ثبت شد و در انتظار تایید مدیریت است' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function approveAssetConversion(req, res) {
    try {
        const { id } = req.params;
        const { approve, note } = req.body; // approve: boolean
        const conversionReq = await prisma.assetConversionRequest.findUnique({ where: { id } });
        if (!conversionReq || conversionReq.status !== 'pending') {
            return res.status(404).json({ error: 'درخواست معتبر یافت نشد' });
        }
        if (approve) {
            // Check mentor balance again just in case
            const mentor = await prisma.user.findUnique({ where: { id: conversionReq.requestedBy } });
            if (!mentor || mentor.nakh < 5) {
                return res.status(400).json({ error: 'موجودی راهبر کافی نیست' });
            }
            await prisma.$transaction([
                prisma.user.update({
                    where: { id: mentor.id },
                    data: { nakh: { decrement: 5 }, farsh: { increment: 1 } }
                }),
                prisma.assetConversionRequest.update({
                    where: { id },
                    data: { status: 'approved', note: note || 'تایید شد' }
                })
            ]);
        }
        else {
            await prisma.assetConversionRequest.update({
                where: { id },
                data: { status: 'rejected', note: note || 'رد شد' }
            });
        }
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function getAssetConversionsAdmin(req, res) {
    try {
        const requests = await prisma.assetConversionRequest.findMany({
            include: {
                caravan: { select: { name: true } },
                user: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(requests);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
