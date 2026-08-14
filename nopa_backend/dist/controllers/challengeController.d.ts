import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare function createChallenge(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getChallenges(req: AuthRequest, res: Response): Promise<void>;
export declare function submitQuiz(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
