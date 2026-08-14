import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare function verifyPhone(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function login(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function changePassword(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
