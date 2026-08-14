import { Request, Response, NextFunction } from 'express';
export interface AuthRequest extends Request {
    user?: {
        id: string;
        role: string;
        phoneNumber: string;
        tokenVersion?: number;
    };
}
export declare function authenticateJWT(req: AuthRequest, res: Response, next: NextFunction): void;
export declare function authorizeRoles(...roles: string[]): (req: AuthRequest, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
