import { Response } from 'express';
export declare const evaluateStudentProgress: (userId: string) => Promise<void>;
export declare const requestPhysicalCertificate: (req: any, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
