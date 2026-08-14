import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const getDirectMessages: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getCaravanMessages: (req: AuthRequest, res: Response) => Promise<void>;
export declare const sendMessage: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getAllChatsAdmin: (req: AuthRequest, res: Response) => Promise<void>;
export declare const deleteMessage: (req: AuthRequest, res: Response) => Promise<void>;
