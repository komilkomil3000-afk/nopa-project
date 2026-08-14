"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTicket = createTicket;
exports.getTickets = getTickets;
exports.replyTicket = replyTicket;
exports.resolveTicket = resolveTicket;
const db_1 = __importDefault(require("../config/db"));
async function createTicket(req, res) {
    try {
        const { category, subject } = req.body;
        if (!category || !subject)
            return res.status(400).json({ error: 'دسته‌بندی و موضوع الزامی است' });
        const ticket = await db_1.default.supportTicket.create({
            data: {
                studentId: req.user.id,
                category,
                subject
            }
        });
        res.json(ticket);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function getTickets(req, res) {
    try {
        const isMentor = req.user.role === 'mentor';
        let tickets;
        if (req.user.role === 'admin') {
            tickets = await db_1.default.supportTicket.findMany({
                include: { replies: true, student: { select: { name: true, avatarUrl: true } } },
                orderBy: { createdAt: 'desc' }
            });
        }
        else if (isMentor) {
            // Mentors see tickets from their caravan students
            const caravan = await db_1.default.caravan.findFirst({ where: { mentorId: req.user.id } });
            if (!caravan)
                return res.json([]);
            const members = await db_1.default.user.findMany({ where: { caravanId: caravan.id } });
            const memberIds = members.map(m => m.id);
            tickets = await db_1.default.supportTicket.findMany({
                where: { studentId: { in: memberIds } },
                include: { replies: true, student: { select: { name: true, avatarUrl: true } } },
                orderBy: { createdAt: 'desc' }
            });
        }
        else {
            tickets = await db_1.default.supportTicket.findMany({
                where: { studentId: req.user.id },
                include: { replies: true },
                orderBy: { createdAt: 'desc' }
            });
        }
        res.json(tickets);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function replyTicket(req, res) {
    try {
        const { id } = req.params;
        const { message } = req.body;
        const ticket = await db_1.default.supportTicket.findUnique({ where: { id } });
        if (!ticket)
            return res.status(404).json({ error: 'تیکت یافت نشد' });
        const reply = await db_1.default.supportTicketReply.create({
            data: {
                ticketId: id,
                message,
                mentorId: req.user.role === 'mentor' ? req.user.id : null
            }
        });
        res.json(reply);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function resolveTicket(req, res) {
    try {
        const { id } = req.params;
        const { rating } = req.body; // Student can provide rating when resolving
        await db_1.default.supportTicket.update({
            where: { id },
            data: { status: 'resolved', ratingGiven: rating }
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
