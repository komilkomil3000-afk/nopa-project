import { Request, Response } from 'express';
import { isAppClient, logLiveEvent, markAppAway } from '../services/liveActivity';
import { logUserEvent } from '../services/userLog';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { recordSmsDispatch, getClientIp } from '../middleware/smsProtection';
import { getJwtSecret, getJwtRefreshSecret } from '../config/secrets';

const normalizePhone = (phone: any) => {
  if (!phone) return '';
  const persianToEnglish = (str: string) => {
    const persianNumbers = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    const arabicNumbers  = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    for (let i = 0; i < 10; i++) {
      str = str.replace(new RegExp(persianNumbers[i], 'g'), i.toString());
      str = str.replace(new RegExp(arabicNumbers[i], 'g'), i.toString());
    }
    return str;
  };
  let cleanPhone = persianToEnglish(phone.toString()).replace(/\D/g, '');
  if (cleanPhone.startsWith('0098')) {
    cleanPhone = '0' + cleanPhone.slice(4);
  } else if (cleanPhone.startsWith('98')) {
    cleanPhone = '0' + cleanPhone.slice(2);
  } else if (cleanPhone.length === 10 && cleanPhone.startsWith('9')) {
    cleanPhone = '0' + cleanPhone;
  }
  return cleanPhone;
};

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/** Persian / Arabic digits -> English digits. */
const toEnglishDigits = (str: string) =>
  str.replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d))).replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));

/** English digits -> Persian digits. */
const toPersianDigits = (str: string) => str.replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)]);

/**
 * A password typed with Persian digits and one typed with English digits are the same password:
 * the stored hash may come from either spelling, so both are tried.
 */
async function passwordMatches(hash: string | null, typed: string): Promise<boolean> {
  if (!hash || !typed) return false;
  const english = toEnglishDigits(typed);
  const variants = Array.from(new Set([typed, english, toPersianDigits(english)]));
  for (const v of variants) {
    if (await bcrypt.compare(v, hash)) return true;
  }
  return false;
}

export async function verifyPhone(req: Request, res: Response) {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ error: 'شماره تلفن الزامی است' });
    }
    const cleanPhone = normalizePhone(phoneNumber);
    const userCount = await prisma.user.count({ where: { phoneNumber: cleanPhone, isDeleted: false } });
    if (userCount === 0) {
      return res.status(404).json({ error: 'شماره شما در سامانه ثبت نشده است. لطفا با مدیریت تماس بگیرید' });
    }

    // Record SMS dispatch to activate 120s phone cooldown and hourly IP counter
    const clientIp = getClientIp(req);
    recordSmsDispatch(cleanPhone, clientIp);

    res.json({ success: true, count: userCount, message: 'کد تایید ارسال شد' });
  } catch (error) {
    console.error('Verify phone error:', error);
    res.status(500).json({ error: 'خطایی در بررسی شماره رخ داد' });
  }
}

export const sendOtp = verifyPhone;
export const requestOtp = verifyPhone;

