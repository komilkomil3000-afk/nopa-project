import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare function createQuizMock(req: AuthRequest, res: Response): Promise<void>;
