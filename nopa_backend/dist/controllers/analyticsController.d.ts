import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const getDashboardAnalytics: (req: Request, res: Response) => Promise<void>;
export declare const getMentorAnalytics: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
