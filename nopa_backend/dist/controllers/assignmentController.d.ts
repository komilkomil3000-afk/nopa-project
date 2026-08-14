import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare function getStudentAssignments(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function submitAssignment(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getPendingAssignmentSubmissions(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function reviewAssignmentSubmission(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
