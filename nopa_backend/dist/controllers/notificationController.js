"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNotifications = getNotifications;
exports.markNotificationAsRead = markNotificationAsRead;
exports.broadcastNotification = broadcastNotification;
exports.getTemplates = getTemplates;
exports.createTemplate = createTemplate;
exports.getOverrides = getOverrides;
exports.toggleOverride = toggleOverride;
exports.getLogs = getLogs;
const db_1 = __importDefault(require("../config/db"));
async function getNotifications(req, res) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'کاربر احراز هویت نشده است' });
        }
        const notifications = await db_1.default.notification.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' }
        });
        const unreadCount = notifications.filter(n => !n.isRead).length;
        res.json({
            unreadCount,
            notifications
        });
    }
    catch (error) {
        console.error('getNotifications error:', error);
        res.status(500).json({ error: 'خطایی در دریافت لیست اعلان‌ها رخ داد' });
    }
}
async function markNotificationAsRead(req, res) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'کاربر احراز هویت نشده است' });
        }
        const { id } = req.params;
        const notification = await db_1.default.notification.findUnique({
            where: { id }
        });
        if (!notification || notification.userId !== req.user.id) {
            return res.status(404).json({ error: 'اعلان مورد نظر یافت نشد' });
        }
        const updated = await db_1.default.notification.update({
            where: { id },
            data: { isRead: true }
        });
        res.json(updated);
    }
    catch (error) {
        console.error('markNotificationAsRead error:', error);
        res.status(500).json({ error: 'خطایی در به‌روزرسانی وضعیت اعلان رخ داد' });
    }
}
async function broadcastNotification(req, res) {
    try {
        const { targetAudience, channel, titleTpl, messageTpl, caravanId } = req.body;
        let users = [];
        if (targetAudience === 'all') {
            users = await db_1.default.user.findMany();
        }
        else if (targetAudience === 'mentors') {
            users = await db_1.default.user.findMany({ where: { role: 'mentor' } });
        }
        else if (targetAudience === 'caravan' && caravanId) {
            users = await db_1.default.user.findMany({ where: { caravanId } });
        }
        // Fetch Overrides
        const overrides = await db_1.default.channelOverride.findMany();
        const isChannelEnabled = (ch) => {
            const ov = overrides.find(o => o.channel === ch);
            return ov ? ov.isEnabled : true;
        };
        // Process templates and send
        let successCount = 0;
        for (const user of users) {
            const title = titleTpl.replace('{user_name}', user.name).replace('{zarik_balance}', user.zarikBalance.toString());
            const message = messageTpl.replace('{user_name}', user.name).replace('{zarik_balance}', user.zarikBalance.toString());
            if ((channel === 'in_app' || channel === 'all') && isChannelEnabled('in_app')) {
                await db_1.default.notification.create({
                    data: {
                        userId: user.id,
                        title,
                        message,
                        type: 'alert'
                    }
                });
            }
            if ((channel === 'sms' || channel === 'all') && isChannelEnabled('sms')) {
                // Mock SMS provider
                console.log(`[SMS MOCK] Sending SMS to ${user.phoneNumber}: ${message}`);
            }
            if ((channel === 'email' || channel === 'all') && isChannelEnabled('email')) {
                // Mock Email provider
                console.log(`[EMAIL MOCK] Sending Email to ${user.name}: ${title} - ${message}`);
            }
            successCount++;
        }
        // Log the broadcast
        await db_1.default.notificationLog.create({
            data: {
                channel,
                targetAudience: targetAudience + (caravanId ? `:${caravanId}` : ''),
                status: 'success',
            }
        });
        res.json({ message: `ارسال پیام با موفقیت به ${successCount} کاربر انجام شد.` });
    }
    catch (error) {
        await db_1.default.notificationLog.create({
            data: {
                channel: req.body.channel || 'unknown',
                targetAudience: req.body.targetAudience || 'unknown',
                status: 'failed',
                error: error.message
            }
        });
        res.status(500).json({ error: error.message });
    }
}
// ---- TEMPLATES ----
async function getTemplates(req, res) {
    try {
        const templates = await db_1.default.notificationTemplate.findMany();
        res.json(templates);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
}
async function createTemplate(req, res) {
    try {
        const { name, titleTpl, messageTpl, channel } = req.body;
        const template = await db_1.default.notificationTemplate.create({
            data: { name, titleTpl, messageTpl, channel }
        });
        res.json(template);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create template' });
    }
}
// ---- OVERRIDES & LOGS ----
async function getOverrides(req, res) {
    try {
        const overrides = await db_1.default.channelOverride.findMany();
        res.json(overrides);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch overrides' });
    }
}
async function toggleOverride(req, res) {
    try {
        const { channel, isEnabled } = req.body;
        const override = await db_1.default.channelOverride.upsert({
            where: { channel },
            update: { isEnabled },
            create: { channel, isEnabled }
        });
        res.json(override);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to toggle override' });
    }
}
async function getLogs(req, res) {
    try {
        const logs = await db_1.default.notificationLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        res.json(logs);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
}
