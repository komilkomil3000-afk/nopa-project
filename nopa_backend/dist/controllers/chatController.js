"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMessage = exports.getAllChatsAdmin = exports.sendMessage = exports.getCaravanMessages = exports.getDirectMessages = void 0;
const client_1 = require("@prisma/client");
const adminController_1 = require("./adminController");
const prisma = new client_1.PrismaClient();
// Get 1-on-1 direct messages
const getDirectMessages = async (req, res) => {
    try {
        const { mentorId } = req.params;
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const messages = await prisma.chatMessage.findMany({
            where: {
                OR: [
                    { senderId: userId, receiverId: mentorId },
                    { senderId: mentorId, receiverId: userId }
                ]
            },
            orderBy: { createdAt: 'asc' },
            include: {
                sender: { select: { id: true, name: true, avatarUrl: true, role: true } },
                receiver: { select: { id: true, name: true, avatarUrl: true, role: true } }
            }
        });
        res.json(messages);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getDirectMessages = getDirectMessages;
// Get caravan group messages
const getCaravanMessages = async (req, res) => {
    try {
        const { caravanId } = req.params;
        const messages = await prisma.chatMessage.findMany({
            where: { caravanId },
            orderBy: { createdAt: 'asc' },
            include: {
                sender: { select: { id: true, name: true, avatarUrl: true, role: true } }
            }
        });
        res.json(messages);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getCaravanMessages = getCaravanMessages;
// Send a message (Direct or Group)
const sendMessage = async (req, res) => {
    try {
        const senderId = req.user?.id;
        if (!senderId)
            return res.status(401).json({ error: 'Unauthorized' });
        const { receiverId, caravanId, messageText, fileUrl, fileType } = req.body;
        if (!messageText && !fileUrl) {
            return res.status(400).json({ error: 'Message text or file is required' });
        }
        const message = await prisma.chatMessage.create({
            data: {
                senderId,
                receiverId: receiverId || null,
                caravanId: caravanId || null,
                messageText: messageText || '',
                fileUrl: fileUrl || null,
                fileType: fileType || null
            },
            include: {
                sender: { select: { id: true, name: true, avatarUrl: true, role: true } }
            }
        });
        res.status(201).json({ message: 'پیام ارسال شد', data: message });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.sendMessage = sendMessage;
// --- ADMIN OVERSIGHT CONTROLLERS ---
// Get all chats (paginated) for Admin Oversight
const getAllChatsAdmin = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const caravanId = req.query.caravanId || '';
        const skip = (page - 1) * limit;
        const whereClause = {};
        if (caravanId) {
            whereClause.caravanId = caravanId;
        }
        const [messages, totalCount] = await prisma.$transaction([
            prisma.chatMessage.findMany({
                where: whereClause,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    sender: { select: { id: true, name: true, role: true } },
                    receiver: { select: { id: true, name: true, role: true } },
                    caravan: { select: { id: true, name: true } }
                }
            }),
            prisma.chatMessage.count({ where: whereClause })
        ]);
        res.json({
            messages,
            total: totalCount,
            page,
            pages: Math.ceil(totalCount / limit)
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getAllChatsAdmin = getAllChatsAdmin;
// Delete/moderate a message
const deleteMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const message = await prisma.chatMessage.delete({ where: { id } });
        await (0, adminController_1.logAdminAction)(req.user?.id || 'system', req.user?.phoneNumber || 'Admin', 'DELETE_CHAT_MESSAGE', 'ChatMessage', id, `حذف پیام (کاربر: ${message.senderId})`, req.ip || '127.0.0.1');
        res.json({ message: 'پیام با موفقیت حذف شد' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.deleteMessage = deleteMessage;
