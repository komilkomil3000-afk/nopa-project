"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMentors = getMentors;
exports.createOrUpdateMentor = createOrUpdateMentor;
exports.grantFiveStars = grantFiveStars;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function getMentors(req, res) {
    try {
        const mentors = await prisma.user.findMany({
            where: { role: 'mentor' },
            include: {
                caravan: true,
                ratingsReceived: true,
                supportReplies: true
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
        const { id, name, phoneNumber, nationalId, academicDegree, caravanId, certificates } = req.body;
        let user;
        if (id) {
            user = await prisma.user.update({
                where: { id },
                data: {
                    name,
                    phoneNumber,
                    nationalId,
                    academicDegree,
                    academicCertificates: certificates,
                    caravanId: caravanId || null
                }
            });
        }
        else {
            user = await prisma.user.create({
                data: {
                    name,
                    phoneNumber,
                    nationalId,
                    role: 'mentor',
                    passwordHash: bcrypt.hashSync('123456', 10),
                    academicDegree,
                    academicCertificates: certificates,
                    caravanId: caravanId || null
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
        await prisma.mentorRating.create({
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
