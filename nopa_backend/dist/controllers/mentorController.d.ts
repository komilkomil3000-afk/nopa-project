import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare function getMentors(req: AuthRequest, res: Response): Promise<void>;
export declare function createOrUpdateMentor(req: AuthRequest, res: Response): Promise<void>;
export declare function grantFiveStars(req: AuthRequest, res: Response): Promise<void>;
