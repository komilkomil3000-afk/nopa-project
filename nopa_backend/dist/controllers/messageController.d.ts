import { Request, Response } from 'express';
export declare const sendMessage: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getAdminMessages: (req: Request, res: Response) => Promise<void>;
export declare const replyToMessage: (req: Request, res: Response) => Promise<void>;
