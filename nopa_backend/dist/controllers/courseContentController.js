"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createClassSession = createClassSession;
exports.createSessionAssignment = createSessionAssignment;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const validAssignmentTypes = ['TEXT', 'QUIZ', 'FILE_UPLOAD'];
async function createClassSession(req, res) {
    try {
        const { classId, title, description, videoUrl, releaseDate, releaseTime, sessionOrder } = req.body;
        if (!classId || !title || !videoUrl) {
            return res.status(400).json({ error: 'classId, title و videoUrl الزامی هستند' });
        }
        const session = await prisma.classSession.create({
            data: {
                classId,
                title,
                description: description || null,
                videoUrl,
                releaseDate: releaseDate ? new Date(releaseDate) : null,
                releaseTime: releaseTime || null,
                sessionOrder: sessionOrder || 1,
            },
        });
        res.status(201).json({ success: true, data: session });
    }
    catch (error) {
        console.error('createClassSession error:', error);
        res.status(500).json({ error: 'خطا در ایجاد جلسه کلاس رخ داد' });
    }
}
async function createSessionAssignment(req, res) {
    try {
        const { sessionId, title, description, assignmentType, answerKey, rewardZarik, dueDate } = req.body;
        if (!sessionId || !title || !assignmentType) {
            return res.status(400).json({ error: 'sessionId، title و assignmentType الزامی هستند' });
        }
        const normalizedType = assignmentType.toString().toUpperCase();
        if (!validAssignmentTypes.includes(normalizedType)) {
            return res.status(400).json({ error: 'assignmentType نامعتبر است' });
        }
        const assignment = await prisma.sessionAssignment.create({
            data: {
                sessionId,
                title,
                description: description || null,
                assignmentType: normalizedType,
                answerKey: answerKey || null,
                rewardZarik: rewardZarik ?? 100,
                dueDate: dueDate ? new Date(dueDate) : null,
            },
        });
        res.status(201).json({ success: true, data: assignment });
    }
    catch (error) {
        console.error('createSessionAssignment error:', error);
        res.status(500).json({ error: 'خطا در ایجاد تکلیف جلسه رخ داد' });
    }
}
