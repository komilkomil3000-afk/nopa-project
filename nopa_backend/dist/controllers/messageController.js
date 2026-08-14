"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replyToMessage = exports.getAdminMessages = exports.sendMessage = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// User sends a message (escalation)
const sendMessage = async (req, res) => {
    try {
        const { userId, category, message, priority } = req.body;
        if (!userId || !category || !message) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const adminMessage = await prisma.adminMessage.create({
            data: {
                userId,
                category,
                message,
                priority: priority || 'Normal'
            }
        });
        res.status(201).json({ message: 'پیام شما با موفقیت به مدیر سیستم ارسال شد', data: adminMessage });
    }
    catch (error) {
        console.error('sendMessage Error:', error);
        res.status(500).json({ error: 'خطای سرور در ارسال پیام' });
    }
};
exports.sendMessage = sendMessage;
// Admin gets all messages
const getAdminMessages = async (req, res) => {
    try {
        const messages = await prisma.adminMessage.findMany({
            include: {
                user: {
                    select: { name: true, phoneNumber: true, role: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(messages);
    }
    catch (error) {
        console.error('getAdminMessages Error:', error);
        res.status(500).json({ error: 'خطای سرور' });
    }
};
exports.getAdminMessages = getAdminMessages;
// Admin replies to a message
const replyToMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { replyText, status } = req.body;
        const updated = await prisma.adminMessage.update({
            where: { id },
            data: {
                adminReply: replyText,
                status: status || 'Resolved'
            }
        });
        res.json({ message: 'پاسخ شما ثبت شد', data: updated });
    }
    catch (error) {
        console.error('replyToMessage Error:', error);
        res.status(500).json({ error: 'خطای سرور' });
    }
};
exports.replyToMessage = replyToMessage;
