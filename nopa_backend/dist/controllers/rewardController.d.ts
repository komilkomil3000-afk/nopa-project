import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare function grantPromotionalZarik(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getZarikSalesStats(req: AuthRequest, res: Response): Promise<void>;
