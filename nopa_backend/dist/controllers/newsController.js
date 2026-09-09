"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteNews = exports.updateNews = exports.createNews = exports.getAdminNews = exports.getNews = void 0;
exports.syncNewsNotifications = syncNewsNotifications;
const db_1 = __importDefault(require("../config/db"));
const getNews = async (req, res) => {
    try {
        const news = await db_1.default.newsArticle.findMany({
            where: { isPublished: true },
            orderBy: { createdAt: 'desc' },
        });
        res.status(200).json(news);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getNews = getNews;
const getAdminNews = async (req, res) => {
    try {
        const news = await db_1.default.newsArticle.findMany({
            orderBy: { createdAt: 'desc' },
        });
        res.status(200).json(news);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getAdminNews = getAdminNews;
async function syncNewsNotifications(article) {
    try {
        if (!article || !article.isPublished)
            return;
        const aud = (article.targetAudience || 'ALL').toUpperCase();
        let whereClause = { isDeleted: false };
        if (aud === 'STUDENTS') {
            whereClause.OR = [{ role: 'student' }, { role: 'admin' }];
        }
        else if (aud === 'MENTORS') {
            whereClause.OR = [{ role: 'mentor' }, { role: 'admin' }];
        }
        else if (aud === 'CARAVAN_LEADERS') {
            whereClause.OR = [
                { role: 'mentor' },
                { role: 'admin' },
                { caravansLed: { some: {} } }
            ];
        }
        const users = await db_1.default.user.findMany({
            where: whereClause,
            select: { id: true }
        });
        const notifTitle = `📢 ${article.title}`;
        const messageContent = article.subtitle ? `${article.subtitle}\n\n${article.body}` : article.body;
        for (const u of users) {
            const existing = await db_1.default.notification.findFirst({
                where: {
                    userId: u.id,
                    OR: [
                        { title: notifTitle },
                        { title: article.title }
                    ]
                }
            });
            if (!existing) {
                await db_1.default.notification.create({
                    data: {
                        userId: u.id,
                        title: notifTitle,
                        message: messageContent || 'خبر جدیدی در تابلوی اعلانات جارچی منتشر شد.',
                        type: 'news',
                        createdAt: article.publishDate || article.createdAt || new Date(),
                        isRead: false
                    }
                });
            }
        }
    }
    catch (err) {
        console.error('Failed to sync news notifications:', err);
    }
}
const createNews = async (req, res) => {
    try {
        const { title, subtitle, body, reporter, category, isPublished, targetAudience, publishDate } = req.body;
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
        const isPub = isPublished !== undefined ? String(isPublished) === 'true' : true;
        const article = await db_1.default.newsArticle.create({
            data: {
                title,
                subtitle,
                body,
                imageUrl,
                reporter: reporter || 'نپا',
                category: category || 'general',
                targetAudience: targetAudience || 'ALL',
                publishDate: publishDate ? new Date(publishDate) : new Date(),
                isPublished: isPub,
            },
        });
        if (isPub) {
            await syncNewsNotifications(article);
        }
        res.status(201).json(article);
    }
    catch (error) {
        console.error('createNews error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createNews = createNews;
const updateNews = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, subtitle, body, reporter, category, isPublished, targetAudience, publishDate } = req.body;
        const data = {};
        if (title)
            data.title = title;
        if (subtitle !== undefined)
            data.subtitle = subtitle;
        if (body)
            data.body = body;
        if (reporter !== undefined)
            data.reporter = reporter;
        if (category)
            data.category = category;
        if (targetAudience)
            data.targetAudience = targetAudience;
        if (publishDate)
            data.publishDate = new Date(publishDate);
        if (isPublished !== undefined)
            data.isPublished = String(isPublished) === 'true';
        if (req.file)
            data.imageUrl = `/uploads/${req.file.filename}`;
        const article = await db_1.default.newsArticle.update({
            where: { id },
            data,
        });
        if (article.isPublished) {
            await syncNewsNotifications(article);
        }
        res.status(200).json(article);
    }
    catch (error) {
        console.error('updateNews error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateNews = updateNews;
const deleteNews = async (req, res) => {
    try {
        const { id } = req.params;
        const article = await db_1.default.newsArticle.findUnique({ where: { id } });
        if (article) {
            const notifTitle = `📢 ${article.title}`;
            await db_1.default.notification.deleteMany({
                where: {
                    OR: [
                        { title: notifTitle },
                        { title: article.title }
                    ]
                }
            });
        }
        await db_1.default.newsArticle.delete({ where: { id } });
        res.status(200).json({ message: 'Deleted successfully' });
    }
    catch (error) {
        console.error('deleteNews error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteNews = deleteNews;
