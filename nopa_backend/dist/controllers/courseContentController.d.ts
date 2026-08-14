import { Request, Response } from 'express';
export declare function createClassSession(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function createSessionAssignment(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
