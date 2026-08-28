import { Request, Response } from 'express';
export declare const getNews: (req: Request, res: Response) => Promise<void>;
export declare const getAdminNews: (req: Request, res: Response) => Promise<void>;
export declare const createNews: (req: Request, res: Response) => Promise<void>;
export declare const updateNews: (req: Request, res: Response) => Promise<void>;
export declare const deleteNews: (req: Request, res: Response) => Promise<void>;
