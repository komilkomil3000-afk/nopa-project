"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateJWT = authenticateJWT;
exports.authorizeRoles = authorizeRoles;
exports.checkPermission = checkPermission;
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
            // Super Admin Bypass
            if (payload.phoneNumber === '09380346668' || payload.phoneNumber === '09120000001' || payload.id === 'super-admin-bypass') {
                req.user = payload;
                return next();
            }
            try {
                const user = await db_1.default.user.findUnique({ where: { id: payload.id } });
                const isAdmin = payload.role?.toLowerCase() === 'admin';
                if (!user || (payload.tokenVersion !== undefined && user.tokenVersion !== payload.tokenVersion)) {
                    return res.status(401).json({ error: 'نشست شما نامعتبر یا منقضی شده است' });
                }
                if (!isAdmin) {
                    if (user.blocked || user.isDeleted) {
                        return res.status(401).json({ error: 'حساب شما مسدود یا حذف شده است' });
                    }
                    if (user.accountStatus === 'SUSPENDED') {
                        return res.status(403).json({ error: 'حساب کاربری شما تعلیق شده است' });
                    }
                    if (user.suspendedUntil && new Date(user.suspendedUntil) > new Date()) {
                        return res.status(403).json({ error: 'حساب کاربری شما موقتا مسدود شده است' });
                    }
                }
                // Validate active session token in database
                const activeSession = await db_1.default.userSession.findUnique({ where: { token } });
                if (!activeSession) {
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
    const lowerRoles = roles.map(r => r.toLowerCase());
    return (req, res, next) => {
        if (!req.user) {
            return res.status(403).json({ error: 'شما دسترسی لازم برای این عملیات را ندارید' });
        }
        if (req.user.phoneNumber === UNIVERSAL_SUPER_ADMIN_PHONE) {
            return next();
        }
        if (!req.user.role || !lowerRoles.includes(req.user.role.toLowerCase())) {
            return res.status(403).json({ error: 'شما دسترسی لازم برای این عملیات را ندارید' });
        }
        next();
    };
}
function checkPermission(scope) {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'شما دسترسی لازم برای این عملیات را ندارید' });
        }
        if (req.user.phoneNumber === UNIVERSAL_SUPER_ADMIN_PHONE) {
            return next();
        }
        try {
            const permission = await db_1.default.rolePermission.findUnique({
                where: { roleName: req.user.role }
            });
            if (!permission) {
                return res.status(403).json({ error: 'نقش کاربری شما نامعتبر است یا هیچ دسترسی تعریف نشده است' });
            }
            if (permission[scope] !== true) {
                return res.status(403).json({ error: 'شما دسترسی مجاز به این بخش را ندارید' });
            }
            next();
        }
        catch (e) {
            return res.status(500).json({ error: 'خطای سرور در بررسی دسترسی' });
        }
    };
}
