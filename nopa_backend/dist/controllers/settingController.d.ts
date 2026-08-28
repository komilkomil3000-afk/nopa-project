import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare function getSystemSetting(req: AuthRequest, res: Response): Promise<void>;
export declare function setSystemSetting(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
