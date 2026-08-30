"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCaravansLeaderboardDetailed = getCaravansLeaderboardDetailed;
exports.getIndividualsLeaderboard = getIndividualsLeaderboard;
exports.getCaravanLeague = getCaravanLeague;
exports.getWealthiestLeague = getWealthiestLeague;
exports.getMentorLeague = getMentorLeague;
const db_1 = __importDefault(require("../config/db"));
async function getCaravansLeaderboardDetailed(req, res) {
    try {
        const sortBy = req.query.sortBy || 'totalScore';
        const search = (req.query.search || '').trim().toLowerCase();
        const exportAs = req.query.exportAs;
        const caravans = await db_1.default.caravan.findMany({
            where: { isDeleted: false },
            include: {
                mentor: {
                    select: { id: true, name: true, phoneNumber: true }
                },
                members: {
                    where: { isDeleted: false },
                    select: {
                        id: true,
                        name: true,
                        phoneNumber: true,
                        zarikBalance: true,
                        nakh: true,
                        farsh: true,
                        beyragh: true,
                        quizSubmissions: {
                            select: { score: true, status: true }
                        },
                        submissions: {
                            select: { score: true, status: true }
                        },
                        sessionWatchRecords: {
                            select: { watchedPercentage: true }
                        }
                    }
                }
            }
        });
        const totalSessions = await db_1.default.classSession.count({ where: { isDeleted: false } });
        const totalQuizzes = await db_1.default.quiz.count();
        const totalAvailableCurriculumItems = totalSessions + totalQuizzes;
        const rankedCaravans = caravans.map(c => {
            const memberCount = c.members.length;
            let totalZarik = 0;
            let totalNakh = 0;
            let totalFarsh = 0;
            let totalBeyragh = 0;
            let totalQuizScore = 0;
            let totalPassedQuizzes = 0;
            let totalChallengeScore = 0;
            let totalApprovedChallenges = 0;
            let totalWatchedPercentages = 0;
            c.members.forEach(m => {
                totalZarik += m.zarikBalance || 0;
                totalNakh += m.nakh || 0;
                totalFarsh += m.farsh || 0;
                totalBeyragh += m.beyragh || 0;
                m.quizSubmissions.forEach(qs => {
                    totalQuizScore += qs.score || 0;
                    if (qs.score > 0 || qs.status?.toLowerCase() === 'approved' || qs.status?.toLowerCase() === 'passed') {
                        totalPassedQuizzes += 1;
                    }
                });
                m.submissions.forEach(sub => {
                    if (sub.status?.toLowerCase() === 'approved' || (sub.score && sub.score > 0)) {
                        totalChallengeScore += sub.score || 0;
                        totalApprovedChallenges += 1;
                    }
                });
                if (m.sessionWatchRecords.length > 0) {
                    const avgUserWatch = m.sessionWatchRecords.reduce((sum, w) => sum + (w.watchedPercentage || 0), 0) / (totalSessions || 1);
                    totalWatchedPercentages += Math.min(100, avgUserWatch);
                }
            });
            const avgProgress = memberCount > 0 ? parseFloat((totalWatchedPercentages / memberCount).toFixed(1)) : 0;
            const wealthScore = totalZarik + (totalNakh * 50) + (totalFarsh * 500) + (totalBeyragh * 200);
            const activityScore = (totalQuizScore * 5) + (totalPassedQuizzes * 20) + (totalChallengeScore * 10) + (totalApprovedChallenges * 15);
            const totalScore = wealthScore + activityScore + Math.round(avgProgress * 10);
            return {
                id: c.id,
                name: c.name,
                mentorId: c.mentor?.id || null,
                mentorName: c.mentor?.name || '-',
                mentorPhone: c.mentor?.phoneNumber || '-',
                memberCount,
                capacityLimit: c.capacityLimit || 25,
                overallProgress: avgProgress,
                totalWealth: wealthScore,
                totalScore,
                zarik: totalZarik,
                nakh: totalNakh,
                farsh: totalFarsh,
                beyragh: totalBeyragh,
                stars: totalPassedQuizzes,
                passedQuizzes: totalPassedQuizzes,
                quizScore: totalQuizScore,
                challengesPassed: totalApprovedChallenges,
                challengeScore: totalChallengeScore,
                membersList: c.members.map(m => ({ id: m.id, name: m.name, zarik: m.zarikBalance }))
            };
        });
        let filtered = rankedCaravans;
        if (search) {
            filtered = filtered.filter(c => c.name.toLowerCase().includes(search) ||
                c.mentorName.toLowerCase().includes(search) ||
                c.mentorPhone.includes(search));
        }
        // Sort
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'zarik': return b.zarik - a.zarik;
                case 'beyragh': return b.beyragh - a.beyragh;
                case 'nakh': return b.nakh - a.nakh;
                case 'farsh': return b.farsh - a.farsh;
                case 'stars':
                case 'quizzes': return b.stars - a.stars;
                case 'quizScore': return b.quizScore - a.quizScore;
                case 'challenges':
                case 'challengeScore': return b.challengeScore - a.challengeScore;
                case 'progress': return b.overallProgress - a.overallProgress;
                case 'members': return b.memberCount - a.memberCount;
                case 'wealth': return b.totalWealth - a.totalWealth;
                case 'totalScore':
                default: return b.totalScore - a.totalScore;
            }
        });
        if (exportAs === 'csv') {
            let csv = 'رتبه,نام کاروان,راهبر,تعداد اعضا,زریک,نخ,فرش,بیرق,ستاره و آزمون,نمره آزمون,نمره چالش,درصد پیشرفت,امتیاز کل\n';
            filtered.forEach((c, idx) => {
                csv += `${idx + 1},${c.name},${c.mentorName},${c.memberCount},${c.zarik},${c.nakh},${c.farsh},${c.beyragh},${c.stars},${c.quizScore},${c.challengeScore},${c.overallProgress}%,${c.totalScore}\n`;
            });
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="caravans_leaderboard.csv"');
            return res.send(Buffer.from('\uFEFF' + csv, 'utf-8'));
        }
        res.json(filtered);
    }
    catch (error) {
        console.error('getCaravansLeaderboardDetailed error:', error);
        res.status(500).json({ error: error.message || 'خطایی در دریافت جدول رتبه‌بندی کاروان‌ها رخ داد' });
    }
}
async function getIndividualsLeaderboard(req, res) {
    try {
        const role = req.query.role || 'all'; // 'all' | 'student' | 'mentor'
        const caravanId = req.query.caravanId;
        const stationId = req.query.stationId;
        const sortBy = req.query.sortBy || 'totalScore';
        const search = (req.query.search || '').trim().toLowerCase();
        const exportAs = req.query.exportAs;
        const limit = parseInt(req.query.limit) || 300;
        const whereClause = { isDeleted: false };
        if (role === 'student' || role === 'mentor') {
            whereClause.role = role;
        }
        if (caravanId && caravanId !== 'all') {
            whereClause.caravanId = caravanId;
        }
        const totalSessions = await db_1.default.classSession.count({ where: { isDeleted: false } });
        const users = await db_1.default.user.findMany({
            where: whereClause,
            select: {
                id: true,
                name: true,
                phoneNumber: true,
                role: true,
                avatarUrl: true,
                zarikBalance: true,
                nakh: true,
                farsh: true,
                beyragh: true,
                levelFrame: true,
                mentorLevel: true,
                caravanId: true,
                caravan: {
                    select: { id: true, name: true }
                },
                quizSubmissions: {
                    select: { score: true, status: true, quizId: true }
                },
                submissions: {
                    select: { score: true, status: true, challengeId: true }
                },
                sessionWatchRecords: {
                    select: { watchedPercentage: true, sessionId: true }
                }
            }
        });
        const enrichedUsers = users.map(u => {
            const zarik = u.zarikBalance || 0;
            const nakh = u.nakh || 0;
            const farsh = u.farsh || 0;
            const beyragh = u.beyragh || 0;
            let quizScore = 0;
            let passedQuizzes = 0;
            u.quizSubmissions.forEach(qs => {
                quizScore += qs.score || 0;
                if (qs.score > 0 || qs.status?.toLowerCase() === 'approved' || qs.status?.toLowerCase() === 'passed') {
                    passedQuizzes += 1;
                }
            });
            let challengeScore = 0;
            let approvedChallenges = 0;
            u.submissions.forEach(sub => {
                if (sub.status?.toLowerCase() === 'approved' || (sub.score && sub.score > 0)) {
                    challengeScore += sub.score || 0;
                    approvedChallenges += 1;
                }
            });
            let progressPercentage = 0;
            if (u.sessionWatchRecords.length > 0) {
                const totalWatch = u.sessionWatchRecords.reduce((sum, w) => sum + (w.watchedPercentage || 0), 0);
                progressPercentage = Math.min(100, parseFloat((totalWatch / (totalSessions || 1)).toFixed(1)));
            }
            const wealthScore = zarik + (nakh * 50) + (farsh * 500) + (beyragh * 200);
            const activityScore = (quizScore * 5) + (passedQuizzes * 20) + (challengeScore * 10) + (approvedChallenges * 15);
            const totalScore = wealthScore + activityScore + Math.round(progressPercentage * 10);
            return {
                id: u.id,
                name: u.name,
                phoneNumber: u.phoneNumber,
                role: u.role,
                avatarUrl: u.avatarUrl,
                caravanId: u.caravanId,
                caravanName: u.caravan?.name || 'بدون کاروان',
                levelFrame: u.levelFrame || 1,
                mentorLevel: u.mentorLevel || 1,
                zarik,
                nakh,
                farsh,
                beyragh,
                stars: passedQuizzes,
                passedQuizzes,
                quizScore,
                approvedChallenges,
                challengeScore,
                progressPercentage,
                wealthScore,
                totalScore
            };
        });
        let filtered = enrichedUsers;
        if (search) {
            filtered = filtered.filter(u => u.name.toLowerCase().includes(search) ||
                u.phoneNumber.includes(search) ||
                u.caravanName.toLowerCase().includes(search));
        }
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'zarik': return b.zarik - a.zarik;
                case 'beyragh': return b.beyragh - a.beyragh;
                case 'nakh': return b.nakh - a.nakh;
                case 'farsh': return b.farsh - a.farsh;
                case 'stars':
                case 'quizzes': return b.stars - a.stars;
                case 'quizScore': return b.quizScore - a.quizScore;
                case 'challenges':
                case 'challengeScore': return b.challengeScore - a.challengeScore;
                case 'progress': return b.progressPercentage - a.progressPercentage;
                case 'wealth': return b.wealthScore - a.wealthScore;
                case 'totalScore':
                default: return b.totalScore - a.totalScore;
            }
        });
        if (exportAs === 'csv') {
            let csv = 'رتبه,نام,نقش,شماره تماس,کاروان,زریک,نخ,فرش,بیرق,ستاره و آزمون,نمره آزمون,نمره چالش,درصد پیشرفت,امتیاز کل\n';
            filtered.forEach((u, idx) => {
                csv += `${idx + 1},${u.name},${u.role === 'mentor' ? 'راهبر' : 'دانش‌آموز'},${u.phoneNumber},${u.caravanName},${u.zarik},${u.nakh},${u.farsh},${u.beyragh},${u.stars},${u.quizScore},${u.challengeScore},${u.progressPercentage}%,${u.totalScore}\n`;
            });
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="individuals_leaderboard.csv"');
            return res.send(Buffer.from('\uFEFF' + csv, 'utf-8'));
        }
        res.json(filtered.slice(0, limit));
    }
    catch (error) {
        console.error('getIndividualsLeaderboard error:', error);
        res.status(500).json({ error: error.message || 'خطایی در دریافت جدول رتبه‌بندی افراد رخ داد' });
    }
}
async function getCaravanLeague(req, res) {
    try {
        const sortBy = req.query.sortBy || 'progress';
        const exportAs = req.query.exportAs;
        const caravans = await db_1.default.caravan.findMany({
            include: {
                mentor: {
                    select: { name: true }
                },
                members: {
                    select: { id: true, zarikBalance: true, nakh: true, farsh: true, beyragh: true }
                }
            }
        });
        const totalSessions = await db_1.default.classSession.count({ where: { isDeleted: false } });
        const totalQuizzes = await db_1.default.quiz.count();
        const totalAvailableCurriculumItems = totalSessions + totalQuizzes;
        const rankedCaravans = await Promise.all(caravans.map(async (c) => {
            const totalWealth = c.members.reduce((sum, m) => sum + m.zarikBalance + m.nakh * 100 + m.farsh * 1000 + m.beyragh * 500, 0);
            const totalZarik = c.members.reduce((sum, m) => sum + m.zarikBalance, 0);
            const totalNakh = c.members.reduce((sum, m) => sum + m.nakh, 0);
            const totalFarsh = c.members.reduce((sum, m) => sum + m.farsh, 0);
            const totalBeyragh = c.members.reduce((sum, m) => sum + m.beyragh, 0);
            let caravanProgress = 0;
            const totalMembers = c.members.length;
            if (totalMembers > 0 && totalAvailableCurriculumItems > 0) {
                let passedQuizzesCount = 0;
                let watchedSessionsCount = 0;
                for (const member of c.members) {
                    const passedQuizzes = await db_1.default.quizSubmission.count({
                        where: {
                            studentId: member.id,
                            OR: [{ score: { gt: 0 } }, { status: 'approved' }]
                        }
                    });
                    const watchedSessions = await db_1.default.sessionWatchRecord.count({
                        where: {
                            userId: member.id,
                            watchedPercentage: { gte: 70.0 }
                        }
                    });
                    passedQuizzesCount += passedQuizzes;
                    watchedSessionsCount += watchedSessions;
                }
                const calcProgress = ((passedQuizzesCount + watchedSessionsCount) / (totalAvailableCurriculumItems * totalMembers)) * 100;
                caravanProgress = Math.min(100, parseFloat(calcProgress.toFixed(2)));
            }
            return {
                id: c.id,
                name: c.name,
                mentorName: c.mentor?.name || '-',
                memberCount: c.members.length,
                capacityLimit: c.capacityLimit,
                overallProgress: caravanProgress,
                totalWealth,
                assets: { zarik: totalZarik, nakh: totalNakh, farsh: totalFarsh, beyragh: totalBeyragh }
            };
        }));
        if (sortBy === 'wealth') {
            rankedCaravans.sort((a, b) => b.totalWealth - a.totalWealth);
        }
        else {
            rankedCaravans.sort((a, b) => b.overallProgress - a.overallProgress);
        }
        if (exportAs === 'csv') {
            let csv = 'Name,Mentor,Members,Progress,Total Zarik,Total Nakh,Total Farsh,Total Beyragh\n';
            rankedCaravans.forEach(c => {
                csv += `${c.name},${c.mentorName},${c.memberCount},${c.overallProgress},${c.assets.zarik},${c.assets.nakh},${c.assets.farsh},${c.assets.beyragh}\n`;
            });
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="caravan_league.csv"');
            return res.send(Buffer.from('\uFEFF' + csv, 'utf-8'));
        }
        res.json(rankedCaravans);
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
        const search = req.query.search || '';
        const sortBy = req.query.sortBy || 'rating';
        const exportAs = req.query.exportAs;
        const whereClause = { role: 'mentor' };
        if (search) {
            whereClause.OR = [
                { name: { contains: search } },
                { phoneNumber: { contains: search } }
            ];
        }
        const mentors = await db_1.default.user.findMany({
            where: whereClause,
            select: {
                id: true,
                name: true,
                phoneNumber: true,
                avatarUrl: true,
                mentorLevel: true,
                mentoredCaravans: { select: { id: true, name: true, overallProgress: true } },
                submissions: { select: { id: true, status: true } },
                supportReplies: { select: { id: true, createdAt: true } },
                evaluationsReceived: true,
            }
        });
        const rankedMentors = mentors.map(m => {
            const evals = m.evaluationsReceived || [];
            const avg = evals.length > 0
                ? evals.reduce((sum, e) => sum + e.rating, 0) / evals.length
                : 0; // Return 0 instead of mock 4.5
            const caravanNames = m.mentoredCaravans.length > 0
                ? m.mentoredCaravans.map(c => c.name).join(', ')
                : '-';
            const caravanProgress = m.mentoredCaravans.length > 0
                ? m.mentoredCaravans.reduce((sum, c) => sum + c.overallProgress, 0) / m.mentoredCaravans.length
                : 0;
            const activityScore = m.submissions.length * 2 + m.supportReplies.length * 5;
            return {
                id: m.id,
                name: m.name,
                phoneNumber: m.phoneNumber,
                avatarUrl: m.avatarUrl,
                caravanName: caravanNames,
                mentorLevel: m.mentorLevel,
                rating: avg > 0 ? parseFloat(avg.toFixed(1)) : '-',
                reviewsCount: evals.length,
                caravanProgress: parseFloat(caravanProgress.toFixed(1)),
                activityScore
            };
        });
        if (sortBy === 'rating') {
            rankedMentors.sort((a, b) => (typeof b.rating === 'number' ? b.rating : 0) - (typeof a.rating === 'number' ? a.rating : 0));
        }
        else if (sortBy === 'progress') {
            rankedMentors.sort((a, b) => b.caravanProgress - a.caravanProgress);
        }
        else if (sortBy === 'activity') {
            rankedMentors.sort((a, b) => b.activityScore - a.activityScore);
        }
        else if (sortBy === 'level') {
            rankedMentors.sort((a, b) => b.mentorLevel - a.mentorLevel);
        }
        if (exportAs === 'csv') {
            let csv = 'Name,Phone,Caravan,Level,Rating,Progress,Activity\n';
            rankedMentors.forEach(m => {
                csv += `${m.name},${m.phoneNumber},${m.caravanName},${m.mentorLevel},${m.rating},${m.caravanProgress},${m.activityScore}\n`;
            });
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="mentors_league.csv"');
            return res.send(Buffer.from('\uFEFF' + csv, 'utf-8'));
        }
        res.json(rankedMentors);
    }
    catch (error) {
        console.error('getMentorLeague error:', error);
        res.status(500).json({ error: 'خطایی در دریافت جدول امتیازدهی راهبران رخ داد' });
    }
}
