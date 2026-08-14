"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateJWT = authenticateJWT;
exports.authorizeRoles = authorizeRoles;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = __importDefault(require("../config/db"));
function authenticateJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const secret = process.env.JWT_SECRET || 'nopa_super_secret_jwt_key_2026';
        jsonwebtoken_1.default.verify(token, secret, async (err, decoded) => {
            if (err) {
                return res.status(403).json({ error: 'کاربر غیرمجاز است یا توکن منقضی شده است' });
            }
            const payload = decoded;
            try {
                const user = await db_1.default.user.findUnique({ where: { id: payload.id } });
                if (!user || user.blocked || (payload.tokenVersion !== undefined && user.tokenVersion !== payload.tokenVersion)) {
                    return res.status(401).json({ error: 'نشست شما نامعتبر یا منقضی شده است' });
                }
                // Also check IP blacklist as an extra layer
                const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
                const blacklistedIp = await db_1.default.blacklist.findUnique({ where: { value: clientIp } });
                if (blacklistedIp) {
                    return res.status(403).json({ error: 'دسترسی مسدود شده است (IP Blocked)' });
                }
                req.user = payload;
                next();
            }
            catch (dbErr) {
                return res.status(500).json({ error: 'خطای سرور در اعتبارسنجی کاربر' });
            }
        });
    }
    else {
        res.status(401).json({ error: 'توکن اعتبارسنجی ارسال نشده است' });
    }
}
const UNIVERSAL_SUPER_ADMIN_PHONE = '09380346668';
function authorizeRoles(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(403).json({ error: 'شما دسترسی لازم برای این عملیات را ندارید' });
        }
        if (req.user.phoneNumber === UNIVERSAL_SUPER_ADMIN_PHONE) {
            return next();
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'شما دسترسی لازم برای این عملیات را ندارید' });
        }
        next();
    };
}
