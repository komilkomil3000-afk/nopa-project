import { Request, Response } from 'express';
export declare const getBanners: (req: Request, res: Response) => Promise<void>;
export declare const getAdminBanners: (req: Request, res: Response) => Promise<void>;
export declare const createBanner: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const updateBanner: (req: Request, res: Response) => Promise<void>;
export declare const deleteBanner: (req: Request, res: Response) => Promise<void>;
