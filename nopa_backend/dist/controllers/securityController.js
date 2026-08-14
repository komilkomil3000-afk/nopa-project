"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revokeAllSessions = revokeAllSessions;
exports.addBlacklist = addBlacklist;
exports.removeBlacklist = removeBlacklist;
exports.getBlacklist = getBlacklist;
const client_1 = require("@prisma/client");
const adminController_1 = require("./adminController");
const prisma = new client_1.PrismaClient();
async function revokeAllSessions(req, res) {
    try {
        const { targetUserId } = req.body;
        if (targetUserId) {
            // Revoke for specific user
            const user = await prisma.user.findUnique({ where: { id: targetUserId } });
            if (!user)
                return res.status(404).json({ error: 'کاربر یافت نشد' });
            await prisma.user.update({
                where: { id: targetUserId },
                data: { tokenVersion: user.tokenVersion + 1 }
            });
            await (0, adminController_1.logAdminAction)(req.user.id, 'Admin', 'REVOKE_SESSIONS', 'User', targetUserId, `Revoked tokens for ${user.phoneNumber}`, req.ip || '');
        }
        else {
            // Revoke for all users (Mass revoke)
            await prisma.user.updateMany({
                data: { tokenVersion: { increment: 1 } }
            });
            await (0, adminController_1.logAdminAction)(req.user.id, 'Admin', 'REVOKE_ALL_SESSIONS', 'System', 'ALL', `Revoked all user tokens`, req.ip || '');
        }
        res.json({ message: 'نشست‌ها با موفقیت باطل شدند.' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function addBlacklist(req, res) {
    try {
        const { type, value, reason } = req.body; // type = 'ip' or 'phone'
        if (!type || !value) {
            return res.status(400).json({ error: 'وارد کردن نوع و مقدار الزامی است' });
        }
        const existing = await prisma.blacklist.findUnique({ where: { value } });
        if (existing) {
            return res.status(400).json({ error: 'این مورد قبلا در لیست سیاه ثبت شده است' });
        }
        await prisma.blacklist.create({
            data: { type, value, reason }
        });
        await (0, adminController_1.logAdminAction)(req.user.id, 'Admin', 'ADD_BLACKLIST', 'Blacklist', value, `Blocked ${type}: ${value}`, req.ip || '');
        res.json({ message: 'با موفقیت به لیست سیاه اضافه شد.' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function removeBlacklist(req, res) {
    try {
        const { value } = req.body;
        await prisma.blacklist.delete({ where: { value } });
        res.json({ message: 'با موفقیت از لیست سیاه حذف شد.' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function getBlacklist(req, res) {
    try {
        const list = await prisma.blacklist.findMany({ orderBy: { createdAt: 'desc' } });
        res.json(list);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
