import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare function revokeAllSessions(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function addBlacklist(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function removeBlacklist(req: AuthRequest, res: Response): Promise<void>;
export declare function getBlacklist(req: AuthRequest, res: Response): Promise<void>;
