import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare function grantPromotionalZarik(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getZarikSalesStats(req: AuthRequest, res: Response): Promise<void>;
export declare function getMentorRewardRules(req: AuthRequest, res: Response): Promise<void>;
export declare function createMentorRewardRule(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function deleteMentorRewardRule(req: AuthRequest, res: Response): Promise<void>;
export declare function validateRewardGrant(mentorId: string, caravanId: string | null, stationId: string | null, rewardType: string, amount: number): Promise<void>;