export async function login(req: Request, res: Response) {
  try {
    let { phoneNumber, password, role } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'شماره تلفن الزامی است' });
    }

    const cleanPhone = normalizePhone(phoneNumber);
    const rawPassword = password ? password.toString().trim() : '';
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    
    const blacklistedIp = await prisma.blacklist.findUnique({ where: { value: clientIp } });
    if (blacklistedIp) {
      return res.status(403).json({ error: 'دسترسی مسدود شده است (IP Blocked)' });
    }

    let user = await prisma.user.findFirst({
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

    // Hourly login limit check: max 200 logins per hour per individual
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const hourlyLogins = await prisma.auditLog.count({
      where: {
        actorId: user.id,
        action: 'USER_LOGIN',
        createdAt: { gte: oneHourAgo }
      }
    });

    if (hourlyLogins >= 200) {
      return res.status(429).json({
        error: 'شما به سقف مجاز ورود رسیده‌اید. لطفاً پس از گذشت مدتی مجدداً تلاش کنید.'
      });
    }

    // Password verification: bcrypt only. There is no universal/master password.
    let isPasswordCorrect = false;
    if (rawPassword && user.passwordHash) {
      isPasswordCorrect = await passwordMatches(user.passwordHash, rawPassword);
    }

    if (!isPasswordCorrect) {
      const updatedAttempts = user.failedLoginAttempts + 1;
      if (updatedAttempts >= 15) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lockoutUntil: new Date(Date.now() + 60 * 60 * 1000)
          }
        });
        return res.status(429).json({ error: 'حساب کاربری شما به دلیل تلاشهای ناموفق بیش از حد به مدت ۱ ساعت قفل شده است' });
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: updatedAttempts }
        });
      }
      return res.status(401).json({ error: 'رمز عبور وارد شده نادرست است' });
    }

    // Reset attempts on success
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockoutUntil: null, lastActiveTimestamp: new Date() }
    });

    // Record login for individual hourly tracking
    const fromApp = isAppClient(req.headers);
    if (fromApp) { logLiveEvent(user.id, 'login'); logUserEvent(user.id, { type: 'login', label: 'وارد حساب شد (لاگین)' }); }
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorName: user.name || 'کاربر',
        actorRole: user.role || 'student',
        action: 'USER_LOGIN',
        targetEntity: 'User',
        targetEntityId: user.id,
        // [اپ] / [پنل]: the «آمار» tab counts only sign-ins to the mobile app
        details: `ورود موفق کاربر به سامانه (لاگین ${hourlyLogins + 1} در این ساعت) ${fromApp ? '[اپ]' : '[پنل]'}`,
        ipAddress: clientIp
      }
    });

    const secret = getJwtSecret();
    const refreshSecret = getJwtRefreshSecret();
    const expiresInSeconds = 30 * 24 * 60 * 60; // 30 days
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    const token = jwt.sign(
      { 
        id: user.id, 
        role: user.role, 
        phoneNumber: user.phoneNumber, 
        tokenVersion: user.tokenVersion, 
        identityVerified: true, 
        name: user.name,
        nonce: `${Date.now()}_${Math.random().toString(36).substring(2)}`
      },
      secret,
      { expiresIn: (process.env.JWT_EXPIRATION || '30d') as any }
    );

    const refreshToken = jwt.sign(
      {
        id: user.id,
        tokenVersion: user.tokenVersion,
        type: 'refresh'
      },
      refreshSecret,
      { expiresIn: '90d' }
    );

    // Multi-Device Session Management
    const activeSessions = await prisma.userSession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' }
    });

    if (activeSessions.length >= 15) {
      await prisma.userSession.delete({
        where: { id: activeSessions[0].id }
      });
    }

    await prisma.userSession.create({
      data: {
        userId: user.id,
        token,
        deviceInfo: req.headers['user-agent'] || null
      }
    });

    res.status(200).json({
      token,
      accessToken: token,
      refreshToken,
      expiresIn: expiresInSeconds,
      expiresAt,
      user: {
        id: user.id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        role: user.role,
        caravanId: user.caravanId,
        identityVerified: true,
        isDualRole: Boolean(user.isDualRole || user.role === 'admin')
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'خطایی در ورود به سیستم رخ داد' });
  }
}

