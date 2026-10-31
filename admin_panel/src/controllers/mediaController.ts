import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import prisma from '../config/db';


// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Allow-list of upload types. The stored file extension and the stored MIME type are derived
// from THIS table, never from the client-supplied filename or Content-Type, so a user cannot
// store an .html/.svg/.js file that the server would later serve as active content.
export const ALLOWED_UPLOADS: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.3gp': 'audio/3gpp',
  '.amr': 'audio/amr',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
};

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Random name; the client-supplied fieldname/originalname never reaches the file system
    // (a crafted fieldname such as "../../x" would otherwise be a path traversal).
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, crypto.randomBytes(16).toString('hex') + ext);
  },
});

function fileFilter(req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!ALLOWED_UPLOADS[ext]) {
    const err: any = new Error('نوع فایل مجاز نیست');
    err.status = 400;
    return cb(err);
  }
  // Store the canonical MIME type for this extension, not what the client claimed
  file.mimetype = ALLOWED_UPLOADS[ext];
  cb(null, true);
}

// Init Upload (100MB limit)
export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024, files: 1 }, // 100MB
});

export const uploadMedia = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    const url = `/uploads/${file.filename}`;
    const { assetType, title, instructor, duration, category } = req.body;

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
              category: category || null,
            },
          });
        }
      }
    } catch (mdErr) {
      console.error('MentorDocument creation error:', mdErr);
    }

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      url,
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
