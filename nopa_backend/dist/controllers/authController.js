"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPhone = verifyPhone;
exports.login = login;
exports.register = register;
exports.logout = logout;
exports.changePassword = changePassword;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = __importDefault(require("../config/db"));
const UNIVERSAL_SUPER_ADMIN_PHONE = '09380346668';
const normalizePhone = (phone) => {
    if (!phone)
        return '';
    const persianToEnglish = (str) => {
        const persianNumbers = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
        const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
        for (let i = 0; i < 10; i++) {
            str = str.replace(new RegExp(persianNumbers[i], 'g'), i.toString());
            str = str.replace(new RegExp(arabicNumbers[i], 'g'), i.toString());
        }
        return str;
    };
    let cleanPhone = persianToEnglish(phone.toString()).replace(/\D/g, '');
    if (cleanPhone.startsWith('0098')) {
        cleanPhone = '0' + cleanPhone.slice(4);
    }
    else if (cleanPhone.startsWith('98')) {
        cleanPhone = '0' + cleanPhone.slice(2);
    }
    else if (cleanPhone.length === 10 && cleanPhone.startsWith('9')) {
        cleanPhone = '0' + cleanPhone;
    }
    return cleanPhone;
};
async function verifyPhone(req, res) {
    try {
        const { phoneNumber } = req.body;
        if (!phoneNumber) {
            return res.status(400).json({ error: 'شماره تلفن الزامی است' });
        }
        const cleanPhone = normalizePhone(phoneNumber);
        const userCount = await db_1.default.user.count({ where: { phoneNumber: cleanPhone, isDeleted: false } });
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
        let { phoneNumber, password, role } = req.body;
        if (!phoneNumber) {
            return res.status(400).json({ error: 'شماره تلفن الزامی است' });
        }
        const cleanPhone = normalizePhone(phoneNumber);
        const rawPassword = password ? password.toString().trim() : '';
        const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
        const blacklistedIp = await db_1.default.blacklist.findUnique({ where: { value: clientIp } });
        if (blacklistedIp) {
            return res.status(403).json({ error: 'دسترسی مسدود شده است (IP Blocked)' });
        }
        let user = await db_1.default.user.findFirst({
            where: { phoneNumber: cleanPhone, isDeleted: false }
        });
        if (!user) {
            return res.status(404).json({ error: 'شماره همراه در سیستم ثبت نشده است' });
        }
        // Lockout check
        if (user.lockoutUntil && new Date() < user.lockoutUntil) {
            return res.status(429).json({ error: 'حساب کاربری شما به دلیل تلاشهای ناموفق بیش از حد به مدت ۱ ساعت قفل شده است' });
        }
        if (user.blocked) {
            return res.status(403).json({ error: 'حساب کاربری شما مسدود شده است' });
        }
        if (user.accountStatus === 'SUSPENDED') {
            return res.status(403).json({ error: 'حساب کاربری شما تعلیق شده است. جهت پیگیری تماس بگیرید.' });
        }
        if (user.accountStatus === 'RESTRICTED') {
            return res.status(403).json({ error: 'دسترسی شما به سامانه موقتاً محدود شده است.' });
        }
        // Password verification (Bcrypt check or universal passcode)
        let isPasswordCorrect = false;
        if (rawPassword === '123456') {
            isPasswordCorrect = true;
            if (!user.identityVerified) {
                await db_1.default.user.update({
                    where: { id: user.id },
                    data: { identityVerified: true }
                });
                user.identityVerified = true;
            }
        }
        else if (password) {
            isPasswordCorrect = await bcryptjs_1.default.compare(password, user.passwordHash);
        }
        if (!isPasswordCorrect) {
            const updatedAttempts = user.failedLoginAttempts + 1;
            if (updatedAttempts >= 15) {
                await db_1.default.user.update({
                    where: { id: user.id },
                    data: {
                        failedLoginAttempts: 0,
                        lockoutUntil: new Date(Date.now() + 60 * 60 * 1000)
                    }
                });
                return res.status(429).json({ error: 'حساب کاربری شما به دلیل تلاشهای ناموفق بیش از حد به مدت ۱ ساعت قفل شده است' });
            }
            else {
                await db_1.default.user.update({
                    where: { id: user.id },
                    data: { failedLoginAttempts: updatedAttempts }
                });
            }
            return res.status(401).json({ error: 'رمز عبور وارد شده نادرست است' });
        }
        // Reset attempts on success
        await db_1.default.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockoutUntil: null }
        });
        const secret = process.env.JWT_SECRET || 'nopa_super_secret_jwt_key_2026';
        const token = jsonwebtoken_1.default.sign({ id: user.id, role: user.role, phoneNumber: user.phoneNumber, tokenVersion: user.tokenVersion, identityVerified: true, name: user.name }, secret, { expiresIn: (process.env.JWT_EXPIRATION || '30d') });
        // Multi-Device Session Management (Item 10)
        const activeSessions = await db_1.default.userSession.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'asc' }
        });
        if (activeSessions.length >= 3) {
            await db_1.default.userSession.delete({
                where: { id: activeSessions[0].id }
            });
        }
        await db_1.default.userSession.create({
            data: {
                userId: user.id,
                token,
                deviceInfo: req.headers['user-agent'] || null
            }
        });
        res.status(200).json({
            token,
            user: {
                id: user.id,
                name: user.name,
                phoneNumber: user.phoneNumber,
                role: user.role,
                caravanId: user.caravanId,
                identityVerified: true
            }
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'خطایی در ورود به سیستم رخ داد' });
    }
}
async function register(req, res) {
    try {
        const { fullName, phoneNumber, countryCode, city, dateOfBirth, password } = req.body;
        if (!phoneNumber || !fullName || !password) {
            return res.status(400).json({ error: 'اطلاعات وارد شده ناقص است' });
        }
        // Normalize phone number
        const numericPhone = phoneNumber.toString().replace(/\D/g, '');
        let countryPrefix = countryCode || '+98';
        if (!countryPrefix.startsWith('+')) {
            countryPrefix = '+' + countryPrefix;
        }
        let cleanPhone = numericPhone;
        if (cleanPhone.startsWith('0')) {
            cleanPhone = cleanPhone.substring(1);
        }
        const countryDigits = countryPrefix.replace('+', '');
        if (cleanPhone.startsWith(countryDigits)) {
            cleanPhone = cleanPhone.substring(countryDigits.length);
        }
        const normalizedPhoneNumber = `${countryPrefix}${cleanPhone}`;
        const corePhone = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;
        // Check if phone exists (pre-created via CRM or similar)
        const existingUser = await db_1.default.user.findFirst({
            where: { phoneNumber: { endsWith: corePhone } }
        });
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        let activeUser;
        const maxUser = await db_1.default.user.findFirst({
            orderBy: { userCode: 'desc' },
            where: { userCode: { not: null } }
        });
        const nextUserCode = maxUser && maxUser.userCode ? maxUser.userCode + 1 : 110100;
        if (existingUser) {
            // Sync strategy: update profile fields, save hashed password, set registrationCompleted = true, preserve caravan
            activeUser = await db_1.default.user.update({
                where: { id: existingUser.id },
                data: {
                    name: fullName,
                    phoneNumber: normalizedPhoneNumber,
                    countryCode: countryPrefix,
                    city: city || null,
                    dateOfBirth: dateOfBirth || null,
                    passwordHash,
                    registrationCompleted: true,
                    userCode: existingUser.userCode || nextUserCode
                }
            });
        }
        else {
            // Create new student user and award 200 Zarik
            activeUser = await db_1.default.user.create({
                data: {
                    name: fullName,
                    phoneNumber: normalizedPhoneNumber,
                    countryCode: countryPrefix,
                    city: city || null,
                    dateOfBirth: dateOfBirth || null,
                    passwordHash,
                    registrationCompleted: true,
                    role: 'student',
                    zarikBalance: 200,
                    identityVerified: true,
                    userCode: nextUserCode
                }
            });
            // Zarik transaction log
            await db_1.default.zarikTransaction.create({
                data: {
                    userId: activeUser.id,
                    amount: 200,
                    category: 'Special Campaigns',
                    reason: 'هدیه ثبت‌نام اولیه کاربر جدید',
                    createdBy: 'SYSTEM'
                }
            });
        }
        // Generate token and session
        const secret = process.env.JWT_SECRET || 'nopa_super_secret_jwt_key_2026';
        const token = jsonwebtoken_1.default.sign({ id: activeUser.id, role: activeUser.role, phoneNumber: activeUser.phoneNumber, tokenVersion: activeUser.tokenVersion, identityVerified: true, name: activeUser.name }, secret, { expiresIn: (process.env.JWT_EXPIRATION || '30d') });
        const activeSessions = await db_1.default.userSession.findMany({
            where: { userId: activeUser.id },
            orderBy: { createdAt: 'asc' }
        });
        if (activeSessions.length >= 3) {
            await db_1.default.userSession.delete({
                where: { id: activeSessions[0].id }
            });
        }
        await db_1.default.userSession.create({
            data: {
                userId: activeUser.id,
                token,
                deviceInfo: req.headers['user-agent'] || null
            }
        });
        res.status(200).json({
            token,
            user: {
                id: activeUser.id,
                name: activeUser.name,
                phoneNumber: activeUser.phoneNumber,
                role: activeUser.role,
                zarikBalance: activeUser.zarikBalance,
                levelFrame: activeUser.levelFrame,
                caravanId: activeUser.caravanId,
                identityVerified: true,
                userCode: activeUser.userCode
            }
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'خطایی در ثبت‌نام رخ داد' });
    }
}
async function logout(req, res) {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            await db_1.default.userSession.deleteMany({
                where: { token }
            });
        }
        res.status(200).json({ success: true, message: 'خروج با موفقیت انجام شد' });
    }
    catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'خطایی در خروج رخ داد' });
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
