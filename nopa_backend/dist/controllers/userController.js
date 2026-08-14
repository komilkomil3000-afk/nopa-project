"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = getMe;
exports.completeProfile = completeProfile;
exports.getMentorById = getMentorById;
const db_1 = __importDefault(require("../config/db"));
async function getMe(req, res) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'کاربر احراز هویت نشده است' });
        }
        const user = await db_1.default.user.findUnique({
            where: { id: req.user.id }
        });
        if (!user) {
            return res.status(404).json({ error: 'کاربر یافت نشد' });
        }
        res.json({
            id: user.id,
            name: user.name,
            phoneNumber: user.phoneNumber,
            role: user.role,
            zarikBalance: user.zarikBalance,
            levelFrame: user.levelFrame,
            caravanId: user.caravanId,
            avatarUrl: user.avatarUrl,
            hasEvaluatedMentorThisSeason: user.hasEvaluatedMentorThisSeason,
            identityVerified: user.identityVerified
        });
    }
    catch (error) {
        console.error('getMe error:', error);
        res.status(500).json({ error: 'خطایی در دریافت اطلاعات کاربر رخ داد' });
    }
}
async function completeProfile(req, res) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'کاربر احراز هویت نشده است' });
        }
        const user = await db_1.default.user.findUnique({ where: { id: req.user.id } });
        if (!user)
            return res.status(404).json({ error: 'کاربر یافت نشد' });
        if (user.identityVerified) {
            return res.status(400).json({ error: 'پروفایل شما قبلا تکمیل شده است' });
        }
        if (user.role === 'student') {
            const { nationalId, name, city, dateOfBirth } = req.body;
            if (!nationalId || !name)
                return res.status(400).json({ error: 'نام و کد ملی الزامی است' });
            await db_1.default.user.update({
                where: { id: user.id },
                data: {
                    name,
                    nationalId,
                    dateOfBirth,
                    identityVerified: true,
                    zarikBalance: { increment: 200 }
                }
            });
            return res.json({ success: true, message: 'پروفایل تایید شد و 200 زریک پاداش گرفتید' });
        }
        else if (user.role === 'mentor') {
            const { academicDegree, academicCertificates } = req.body;
            await db_1.default.user.update({
                where: { id: user.id },
                data: {
                    academicDegree,
                    academicCertificates,
                    identityVerified: true,
                    mentorLevel: { increment: 1 } // Simulated +5 Stars / level up
                }
            });
            return res.json({ success: true, message: 'پروفایل راهبر تایید شد و 5 ستاره دریافت کردید' });
        }
        res.status(400).json({ error: 'نقش کاربری نامعتبر' });
    }
    catch (error) {
        console.error('completeProfile error:', error);
        res.status(500).json({ error: 'خطا در تکمیل پروفایل' });
    }
}
async function getMentorById(req, res) {
    try {
        const { id } = req.params;
        const mentor = await db_1.default.user.findFirst({
            where: { id, role: 'mentor' }
        });
        if (!mentor) {
            return res.status(404).json({ error: 'راهبر مورد نظر یافت نشد' });
        }
        // Aggregate rating statistics
        const ratings = await db_1.default.mentorRating.findMany({
            where: { mentorId: id }
        });
        const totalRatings = ratings.length;
        const avgRating = totalRatings > 0
            ? ratings.reduce((sum, r) => sum + r.ratingValue, 0) / totalRatings
            : 4.8; // Default initial mock value
        const caravansCount = await db_1.default.caravan.count({
            where: { mentorId: id }
        });
        const membersCount = await db_1.default.user.count({
            where: { caravan: { mentorId: id } }
        });
        res.json({
            id: mentor.id,
            name: mentor.name,
            avatarUrl: mentor.avatarUrl || 'http://127.0.0.1:5000/uploads/avatars/default.png',
            rating: parseFloat(avgRating.toFixed(1)),
            caravansCount,
            membersCount,
            bio: 'راهبر ارشد سرزمین نپا، مربی تفکر خلاق و سواد رسانه‌ای نوجوانان.',
            certificates: [
                'گواهی عالی مربیگری تربیتی نپا',
                'گواهی تخصصی رسانه و تولید محتوا',
                'گواهی شایستگی مدیریت کاروان نپا'
            ]
        });
    }
    catch (error) {
        console.error('getMentorById error:', error);
        res.status(500).json({ error: 'خطایی در دریافت اطلاعات راهبر رخ داد' });
    }
}
