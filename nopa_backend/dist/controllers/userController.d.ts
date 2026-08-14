import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare function getMe(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function completeProfile(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getMentorById(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