export async function register(req: Request, res: Response) {
  try {
    const { fullName, phoneNumber, countryCode, city, dateOfBirth, password } = req.body;

    if (!phoneNumber || !fullName || !password) {
      return res.status(400).json({ error: 'اطلاعات وارد شده ناقص است' });
    }
    if (typeof fullName !== 'string' || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'نام یا گذرواژه نامعتبر است (گذرواژه حداقل ۶ کاراکتر)' });
    }

    let countryPrefix = String(countryCode || '+98').trim();
    if (!countryPrefix.startsWith('+')) {
      countryPrefix = '+' + countryPrefix;
    }
    if (!/^\+\d{1,4}$/.test(countryPrefix)) {
      return res.status(400).json({ error: 'کد کشور نامعتبر است' });
    }

    // Iranian numbers are stored in the same 09xxxxxxxxx format that login() looks up.
    // Other countries keep "<+code><national number>".
    let normalizedPhoneNumber: string;
    let phoneCandidates: string[];
    if (countryPrefix === '+98') {
      normalizedPhoneNumber = normalizePhone(phoneNumber);
      if (!/^09\d{9}$/.test(normalizedPhoneNumber)) {
        return res.status(400).json({ error: 'شماره همراه نامعتبر است' });
      }
      // '+98...' is the legacy format written by the old register endpoint
      phoneCandidates = [normalizedPhoneNumber, '+98' + normalizedPhoneNumber.slice(1)];
    } else {
      let national = phoneNumber.toString().replace(/\D/g, '').replace(/^0+/, '');
      const countryDigits = countryPrefix.slice(1);
      if (national.startsWith(countryDigits) && national.length > 10) {
        national = national.slice(countryDigits.length);
      }
      if (national.length < 6 || national.length > 14) {
        return res.status(400).json({ error: 'شماره همراه نامعتبر است' });
      }
      normalizedPhoneNumber = `${countryPrefix}${national}`;
      phoneCandidates = [normalizedPhoneNumber];
    }

    // SECURITY: registration must never take over an existing account. Without a verified
    // OTP, proving ownership of a phone number is impossible, so an exact match on an
    // existing number is always rejected (no endsWith matching, no password overwrite).
    const existingUser = await prisma.user.findFirst({
      where: { phoneNumber: { in: phoneCandidates } }
    });
    if (existingUser) {
      return res.status(409).json({
        error: 'این شماره قبلاً در سامانه ثبت شده است. با گذرواژه خود وارد شوید یا با مدیریت تماس بگیرید'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const maxUser = await prisma.user.findFirst({
      orderBy: { userCode: 'desc' },
      where: { userCode: { not: null } }
    });
    const nextUserCode = maxUser && maxUser.userCode ? maxUser.userCode + 1 : 110100;

    const activeUser = await prisma.user.create({
      data: {
        name: fullName,
        phoneNumber: normalizedPhoneNumber,
        countryCode: countryPrefix,
        city: city || null,
        dateOfBirth: dateOfBirth || null,
        passwordHash,
        registrationCompleted: true,
        role: 'student',
        zarikBalance: 0,
        identityVerified: true,
        userCode: nextUserCode
      }
    });

    // Generate token and session
    const secret = getJwtSecret();
    const refreshSecret = getJwtRefreshSecret();
    const expiresInSeconds = 30 * 24 * 60 * 60; // 30 days
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    const token = jwt.sign(
      { 
        id: activeUser.id, 
        role: activeUser.role, 
        phoneNumber: activeUser.phoneNumber, 
        tokenVersion: activeUser.tokenVersion, 
        identityVerified: true, 
        name: activeUser.name,
        nonce: `${Date.now()}_${Math.random().toString(36).substring(2)}`
      },
      secret,
      { expiresIn: (process.env.JWT_EXPIRATION || '30d') as any }
    );

    const refreshToken = jwt.sign(
      {
        id: activeUser.id,
        tokenVersion: activeUser.tokenVersion,
        type: 'refresh'
      },
      refreshSecret,
      { expiresIn: '90d' }
    );

    const activeSessions = await prisma.userSession.findMany({
      where: { userId: activeUser.id },
      orderBy: { createdAt: 'asc' }
    });

    if (activeSessions.length >= 15) {
      await prisma.userSession.delete({
        where: { id: activeSessions[0].id }
      });
    }

    await prisma.userSession.create({
      data: {
        userId: activeUser.id,
        token,
        deviceInfo: req.headers['user-agent'] || null
      }
    });

    res.status(200).json({
      token,
      accessToken: token,
      refreshToken,
      expiresIn: expiresInSeconds,
      expiresAt,
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
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'خطایی در ثبت‌نام رخ داد' });
  }
}

export async function refreshToken(req: Request, res: Response) {
  try {
    const rawRefreshToken = req.body.refreshToken || req.body.refresh_token || req.headers['x-refresh-token'];
    if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const secret = getJwtSecret();
    const refreshSecret = getJwtRefreshSecret();

    let decoded: any;
    try {
      decoded = jwt.verify(rawRefreshToken, refreshSecret);
    } catch (err) {
      // Fallback verification if signed with primary secret
      try {
        decoded = jwt.verify(rawRefreshToken, secret);
      } catch (e2) {
        return res.status(401).json({ error: 'Refresh token is invalid or expired' });
      }
    }

    if (!decoded || !decoded.id) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id }
    });

    if (!user || user.isDeleted || user.blocked || user.accountStatus === 'SUSPENDED') {
      return res.status(401).json({ error: 'User account is inactive, suspended, or not found' });
    }

    if (decoded.tokenVersion !== undefined && user.tokenVersion !== decoded.tokenVersion) {
      return res.status(401).json({ error: 'Token version revoked. Please log in again.' });
    }

    const expiresInSeconds = 30 * 24 * 60 * 60; // 30 days
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    const newAccessToken = jwt.sign(
      {
        id: user.id,
        role: user.role,
        phoneNumber: user.phoneNumber,
        tokenVersion: user.tokenVersion,
        identityVerified: true,
        name: user.name,
        nonce: `${Date.now()}_${Math.random().toString(36).substring(2)}`
      },
      secret,
      { expiresIn: (process.env.JWT_EXPIRATION || '30d') as any }
    );

    const newRefreshToken = jwt.sign(
      {
        id: user.id,
        tokenVersion: user.tokenVersion,
        type: 'refresh'
      },
      refreshSecret,
      { expiresIn: '90d' }
    );

    // Track active session
    await prisma.userSession.create({
      data: {
        userId: user.id,
        token: newAccessToken,
        deviceInfo: req.headers['user-agent'] || null
      }
    }).catch(() => {});

    res.status(200).json({
      success: true,
      token: newAccessToken,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: expiresInSeconds,
      expiresAt,
      user: {
        id: user.id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        role: user.role,
        caravanId: user.caravanId,
        identityVerified: true,
        isDualRole: Boolean(user.isDualRole || user.role === 'admin')
      }
    });
  } catch (error) {
    console.error('Silent refresh error:', error);
    res.status(500).json({ error: 'Internal server error during silent token refresh' });
  }
}

