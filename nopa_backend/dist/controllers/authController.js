"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPhone = verifyPhone;
exports.login = login;
exports.changePassword = changePassword;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = __importDefault(require("../config/db"));
const UNIVERSAL_SUPER_ADMIN_PHONE = '09380346668';
async function verifyPhone(req, res) {
    try {
        const { phoneNumber } = req.body;
        if (!phoneNumber) {
            return res.status(400).json({ error: 'شماره تلفن الزامی است' });
        }
        const userCount = await db_1.default.user.count({ where: { phoneNumber } });
        if (userCount === 0) {
            return res.status(404).json({ error: 'شماره شما در سامانه ثبت نشده است. لطفا با مدیریت تماس بگیرید' });
        }
        res.json({ success: true, count: userCount });
    }
    catch (error) {
        console.error('Verify phone error:', error);
        res.status(500).json({ error: 'خطایی در بررسی شماره رخ داد' });
    }
}
async function login(req, res) {
    try {
        const { phoneNumber, password } = req.body;
        if (!phoneNumber || !password) {
            return res.status(400).json({ error: 'شماره تلفن و رمز عبور الزامی است' });
        }
        const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
        // Check IP Blacklist
        const blacklistedIp = await db_1.default.blacklist.findUnique({ where: { value: clientIp } });
        if (blacklistedIp) {
            return res.status(403).json({ error: 'دسترسی مسدود شده است (IP Blocked)' });
        }
        // Check Phone Blacklist
        const blacklistedPhone = await db_1.default.blacklist.findUnique({ where: { value: phoneNumber } });
        if (blacklistedPhone) {
            return res.status(403).json({ error: 'دسترسی مسدود شده است (Phone Blocked)' });
        }
        // Support optional role matching for multi-account
        const { role } = req.body;
        const users = await db_1.default.user.findMany({
            where: { phoneNumber }
        });
        if (users.length === 0) {
            return res.status(404).json({ error: 'کاربری با این شماره تلفن یافت نشد' });
        }
        // If multiple users exist and no specific role is provided, return the profile switcher list
        if (users.length > 1 && !role) {
            return res.status(300).json({
                message: 'Multiple profiles found',
                profiles: users.map(u => ({ id: u.id, name: u.name, role: u.role }))
            });
        }
        // Filter by role if provided, otherwise pick the first user for this number.
        // The universal super-admin should be able to log in regardless of the selected role.
        let user = role ? users.find(u => u.role === role) : users[0];
        if (!user) {
            user = users.find(u => u.phoneNumber === UNIVERSAL_SUPER_ADMIN_PHONE) || undefined;
        }
        if (!user) {
            return res.status(403).json({ error: 'حساب کاربری با این نقش برای شما یافت نشد' });
        }
        if (user.blocked) {
            return res.status(403).json({ error: 'حساب کاربری شما مسدود شده است' });
        }
        if (user.lockoutUntil && user.lockoutUntil > new Date()) {
            return res.status(429).json({ error: 'تعداد تلاش‌های ناموفق زیاد بود. لطفا بعدا تلاش کنید' });
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isMatch) {
            const attempts = (user.failedLoginAttempts || 0) + 1;
            let lockoutUntil = null;
            if (attempts >= 5) {
                lockoutUntil = new Date(Date.now() + 15 * 60 * 1000); // Lock for 15 minutes
            }
            await db_1.default.user.update({
                where: { id: user.id },
                data: { failedLoginAttempts: attempts, lockoutUntil }
            });
            return res.status(401).json({ error: 'رمز عبور وارد شده نادرست است' });
        }
        // Reset attempts on success
        await db_1.default.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockoutUntil: null }
        });
        const secret = process.env.JWT_SECRET || 'nopa_super_secret_jwt_key_2026';
        const token = jsonwebtoken_1.default.sign({ id: user.id, role: user.role, phoneNumber: user.phoneNumber, tokenVersion: user.tokenVersion }, secret, { expiresIn: (process.env.JWT_EXPIRATION || '30d') });
        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                phoneNumber: user.phoneNumber,
                role: user.role,
                zarikBalance: user.zarikBalance,
                levelFrame: user.levelFrame,
                caravanId: user.caravanId,
                identityVerified: user.identityVerified
            }
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'خطایی در ورود به سیستم رخ داد' });
    }
}
async function changePassword(req, res) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'کاربر احراز هویت نشده است' });
        }
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'رمز عبور فعلی و رمز جدید الزامی است' });
        }
        const user = await db_1.default.user.findUnique({ where: { id: req.user.id } });
        if (!user) {
            return res.status(404).json({ error: 'کاربر یافت نشد' });
        }
        const currentMatch = await bcryptjs_1.default.compare(currentPassword, user.passwordHash);
        if (!currentMatch) {
            return res.status(401).json({ error: 'رمز عبور فعلی نامعتبر است' });
        }
        const newHash = await bcryptjs_1.default.hash(newPassword, 10);
        await db_1.default.user.update({
            where: { id: user.id },
            data: { passwordHash: newHash }
        });
        res.json({ success: true, message: 'رمز عبور با موفقیت تغییر یافت' });
    }
    catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'خطا در تغییر رمز عبور رخ داد' });
    }
}
