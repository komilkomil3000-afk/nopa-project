import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare function createMentorChallenge(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getMentorChallenges(req: AuthRequest, res: Response): Promise<void>;
export declare function getChallengeSubmissions(req: AuthRequest, res: Response): Promise<void>;
export declare function reviewChallengeSubmission(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getMentorTicketDetails(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function replyMentorTicket(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
