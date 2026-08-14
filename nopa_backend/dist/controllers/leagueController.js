"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCaravanLeague = getCaravanLeague;
exports.getWealthiestLeague = getWealthiestLeague;
exports.getMentorLeague = getMentorLeague;
const db_1 = __importDefault(require("../config/db"));
async function getCaravanLeague(req, res) {
    try {
        const caravans = await db_1.default.caravan.findMany({
            orderBy: { overallProgress: 'desc' },
            include: {
                mentor: {
                    select: { name: true }
                }
            }
        });
        res.json(caravans);
    }
    catch (error) {
        console.error('getCaravanLeague error:', error);
        res.status(500).json({ error: 'خطایی در دریافت جدول لیگ کاروان‌ها رخ داد' });
    }
}
async function getWealthiestLeague(req, res) {
    try {
        const wealthiest = await db_1.default.user.findMany({
            where: { role: 'student' },
            orderBy: { zarikBalance: 'desc' },
            select: {
                id: true,
                name: true,
                zarikBalance: true,
                avatarUrl: true,
                levelFrame: true
            }
        });
        res.json(wealthiest);
    }
    catch (error) {
        console.error('getWealthiestLeague error:', error);
        res.status(500).json({ error: 'خطایی در دریافت جدول ثروتمندترین‌ها رخ داد' });
    }
}
async function getMentorLeague(req, res) {
    try {
        const mentors = await db_1.default.user.findMany({
            where: { role: 'mentor' },
            select: {
                id: true,
                name: true,
                avatarUrl: true
            }
        });
        // Compute average ratings manually
        const rankedMentors = await Promise.all(mentors.map(async (m) => {
            const ratings = await db_1.default.mentorRating.findMany({
                where: { mentorId: m.id }
            });
            const avg = ratings.length > 0
                ? ratings.reduce((sum, r) => sum + r.ratingValue, 0) / ratings.length
                : 4.5;
            return {
                ...m,
                rating: parseFloat(avg.toFixed(1)),
                reviewsCount: ratings.length
            };
        }));
        rankedMentors.sort((a, b) => b.rating - a.rating);
        res.json(rankedMentors);
    }
    catch (error) {
        console.error('getMentorLeague error:', error);
        res.status(500).json({ error: 'خطایی در دریافت جدول امتیازدهی راهبران رخ داد' });
    }
}
