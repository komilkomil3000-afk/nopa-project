"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMentors = getMentors;
exports.createOrUpdateMentor = createOrUpdateMentor;
exports.grantFiveStars = grantFiveStars;
exports.getPendingDocuments = getPendingDocuments;
exports.approveDocument = approveDocument;
exports.rejectDocument = rejectDocument;
exports.getMentorHistory = getMentorHistory;
exports.assignCaravans = assignCaravans;
exports.completeProfile = completeProfile;
exports.evaluateMentor = evaluateMentor;
exports.savePrivateNote = savePrivateNote;
exports.getPrivateNotes = getPrivateNotes;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = __importDefault(require("../config/db"));
const notificationController_1 = require("./notificationController");
async function getMentors(req, res) {
    try {
        const mentors = await db_1.default.user.findMany({
            where: { role: { in: ['mentor', 'SUPER_MENTOR', 'admin'] } },
            include: {
                caravan: true,
                ratingsReceived: true,
                supportReplies: true,
                mentorDocuments: true,
                mentoredCaravans: true
            }
        });
        res.json(mentors);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function createOrUpdateMentor(req, res) {
    try {
        const { id, name, phoneNumber, nationalId, academicDegree, caravanId, certificates, isSuperMentor } = req.body;
        let user;
        if (id) {
            const data = {
                name,
                phoneNumber,
                nationalId,
                academicDegree,
                academicCertificates: certificates,
                caravanId: caravanId || null
            };
            if (typeof isSuperMentor === 'boolean') {
                data.role = isSuperMentor ? 'SUPER_MENTOR' : 'mentor';
            }
            user = await db_1.default.user.update({
                where: { id },
                data
            });
        }
        else {
            const maxUser = await db_1.default.user.findFirst({
                orderBy: { userCode: 'desc' },
                where: { userCode: { not: null } }
            });
            const nextUserCode = maxUser && maxUser.userCode ? maxUser.userCode + 1 : 110100;
            user = await db_1.default.user.create({
                data: {
                    name,
                    phoneNumber,
                    nationalId,
                    role: isSuperMentor ? 'SUPER_MENTOR' : 'mentor',
                    passwordHash: bcryptjs_1.default.hashSync('123456', 10),
                    academicDegree,
                    academicCertificates: certificates,
                    caravanId: caravanId || null,
                    userCode: nextUserCode
                }
            });
        }
        res.json({ success: true, user });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function grantFiveStars(req, res) {
    try {
        const { id } = req.params;
        // Admin granting 5 stars to mentor profile completion
        await db_1.default.mentorRating.create({
            data: {
                mentorId: id,
                studentId: req.user.id, // admin as rater
                ratingValue: 5,
                guidanceFeedback: 'تکمیل پروفایل راهبری - اعطای ۵ ستاره پیش‌فرض'
            }
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function getPendingDocuments(req, res) {
    try {
        const docs = await db_1.default.mentorDocument.findMany({
            where: { status: 'pending' },
            include: { user: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(docs);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function approveDocument(req, res) {
    try {
        const { id } = req.params;
        const doc = await db_1.default.mentorDocument.update({ where: { id }, data: { status: 'approved' } });
        // Mark user's identityVerified true when approving primary identity doc
        await db_1.default.user.update({ where: { id: doc.userId }, data: { identityVerified: true } });
        await (0, notificationController_1.sendSystemNotification)(doc.userId, 'تایید گواهینامه', `گواهینامه "${doc.filename}" شما تایید گردید.`, 'info');
        res.json({ success: true, doc });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function rejectDocument(req, res) {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const doc = await db_1.default.mentorDocument.update({ where: { id }, data: { status: 'rejected', rejectReason: reason || null } });
        await (0, notificationController_1.sendSystemNotification)(doc.userId, 'رد گواهینامه', `گواهینامه "${doc.filename}" شما رد شد. علت: ${reason || 'عدم رعایت قوانین'}`, 'alert');
        res.json({ success: true, doc });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function getMentorHistory(req, res) {
    try {
        const { id } = req.params;
        const challenges = await db_1.default.challenge.findMany({ where: { createdByMentorId: id } });
        const tickets = await db_1.default.supportTicket.findMany({ where: { studentId: id } });
        res.json({ challenges, tickets });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function assignCaravans(req, res) {
    try {
        const { id } = req.params; // mentor id
        const { caravanIds } = req.body;
        if (!caravanIds || !Array.isArray(caravanIds)) {
            return res.status(400).json({ error: 'caravanIds must be an array' });
        }
        await db_1.default.$transaction(async (tx) => {
            // Clear previous mentor assignment for these caravans if any
            for (const caravanId of caravanIds) {
                await tx.caravan.updateMany({ where: { id: caravanId }, data: { mentorId: id } });
            }
        });
        res.json({ success: true, assigned: caravanIds.length });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function completeProfile(req, res) {
    try {
        const { nationalId, dateOfBirth, city, academicDegree, bio, academicCertificates } = req.body;
        const userId = req.user.id;
        const dataToUpdate = {
            nationalId,
            dateOfBirth,
            city,
            academicDegree,
            bio,
            identityVerified: true,
            zarikBalance: { increment: 500 }
        };
        if (academicCertificates) {
            dataToUpdate.academicCertificates = academicCertificates;
        }
        await db_1.default.user.update({
            where: { id: userId },
            data: dataToUpdate
        });
        res.json({ success: true, message: 'اطلاعات پروفایل با موفقیت تکمیل شد و پاداش زریک دریافت کردید' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function evaluateMentor(req, res) {
    try {
        const { mentorId, stationId, rating, responsivenessScore, guidanceScore, feedbackText } = req.body;
        const studentId = req.user.id;
        if (!mentorId || !rating)
            return res.status(400).json({ error: '??????? ??????? ???? ???' });
        const evaluation = await db_1.default.mentorEvaluation.create({
            data: {
                studentId,
                mentorId,
                stationId,
                rating,
                responsivenessScore: responsivenessScore || rating,
                guidanceScore: guidanceScore || rating,
                feedbackText
            }
        });
        res.json(evaluation);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function savePrivateNote(req, res) {
    try {
        const { studentId, noteText } = req.body;
        const mentorId = req.user.id;
        if (!studentId || !noteText)
            return res.status(400).json({ error: '??? ??????? ? ????????? ?????? ???' });
        const note = await db_1.default.privateStudentNote.create({
            data: {
                mentorId,
                studentId,
                noteText
            }
        });
        res.json(note);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function getPrivateNotes(req, res) {
    try {
        const { studentId } = req.params;
        const notes = await db_1.default.privateStudentNote.findMany({
            where: {
                studentId,
                mentorId: req.user.role === 'admin' ? undefined : req.user.id
            },
            include: { mentor: { select: { name: true } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json(notes);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
