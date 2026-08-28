import { Request, Response } from 'express';
export declare function getCaravanLeague(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getWealthiestLeague(req: Request, res: Response): Promise<void>;
export declare function getMentorLeague(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
