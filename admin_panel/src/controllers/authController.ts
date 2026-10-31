import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { recordSmsDispatch, getClientIp } from '../middleware/smsProtection';
import { getJwtSecret, getJwtRefreshSecret } from '../config/secrets';
import { canEnterPanel } from '../utils/access';
import { PANEL_DENIED_MESSAGE } from '../middleware/adminAccess';

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
      isPasswordCorrect = await bcrypt.compare(rawPassword, user.passwordHash);
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

    // The admin panel signs in with panel:true. The mobile app does not, so its login is unaffected.
    // Checked after the password so only the real owner of the account learns the reason.
    if (req.body?.panel === true) {
      const allowed = await canEnterPanel(user.role, (user as any).panelAccess);
      if (!allowed) {
        return res.status(403).json({ error: PANEL_DENIED_MESSAGE });
      }
    }

    // Reset attempts on success
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockoutUntil: null, lastActiveTimestamp: new Date() }
    });

    // Record login for individual hourly tracking
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorName: user.name || 'کاربر',
        actorRole: user.role || 'student',
        action: 'USER_LOGIN',
        targetEntity: 'User',
        targetEntityId: user.id,
        details: `ورود موفق کاربر به سامانه (لاگین ${hourlyLogins + 1} در این ساعت)`,
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

export async function changePassword(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'کاربر احراز هویت نشده است' });
    }

    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.trim().length < 4) {
      return res.status(400).json({ error: 'رمز عبور جدید باید حداقل ۴ رقم یا کاراکتر باشد' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ error: 'کاربر یافت نشد' });
    }

    if (currentPassword && currentPassword.trim().length > 0 && user.passwordHash) {
      const currentMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!currentMatch) {
        const isDefault = await bcrypt.compare('123456', user.passwordHash);
        if (!isDefault) {
          return res.status(401).json({ error: 'رمز عبور فعلی وارد شده معتبر نیست' });
        }
      }
    }

    const newHash = await bcrypt.hash(newPassword.trim(), 10);
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