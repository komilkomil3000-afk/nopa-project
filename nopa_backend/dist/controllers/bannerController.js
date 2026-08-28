"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteBanner = exports.updateBanner = exports.createBanner = exports.getAdminBanners = exports.getBanners = void 0;
const db_1 = __importDefault(require("../config/db"));
const getBanners = async (req, res) => {
    try {
        const { position } = req.query;
        const banners = await db_1.default.banner.findMany({
            where: {
                isActive: true,
                ...(position ? { position: position } : {})
            },
            orderBy: { orderIndex: 'asc' },
        });
        res.status(200).json(banners);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getBanners = getBanners;
const getAdminBanners = async (req, res) => {
    try {
        const banners = await db_1.default.banner.findMany({
            orderBy: [
                { position: 'asc' },
                { orderIndex: 'asc' }
            ],
        });
        res.status(200).json(banners);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getAdminBanners = getAdminBanners;
const createBanner = async (req, res) => {
    try {
        const { title, targetRoute, position, isActive, orderIndex } = req.body;
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
        if (!imageUrl) {
            return res.status(400).json({ error: 'Image is required for a banner' });
        }
        const banner = await db_1.default.banner.create({
            data: {
                title,
                imageUrl,
                targetRoute: targetRoute || null,
                position: position || 'bazaar_top',
                isActive: isActive !== undefined ? String(isActive) === 'true' : true,
                orderIndex: orderIndex ? parseInt(orderIndex) : 0,
            },
        });
        res.status(201).json(banner);
    }
    catch (error) {
        console.error('Error creating banner:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createBanner = createBanner;
const updateBanner = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, targetRoute, position, isActive, orderIndex } = req.body;
        const data = {};
        if (title)
            data.title = title;
        if (targetRoute !== undefined)
            data.targetRoute = targetRoute;
        if (position)
            data.position = position;
        if (isActive !== undefined)
            data.isActive = String(isActive) === 'true';
        if (orderIndex !== undefined)
            data.orderIndex = parseInt(orderIndex);
        if (req.file)
            data.imageUrl = `/uploads/${req.file.filename}`;
        const banner = await db_1.default.banner.update({
            where: { id },
            data,
        });
        res.status(200).json(banner);
    }
    catch (error) {
        console.error('Error updating banner:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateBanner = updateBanner;
const deleteBanner = async (req, res) => {
    try {
        const { id } = req.params;
        await db_1.default.banner.delete({ where: { id } });
        res.status(200).json({ message: 'Deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteBanner = deleteBanner;