export async function logout(req: AuthRequest, res: Response) {
  try {
    if (req.user && isAppClient(req.headers)) {
      logLiveEvent(req.user.id, 'logout');
      markAppAway(req.user.id);
      logUserEvent(req.user.id, { type: 'logout', label: 'از حساب خارج شد' });
    }
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      await prisma.userSession.deleteMany({
        where: { token }
      });
    }
    res.status(200).json({ success: true, message: 'خروج با موفقیت انجام شد' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'خطایی در خروج رخ داد' });
  }
}

// One-time codes for changing the password when the user forgot the old one (in memory, like the SMS cooldowns)
const passwordResetCodes = new Map<string, { code: string; expires: number; attempts: number }>();

// Sends a code by SMS to the logged-in user's own phone number.
export async function requestPasswordResetCode(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: 'کاربر احراز هویت نشده است' });
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !user.phoneNumber) return res.status(404).json({ error: 'کاربر یافت نشد' });

    const code = String(Math.floor(10000 + Math.random() * 90000));
    passwordResetCodes.set(user.id, { code, expires: Date.now() + 5 * 60 * 1000, attempts: 0 });
    recordSmsDispatch(user.phoneNumber, getClientIp(req));
    // Mock SMS provider (same as notificationController until a real provider is connected)
    console.log(`[SMS MOCK] Sending password code to ${user.phoneNumber}: ${code}`);

    res.json({ success: true, message: 'کد تایید برای شما پیامک شد' });
  } catch (error) {
    console.error('requestPasswordResetCode error:', error);
    res.status(500).json({ error: 'ارسال پیامک انجام نشد' });
  }
}

// Checks the user's current password (step 1 of changing it when it is remembered).
export async function verifyCurrentPassword(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: 'کاربر احراز هویت نشده است' });
    const { currentPassword } = req.body || {};
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'کاربر یافت نشد' });
    const ok = await passwordMatches(user.passwordHash, String(currentPassword ?? '').trim());
    if (!ok) return res.status(401).json({ error: 'رمز عبور فعلی نادرست است' });
    res.json({ success: true });
  } catch (error) {
    console.error('verifyCurrentPassword error:', error);
    res.status(500).json({ error: 'بررسی رمز عبور انجام نشد' });
  }
}

export async function changePassword(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'کاربر احراز هویت نشده است' });
    }

    const { currentPassword, newPassword, smsCode } = req.body;
    if (!newPassword || newPassword.trim().length < 4) {
      return res.status(400).json({ error: 'رمز عبور جدید باید حداقل ۴ رقم یا کاراکتر باشد' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ error: 'کاربر یافت نشد' });
    }

    // Forgot the old password: the code sent by SMS must match
    if (smsCode !== undefined && smsCode !== null && String(smsCode).trim() !== '') {
      const entry = passwordResetCodes.get(user.id);
      if (!entry || entry.expires < Date.now()) {
        passwordResetCodes.delete(user.id);
        return res.status(400).json({ error: 'کد تایید منقضی شده است. دوباره درخواست دهید' });
      }
      if (entry.code !== String(smsCode).trim()) {
        entry.attempts += 1;
        if (entry.attempts >= 5) passwordResetCodes.delete(user.id);
        return res.status(400).json({ error: 'کد تایید نادرست است' });
      }
      passwordResetCodes.delete(user.id);
    }

    if (currentPassword && currentPassword.trim().length > 0 && user.passwordHash) {
      const currentMatch = await passwordMatches(user.passwordHash, String(currentPassword).trim());
      if (!currentMatch) {
        const isDefault = await bcrypt.compare('123456', user.passwordHash);
        if (!isDefault) {
          return res.status(401).json({ error: 'رمز عبور فعلی وارد شده معتبر نیست' });
        }
      }
    }

    // Stored with English digits; login accepts Persian digits too
    const newHash = await bcrypt.hash(toEnglishDigits(newPassword.trim()), 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash }
    });

    res.json({ success: true, message: 'رمز عبور ثابت ورود به پنل با موفقیت ذخیره شد' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'خطا در ذخیره‌سازی رمز عبور رخ داد' });
  }
}
