import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare function createOrUpdateStudent(req: AuthRequest, res: Response): Promise<void>;
export declare function adjustBalance(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function adjustLevelFrame(req: AuthRequest, res: Response): Promise<void>;
