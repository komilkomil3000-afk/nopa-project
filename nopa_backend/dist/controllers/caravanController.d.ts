import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare function toggleCaravanStatus(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function bulkTransferMembers(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function convertAssets(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function approveAssetConversion(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getAssetConversionsAdmin(req: AuthRequest, res: Response): Promise<void>;
