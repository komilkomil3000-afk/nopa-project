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
export declare function checkPermission(scope: keyof import('@prisma/client').RolePermission): (req: AuthRequest, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
