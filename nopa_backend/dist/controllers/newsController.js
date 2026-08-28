"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteNews = exports.updateNews = exports.createNews = exports.getAdminNews = exports.getNews = void 0;
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
const createNews = async (req, res) => {
    try {
        const { title, subtitle, body, reporter, category, isPublished, targetAudience, publishDate } = req.body;
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
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
                isPublished: isPublished !== undefined ? String(isPublished) === 'true' : true,
            },
        });
        res.status(201).json(article);
    }
    catch (error) {
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
        res.status(200).json(article);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateNews = updateNews;
const deleteNews = async (req, res) => {
    try {
        const { id } = req.params;
        await db_1.default.newsArticle.delete({ where: { id } });
        res.status(200).json({ message: 'Deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteNews = deleteNews;
