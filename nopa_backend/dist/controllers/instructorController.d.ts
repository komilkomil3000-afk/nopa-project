import { Request, Response } from 'express';
export declare const getInstructors: (req: Request, res: Response) => Promise<void>;
export declare const getInstructorById: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const createOrUpdateInstructor: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deleteInstructor: (req: Request, res: Response) => Promise<void>;
