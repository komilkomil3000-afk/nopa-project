import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare function createTicket(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getTickets(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function replyTicket(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function resolveTicket(req: AuthRequest, res: Response): Promise<void>;
