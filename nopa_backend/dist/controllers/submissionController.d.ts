import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare function submitTask(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getPendingSubmissions(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function reviewSubmission(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
