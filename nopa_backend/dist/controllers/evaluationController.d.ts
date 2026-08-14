import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare function evaluateMentor(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
