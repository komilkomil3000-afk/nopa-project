"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMediaAssets = exports.uploadMedia = exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// Ensure uploads directory exists
const uploadsDir = path_1.default.join(__dirname, '../../uploads');
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
// Multer Storage Configuration
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path_1.default.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    },
});
// Init Upload (100MB limit)
exports.upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});
const uploadMedia = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const file = req.file;
        const url = `/uploads/${file.filename}`;
        const { assetType, title, instructor, duration } = req.body;
        const mediaAsset = await prisma.mediaAsset.create({
            data: {
                filename: file.filename,
                url: url,
                mimeType: file.mimetype,
                size: file.size,
                assetType: assetType || 'general',
                title: title || null,
                instructor: instructor || null,
                duration: duration ? parseInt(duration) : null,
            },
        });
        // If an authenticated mentor uploaded this file as a document, create a MentorDocument entry
        try {
            if (req.user && (req.user.role === 'mentor' || req.user.role === 'admin')) {
                const uploaderId = req.user.id;
                // Only create MentorDocument records for mentor role uploads and when assetType indicates mentor_document
                if (assetType === 'mentor_document' || req.user.role === 'mentor') {
                    await prisma.mentorDocument.create({
                        data: {
                            userId: uploaderId,
                            filename: file.filename,
                            url,
                            mimeType: file.mimetype,
                        },
                    });
                }
            }
        }
        catch (mdErr) {
            console.error('MentorDocument creation error:', mdErr);
        }
        res.status(201).json({
            message: 'File uploaded successfully',
            media: mediaAsset,
        });
    }
    catch (error) {
        console.error('Error uploading media:', error);
        res.status(500).json({ error: 'Failed to upload media' });
    }
};
exports.uploadMedia = uploadMedia;
const getMediaAssets = async (req, res) => {
    try {
        const media = await prisma.mediaAsset.findMany({
            orderBy: { createdAt: 'desc' },
        });
        res.json(media);
    }
    catch (error) {
        console.error('Error fetching media:', error);
        res.status(500).json({ error: 'Failed to fetch media assets' });
    }
};
exports.getMediaAssets = getMediaAssets;
