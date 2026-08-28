import { Request, Response } from 'express';
export declare const getForms: (req: Request, res: Response) => Promise<void>;
export declare const createOrUpdateForm: (req: Request, res: Response) => Promise<void>;
export declare const deleteForm: (req: Request, res: Response) => Promise<void>;
export declare const createOrUpdateField: (req: Request, res: Response) => Promise<void>;
export declare const deleteField: (req: Request, res: Response) => Promise<void>;
export declare const submitForm: (req: Request, res: Response) => Promise<void>;
export declare const getFormSubmissions: (req: Request, res: Response) => Promise<void>;
