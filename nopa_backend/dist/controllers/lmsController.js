"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateQuestion = exports.createQuestion = exports.updatePart = exports.createPart = exports.updateSession = exports.createSession = exports.updateClass = exports.createClass = exports.updateStation = exports.createStation = exports.deleteQuiz = exports.deleteClip = exports.deleteSession = exports.deleteCategory = exports.markClipWatched = exports.getUserProgress = exports.deleteStation = exports.submitSessionQuiz = exports.getSessionWatchProgress = exports.heartbeatSessionWatch = exports.addBookmark = exports.getBookmarks = exports.seedStations = exports.createOrUpdateQuiz = exports.createOrUpdateClip = exports.createOrUpdateSession = exports.createOrUpdateCategory = exports.createOrUpdateStation = exports.getQuizzes = exports.getClips = exports.getSessions = exports.getClasses = exports.getStations = void 0;
const db_1 = __importDefault(require("../config/db"));
const certificateController_1 = require("./certificateController");
const getStations = async (req, res) => {
    try {
        const stations = await db_1.default.station.findMany({
            include: {
                categories: {
                    include: {
                        sessions: {
                            include: {
                                quizzes: true,
                                videoClips: {
                                    orderBy: { clipOrder: 'asc' }
                                }
                            },
                            orderBy: { orderIndex: 'asc' }
                        }
                    },
                    orderBy: { orderIndex: 'asc' }
                }
            },
            orderBy: { orderIndex: 'asc' }
        });
        const mapped = stations.map(st => {
            let instructors = null;
            let schedule = null;
            let category = null;
            let sessionsCount = null;
            if (st.subtitle) {
                try {
                    const parsed = JSON.parse(st.subtitle);
                    if (parsed && typeof parsed === 'object') {
                        instructors = parsed.instructors;
                        schedule = parsed.schedule;
                        category = parsed.category;
                        sessionsCount = parsed.sessionsCount;
                    }
                }
                catch (e) {
                    instructors = st.subtitle;
                }
            }
            return {
                ...st,
                instructors,
                schedule,
                category,
                sessionsCount
            };
        });
        res.json(mapped);
    }
    catch (error) {
        console.error('getStations error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
exports.getStations = getStations;
const getClasses = async (req, res) => {
    try {
        const classes = await db_1.default.classCategory.findMany({
            orderBy: { orderIndex: 'asc' }
        });
        res.json(classes);
    }
    catch (error) {
        console.error('getClasses error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
exports.getClasses = getClasses;
const getSessions = async (req, res) => {
    try {
        const sessions = await db_1.default.classSession.findMany({
            orderBy: { orderIndex: 'asc' }
        });
        res.json(sessions);
    }
    catch (error) {
        console.error('getSessions error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
exports.getSessions = getSessions;
const getClips = async (req, res) => {
    try {
        const clips = await db_1.default.videoClip.findMany({
            orderBy: { clipOrder: 'asc' }
        });
        res.json(clips);
    }
    catch (error) {
        console.error('getClips error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
exports.getClips = getClips;
const getQuizzes = async (req, res) => {
    try {
        const quizzes = await db_1.default.quiz.findMany({
            orderBy: { orderIndex: 'asc' }
        });
        res.json(quizzes);
    }
    catch (error) {
        console.error('getQuizzes error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
exports.getQuizzes = getQuizzes;
const createOrUpdateStation = async (req, res) => {
    try {
        const { id, title, subtitle, description, iconUrl, orderIndex, releaseDate, releaseTime, scoringCriteriaJson, categories, instructors, schedule, category, sessionsCount } = req.body;
        const subtitleVal = subtitle || (instructors || schedule || category || sessionsCount ? JSON.stringify({ instructors, schedule, category, sessionsCount }) : null);
        const result = await db_1.default.$transaction(async (tx) => {
            let station;
            const releaseDateVal = (releaseDate && String(releaseDate).trim() !== '') ? new Date(releaseDate) : null;
            const orderIndexVal = parseInt(orderIndex) || 0;
            if (id && !id.startsWith('new_')) {
                station = await tx.station.update({
                    where: { id },
                    data: { title: title || 'منزلگاه', subtitle: subtitleVal, description: description || '', iconUrl: iconUrl || '', orderIndex: orderIndexVal, releaseDate: releaseDateVal, releaseTime: releaseTime || null, scoringCriteriaJson }
                });
            }
            else {
                station = await tx.station.create({
                    data: { title: title || 'منزلگاه جدید', subtitle: subtitleVal, description: description || '', iconUrl: iconUrl || '', orderIndex: orderIndexVal, releaseDate: releaseDateVal, releaseTime: releaseTime || null, scoringCriteriaJson }
                });
            }
            if (categories && Array.isArray(categories)) {
                const existingCategories = await tx.classCategory.findMany({
                    where: { stationId: station.id }
                });
                const existingCategoryIds = existingCategories.map(c => c.id);
                const incomingCategoryIds = categories.filter(c => c.id && !c.id.startsWith('new_')).map(c => c.id);
                const categoriesToDelete = existingCategoryIds.filter(cid => !incomingCategoryIds.includes(cid));
                if (categoriesToDelete.length > 0) {
                    await tx.classCategory.deleteMany({
                        where: { id: { in: categoriesToDelete } }
                    });
                }
                for (let i = 0; i < categories.length; i++) {
                    const cat = categories[i];
                    let dbCategory;
                    const catOrder = parseInt(cat.orderIndex) || i;
                    if (cat.id && !cat.id.startsWith('new_') && existingCategoryIds.includes(cat.id)) {
                        dbCategory = await tx.classCategory.update({
                            where: { id: cat.id },
                            data: { title: cat.title || 'دسته کلاس', orderIndex: catOrder }
                        });
                    }
                    else {
                        dbCategory = await tx.classCategory.create({
                            data: { stationId: station.id, title: cat.title || 'دسته کلاس', orderIndex: catOrder }
                        });
                    }
                    const incomingSessions = cat.sessions || [];
                    const existingSessions = await tx.classSession.findMany({
                        where: { categoryId: dbCategory.id }
                    });
                    const existingSessionIds = existingSessions.map(s => s.id);
                    const incomingSessionIds = incomingSessions.filter((s) => s.id && !s.id.startsWith('new_')).map((s) => s.id);
                    const sessionsToDelete = existingSessionIds.filter(sid => !incomingSessionIds.includes(sid));
                    if (sessionsToDelete.length > 0) {
                        await tx.classSession.deleteMany({
                            where: { id: { in: sessionsToDelete } }
                        });
                    }
                    for (let j = 0; j < incomingSessions.length; j++) {
                        const sess = incomingSessions[j];
                        let dbSession;
                        const sessData = {
                            title: sess.title || 'جلسه',
                            description: sess.description || '',
                            videoUrl: sess.videoUrl || '',
                            instructor: sess.instructor || 'استاد نپا',
                            minWatchThreshold: parseInt(sess.minWatchThreshold) || 70,
                            minPassScore: parseInt(sess.minPassScore) || 0,
                            maxZarikReward: parseInt(sess.maxZarikReward) || 0,
                            maxPointsReward: parseInt(sess.maxPointsReward) || 0,
                            orderIndex: parseInt(sess.orderIndex) || j
                        };
                        if (sess.id && !sess.id.startsWith('new_') && existingSessionIds.includes(sess.id)) {
                            dbSession = await tx.classSession.update({
                                where: { id: sess.id },
                                data: sessData
                            });
                        }
                        else {
                            dbSession = await tx.classSession.create({
                                data: {
                                    categoryId: dbCategory.id,
                                    ...sessData
                                }
                            });
                        }
                        const incomingClips = sess.videoClips || [];
                        const existingClips = await tx.videoClip.findMany({
                            where: { sessionId: dbSession.id }
                        });
                        const existingClipIds = existingClips.map(clip => clip.id);
                        const incomingClipIds = incomingClips.filter((clip) => clip.id && !clip.id.startsWith('new_')).map((clip) => clip.id);
                        const clipsToDelete = existingClipIds.filter(cid => !incomingClipIds.includes(cid));
                        if (clipsToDelete.length > 0) {
                            await tx.videoClip.deleteMany({
                                where: { id: { in: clipsToDelete } }
                            });
                        }
                        for (let k = 0; k < incomingClips.length; k++) {
                            const clip = incomingClips[k];
                            const clipData = {
                                title: clip.title || 'پارت',
                                videoUrl: clip.videoUrl || '',
                                clipOrder: parseInt(clip.clipOrder) || k,
                                duration: parseInt(clip.duration) || 0
                            };
                            if (clip.id && !clip.id.startsWith('new_') && existingClipIds.includes(clip.id)) {
                                await tx.videoClip.update({
                                    where: { id: clip.id },
                                    data: clipData
                                });
                            }
                            else {
                                await tx.videoClip.create({
                                    data: {
                                        sessionId: dbSession.id,
                                        ...clipData
                                    }
                                });
                            }
                        }
                        const incomingQuizzes = sess.quizzes || (sess.quiz ? [sess.quiz] : []);
                        await tx.quiz.deleteMany({
                            where: { sessionId: dbSession.id }
                        });
                        for (let q = 0; q < incomingQuizzes.length; q++) {
                            const quizPayload = incomingQuizzes[q];
                            await tx.quiz.create({
                                data: {
                                    sessionId: dbSession.id,
                                    title: quizPayload.title || 'آزمون کلاس',
                                    questionsJson: typeof quizPayload.questionsJson === 'string'
                                        ? quizPayload.questionsJson
                                        : JSON.stringify(quizPayload.questionsJson || []),
                                    rewardZarik: parseInt(quizPayload.rewardZarik) || 10,
                                    rewardNakh: parseInt(quizPayload.rewardNakh) || 0,
                                    rewardFarsh: parseInt(quizPayload.rewardFarsh) || 0,
                                    orderIndex: parseInt(quizPayload.orderIndex) || (q + 1)
                                }
                            });
                        }
                    }
                }
            }
            return station;
        });
        res.json({ message: 'ساختار منزلگاه با موفقیت ذخیره شد', data: result });
    }
    catch (error) {
        console.error('createOrUpdateStation error:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
};
exports.createOrUpdateStation = createOrUpdateStation;
const createOrUpdateCategory = async (req, res) => {
    try {
        const { id, stationId, packageId, title, orderIndex } = req.body;
        const finalStationId = stationId || packageId;
        let category;
        if (id) {
            category = await db_1.default.classCategory.update({
                where: { id },
                data: { title, orderIndex: Number(orderIndex || 0) }
            });
        }
        else {
            category = await db_1.default.classCategory.create({
                data: { stationId: finalStationId, title, orderIndex: Number(orderIndex || 0) }
            });
        }
        res.json({ message: 'Saved successfully', data: category });
    }
    catch (error) {
        console.error('createOrUpdateCategory error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
exports.createOrUpdateCategory = createOrUpdateCategory;
const createOrUpdateSession = async (req, res) => {
    try {
        const { id, categoryId, subCourseId, title, description, videoUrl, instructor, teacher, minWatchThreshold, minPassScore, maxZarikReward, maxPointsReward, orderIndex } = req.body;
        const finalCategoryId = categoryId || subCourseId;
        const finalInstructor = instructor || teacher;
        let session;
        if (id) {
            session = await db_1.default.classSession.update({
                where: { id },
                data: { title, description, videoUrl, instructor: finalInstructor,
                    minWatchThreshold: Number(minWatchThreshold || 70),
                    minPassScore: Number(minPassScore || 0),
                    maxZarikReward: Number(maxZarikReward || 0),
                    maxPointsReward: Number(maxPointsReward || 0),
                    orderIndex: Number(orderIndex || 0) }
            });
        }
        else {
            session = await db_1.default.classSession.create({
                data: { categoryId: finalCategoryId, title, description, videoUrl, instructor: finalInstructor,
                    minWatchThreshold: Number(minWatchThreshold || 70),
                    minPassScore: Number(minPassScore || 0),
                    maxZarikReward: Number(maxZarikReward || 0),
                    maxPointsReward: Number(maxPointsReward || 0),
                    orderIndex: Number(orderIndex || 0) }
            });
        }
        res.json({ message: 'Saved successfully', data: session });
    }
    catch (error) {
        console.error('createOrUpdateSession error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
exports.createOrUpdateSession = createOrUpdateSession;
const createOrUpdateClip = async (req, res) => {
    try {
        const { id } = req.params; // session id
        const { clipId, title, clipOrder, videoUrl } = req.body;
        let clip;
        if (clipId) {
            clip = await db_1.default.videoClip.update({
                where: { id: clipId },
                data: {
                    title,
                    videoUrl,
                    clipOrder: Number(clipOrder || 0),
                }
            });
        }
        else {
            clip = await db_1.default.videoClip.create({
                data: {
                    sessionId: id,
                    title,
                    videoUrl,
                    clipOrder: Number(clipOrder || 0),
                    duration: 0
                }
            });
        }
        res.json({ message: 'Clip added successfully', data: clip });
    }
    catch (error) {
        console.error('addClipToSession error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
exports.createOrUpdateClip = createOrUpdateClip;
const createOrUpdateQuiz = async (req, res) => {
    try {
        const { id, sessionId, title, type, questionsJson, rewardZarik, rewardNakh, rewardFarsh } = req.body;
        let quiz;
        if (id) {
            quiz = await db_1.default.quiz.update({
                where: { id },
                data: { title, type, questionsJson, rewardZarik: Number(rewardZarik || 0), rewardNakh: Number(rewardNakh || 0), rewardFarsh: Number(rewardFarsh || 0) }
            });
        }
        else {
            quiz = await db_1.default.quiz.create({
                data: { sessionId, title, type, questionsJson, rewardZarik: Number(rewardZarik || 0), rewardNakh: Number(rewardNakh || 0), rewardFarsh: Number(rewardFarsh || 0) }
            });
        }
        res.json({ message: 'Saved successfully', data: quiz });
    }
    catch (error) {
        console.error('createOrUpdateQuiz error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
exports.createOrUpdateQuiz = createOrUpdateQuiz;
const seedStations = async (req, res) => {
    try {
        const existing = await db_1.default.station.count();
        if (existing > 0)
            return res.status(400).json({ error: 'Stations already exist.' });
        const stations = [
            { title: 'منزلگاه اول', subtitle: 'آغاز راه', orderIndex: 1 },
            { title: 'منزلگاه دوم', subtitle: 'تثبیت مهارت', orderIndex: 2 },
            { title: 'منزلگاه سوم', subtitle: 'پیشرفت مستمر', orderIndex: 3 },
            { title: 'منزلگاه چهارم', subtitle: 'تسلط', orderIndex: 4 },
            { title: 'منزلگاه پنجم', subtitle: 'راهبران نوباوه', orderIndex: 5 },
        ];
        await db_1.default.station.createMany({ data: stations });
        res.json({ message: 'Seeded 5 base stations successfully' });
    }
    catch (error) {
        console.error('seedStations error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
exports.seedStations = seedStations;
const getBookmarks = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const bookmarks = await db_1.default.videoBookmark.findMany({
            where: { sessionId, userId },
            orderBy: { videoSeconds: 'asc' }
        });
        res.json(bookmarks);
    }
    catch (error) {
        console.error('getBookmarks error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
exports.getBookmarks = getBookmarks;
const addBookmark = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const { sessionId, videoSeconds, noteText } = req.body;
        const bookmark = await db_1.default.videoBookmark.create({
            data: {
                sessionId,
                userId,
                videoSeconds,
                noteText
            }
        });
        res.status(201).json(bookmark);
    }
    catch (error) {
        console.error('addBookmark error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
exports.addBookmark = addBookmark;
const heartbeatSessionWatch = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const { id: sessionId } = req.params;
        const { currentPositionSeconds, durationSeconds } = req.body;
        if (currentPositionSeconds === undefined || !durationSeconds) {
            return res.status(400).json({ error: 'Invalid parameters' });
        }
        let record = await db_1.default.sessionWatchRecord.findUnique({
            where: { userId_sessionId: { userId, sessionId } }
        });
        const now = new Date();
        if (!record) {
            record = await db_1.default.sessionWatchRecord.create({
                data: {
                    userId,
                    sessionId,
                    watchedPercentage: 0,
                    lastPositionSeconds: currentPositionSeconds,
                    watchedSeconds: 0,
                    lastWatchedAt: now
                }
            });
        }
        else {
            const elapsedRealSeconds = Math.max(0, Math.floor((now.getTime() - record.lastWatchedAt.getTime()) / 1000));
            const delta = currentPositionSeconds - record.lastPositionSeconds;
            if (delta > 0 && elapsedRealSeconds > 0) {
                const maxAllowedDelta = Math.max(5, elapsedRealSeconds * 2.5); // Support up to 2.5x speed
                if (delta <= maxAllowedDelta) {
                    record.watchedSeconds += delta;
                }
                else {
                    record.watchedSeconds += elapsedRealSeconds; // Cap at real elapsed time
                }
            }
            const watchedPercentage = Math.min(100.0, (record.watchedSeconds / durationSeconds) * 100.0);
            record = await db_1.default.sessionWatchRecord.update({
                where: { id: record.id },
                data: {
                    watchedPercentage,
                    lastPositionSeconds: currentPositionSeconds,
                    watchedSeconds: record.watchedSeconds,
                    lastWatchedAt: now
                }
            });
        }
        res.json({
            watchedPercentage: record.watchedPercentage,
            lastPositionSeconds: record.lastPositionSeconds,
            quizUnlocked: record.watchedPercentage >= 70.0
        });
        // Evaluate progress asynchronously
        (0, certificateController_1.evaluateStudentProgress)(userId);
    }
    catch (error) {
        console.error('heartbeatSessionWatch error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
exports.heartbeatSessionWatch = heartbeatSessionWatch;
const getSessionWatchProgress = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const { id: sessionId } = req.params;
        const record = await db_1.default.sessionWatchRecord.findUnique({
            where: { userId_sessionId: { userId, sessionId } }
        });
        if (!record) {
            return res.json({ resumePosition: 0, watchedPercentage: 0 });
        }
        const now = new Date();
        const elapsedMinutes = Math.floor((now.getTime() - record.lastWatchedAt.getTime()) / 60000);
        let resumePosition = record.lastPositionSeconds;
        if (elapsedMinutes > 60) {
            resumePosition = 0;
        }
        res.json({
            resumePosition,
            watchedPercentage: record.watchedPercentage
        });
    }
    catch (error) {
        console.error('getSessionWatchProgress error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
exports.getSessionWatchProgress = getSessionWatchProgress;
const submitSessionQuiz = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const { id: sessionId } = req.params;
        const { answers, quizId } = req.body;
        if (!Array.isArray(answers)) {
            return res.status(400).json({ error: 'فرمت پاسخ‌ها نامعتبر است' });
        }
        const session = await db_1.default.classSession.findUnique({
            where: { id: sessionId },
            include: { quizzes: true, category: true }
        });
        if (!session || !session.quizzes || session.quizzes.length === 0) {
            return res.status(404).json({ error: 'آزمون این جلسه یافت نشد' });
        }
        const targetQuiz = quizId ? session.quizzes.find(q => q.id === quizId) : session.quizzes[0];
        if (!targetQuiz) {
            return res.status(404).json({ error: 'آزمون مشخص شده یافت نشد' });
        }
        const questionsList = targetQuiz.questionsJson ? JSON.parse(targetQuiz.questionsJson) : [];
        let correctCount = 0;
        for (let i = 0; i < questionsList.length; i++) {
            if (answers[i] === questionsList[i].correct) {
                correctCount++;
            }
        }
        const minPass = session.minPassScore || 3;
        let passed = false;
        let submissionStatus = 'PENDING';
        let rewardZarik = targetQuiz.rewardZarik || 200;
        const rewardNakh = targetQuiz.rewardNakh || 0;
        const rewardFarsh = targetQuiz.rewardFarsh || 0;
        if (targetQuiz.type === 'MULTIPLE_CHOICE' || !targetQuiz.type) {
            passed = correctCount >= minPass;
            submissionStatus = passed ? 'APPROVED' : 'FAILED';
        }
        else {
            // For TEXT and FILE, it awaits mentor review
            passed = false;
            submissionStatus = 'PENDING';
        }
        // Check if student has already passed this quiz to prevent double rewards
        const existingApproved = await db_1.default.quizSubmission.findFirst({
            where: { quizId: targetQuiz.id, studentId: userId, status: 'APPROVED' }
        });
        const isFirstPass = passed && !existingApproved;
        let submission;
        await db_1.default.$transaction(async (tx) => {
            submission = await tx.quizSubmission.create({
                data: {
                    quizId: targetQuiz.id,
                    studentId: userId,
                    status: submissionStatus,
                    score: correctCount,
                    answersJson: JSON.stringify(answers)
                }
            });
            if (isFirstPass) {
                // Increment student balance and assets
                await tx.user.update({
                    where: { id: userId },
                    data: {
                        zarikBalance: { increment: rewardZarik },
                        nakh: { increment: rewardNakh },
                        farsh: { increment: rewardFarsh }
                    }
                });
                // Log transaction in ZarikTransaction if zarik is awarded
                if (rewardZarik > 0) {
                    await tx.zarikTransaction.create({
                        data: {
                            userId,
                            amount: rewardZarik,
                            category: 'Quiz Rewards',
                            reason: `پاداش شرکت در آزمون کلاس: ${session.title}`,
                            createdBy: userId
                        }
                    });
                }
                const clip = await tx.videoClip.findFirst({
                    where: { sessionId: session.id, clipOrder: targetQuiz.orderIndex }
                });
                if (clip) {
                    const trackType = session.category?.title?.includes('مهارتی') ? 'skill' : 'media';
                    const stationId = session.category?.stationId || 'unknown';
                    let progress = await tx.userProgress.findUnique({
                        where: { userId_clipId: { userId, clipId: clip.id } }
                    });
                    if (progress) {
                        await tx.userProgress.update({
                            where: { id: progress.id },
                            data: { quizPassed: true }
                        });
                    }
                    else {
                        await tx.userProgress.create({
                            data: {
                                userId,
                                clipId: clip.id,
                                trackType,
                                stationId,
                                sessionId: session.id,
                                quizPassed: true
                            }
                        });
                    }
                }
            }
        });
        // Send notification
        let notificationTitle = passed ? 'قبولی در آزمون کلاس 🎉' : 'نتیجه آزمون کلاس 📝';
        let notificationMessage = passed
            ? `تبریک! شما در آزمون "${session.title}" قبول شدید. نمره: ${correctCount}/${questionsList.length}. پاداش: +${rewardZarik} زریک`
            : `شما در آزمون "${session.title}" نمره قبولی کسب نکردید. نمره: ${correctCount}/${questionsList.length}. مجدداً تلاش کنید.`;
        if (submissionStatus === 'PENDING') {
            notificationTitle = 'آزمون ثبت شد 📝';
            notificationMessage = `پاسخ شما برای آزمون "${session.title}" با موفقیت ثبت شد و در انتظار بررسی راهبر است.`;
        }
        await db_1.default.notification.create({
            data: {
                userId,
                title: notificationTitle,
                message: notificationMessage,
                type: 'reward'
            }
        });
        res.json({
            score: correctCount,
            total: questionsList.length,
            passed,
            rewardZarik: isFirstPass ? rewardZarik : 0,
            submissionId: submission?.id
        });
        // Evaluate progress asynchronously
        (0, certificateController_1.evaluateStudentProgress)(userId);
    }
    catch (error) {
        console.error('submitSessionQuiz error:', error);
        res.status(500).json({ error: 'خطایی در تصحیح و ثبت آزمون کلاس رخ داد' });
    }
};
exports.submitSessionQuiz = submitSessionQuiz;
const deleteStation = async (req, res) => {
    try {
        const { id } = req.params;
        await db_1.default.station.delete({
            where: { id }
        });
        res.json({ message: 'Station deleted successfully' });
    }
    catch (error) {
        console.error('deleteStation error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
exports.deleteStation = deleteStation;
const getUserProgress = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const progress = await db_1.default.userProgress.findMany({
            where: { userId }
        });
        res.json(progress);
    }
    catch (error) {
        console.error('getUserProgress error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
exports.getUserProgress = getUserProgress;
const markClipWatched = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const { clipId } = req.params;
        const { trackType, stationId, sessionId } = req.body;
        let progress = await db_1.default.userProgress.findUnique({
            where: { userId_clipId: { userId, clipId } }
        });
        if (progress) {
            progress = await db_1.default.userProgress.update({
                where: { id: progress.id },
                data: { isWatched: true }
            });
        }
        else {
            progress = await db_1.default.userProgress.create({
                data: {
                    userId,
                    clipId,
                    trackType: trackType || 'unknown',
                    stationId: stationId || 'unknown',
                    sessionId: sessionId || 'unknown',
                    isWatched: true
                }
            });
        }
        res.json(progress);
    }
    catch (error) {
        console.error('markClipWatched error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
exports.markClipWatched = markClipWatched;
const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        await db_1.default.classCategory.delete({ where: { id } });
        res.json({ message: 'Category deleted successfully' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
};
exports.deleteCategory = deleteCategory;
const deleteSession = async (req, res) => {
    try {
        const { id } = req.params;
        await db_1.default.classSession.delete({ where: { id } });
        res.json({ message: 'Session deleted successfully' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete session' });
    }
};
exports.deleteSession = deleteSession;
const deleteClip = async (req, res) => {
    try {
        const { id } = req.params;
        await db_1.default.videoClip.delete({ where: { id } });
        res.json({ message: 'Clip deleted successfully' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete clip' });
    }
};
exports.deleteClip = deleteClip;
const deleteQuiz = async (req, res) => {
    try {
        const { id } = req.params;
        await db_1.default.quiz.delete({ where: { id } });
        res.json({ message: 'Quiz deleted successfully' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete quiz' });
    }
};
exports.deleteQuiz = deleteQuiz;
exports.createStation = exports.createOrUpdateStation;
exports.updateStation = exports.createOrUpdateStation;
exports.createClass = exports.createOrUpdateCategory;
exports.updateClass = exports.createOrUpdateCategory;
exports.createSession = exports.createOrUpdateSession;
exports.updateSession = exports.createOrUpdateSession;
exports.createPart = exports.createOrUpdateClip;
exports.updatePart = exports.createOrUpdateClip;
exports.createQuestion = exports.createOrUpdateQuiz;
exports.updateQuestion = exports.createOrUpdateQuiz;
