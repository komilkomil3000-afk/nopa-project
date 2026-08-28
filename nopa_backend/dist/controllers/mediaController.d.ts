import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import multer from 'multer';
export declare const upload: multer.Multer;
export declare const uploadMedia: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getMediaAssets: (req: Request, res: Response) => Promise<void>;
