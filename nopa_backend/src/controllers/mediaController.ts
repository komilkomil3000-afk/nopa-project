import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  },
});

// Init Upload (100MB limit)
export const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

export const uploadMedia = async (req: AuthRequest, res: Response) => {
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
    } catch (mdErr) {
      console.error('MentorDocument creation error:', mdErr);
    }

    res.status(201).json({
      message: 'File uploaded successfully',
      media: mediaAsset,
    });
  } catch (error) {
    console.error('Error uploading media:', error);
    res.status(500).json({ error: 'Failed to upload media' });
  }
};

export const getMediaAssets = async (req: Request, res: Response) => {
  try {
    const media = await prisma.mediaAsset.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(media);
  } catch (error) {
    console.error('Error fetching media:', error);
    res.status(500).json({ error: 'Failed to fetch media assets' });
  }
};
