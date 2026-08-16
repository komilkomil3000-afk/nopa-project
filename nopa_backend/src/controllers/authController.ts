import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/auth';

const UNIVERSAL_SUPER_ADMIN_PHONE = '09380346668';

export async function verifyPhone(req: Request, res: Response) {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ error: 'شماره تلفن الزامی است' });
    }
    const userCount = await prisma.user.count({ where: { phoneNumber } });
    if (userCount === 0) {
      return res.status(404).json({ error: 'شماره شما در سامانه ثبت نشده است. لطفا با مدیریت تماس بگیرید' });
    }
    res.json({ success: true, count: userCount });
  } catch (error) {
    console.error('Verify phone error:', error);
    res.status(500).json({ error: 'خطایی در بررسی شماره رخ داد' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    let { phoneNumber, password, role } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'شماره تلفن الزامی است' });
    }
    
    const numericPhone = phoneNumber.toString().replace(/\D/g, '');
    const corePhone = numericPhone.length >= 10 ? numericPhone.slice(-10) : numericPhone;

    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    
    const blacklistedIp = await prisma.blacklist.findUnique({ where: { value: clientIp } });
    if (blacklistedIp) {
      return res.status(403).json({ error: 'دسترسی مسدود شده است (IP Blocked)' });
    }

    const users = await prisma.user.findMany({
      where: { phoneNumber: { endsWith: corePhone } }
    });

    if (users.length === 0) {
      return res.status(404).json({ error: 'شماره همراه در سیستم ثبت نشده است' });
    }
    
    if (users.length > 1 && !role) {
      return res.status(300).json({
        status: 'multiple_profiles',
        profiles: users.map(u => ({ id: u.id, name: u.name, role: u.role }))
      });
    }

    let user = users[0];
    if (role) {
      const matchedUser = users.find(u => u.role.toLowerCase() === role.toLowerCase());
      if (matchedUser) {
        user = matchedUser;
      } else {
        return res.status(403).json({ error: 'حساب کاربری با این نقش برای شما یافت نشد' });
      }
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

    // Password verification (Bcrypt check vs '123456' test bypass)
    let isPasswordCorrect = false;
    if (password === '123456') {
      isPasswordCorrect = true;
    } else if (password) {
      isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);
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
      data: { failedLoginAttempts: 0, lockoutUntil: null }
    });

    const secret = process.env.JWT_SECRET || 'nopa_super_secret_jwt_key_2026';
    const token = jwt.sign(
      { id: user.id, role: user.role, phoneNumber: user.phoneNumber, tokenVersion: user.tokenVersion, identityVerified: true, name: user.name },
      secret,
      { expiresIn: (process.env.JWT_EXPIRATION || '30d') as any }
    );

    // Multi-Device Session Management (Item 10)
    const activeSessions = await prisma.userSession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' }
    });

    if (activeSessions.length >= 3) {
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
      user: {
        id: user.id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        role: user.role,
        zarikBalance: user.zarikBalance,
        levelFrame: user.levelFrame,
        caravanId: user.caravanId,
        identityVerified: true,
        userCode: user.userCode
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
    const existingUser = await prisma.user.findFirst({
      where: { phoneNumber: { endsWith: corePhone } }
    });

    const passwordHash = await bcrypt.hash(password, 10);
    let activeUser;

    const maxUser = await prisma.user.findFirst({
      orderBy: { userCode: 'desc' },
      where: { userCode: { not: null } }
    });
    const nextUserCode = maxUser && maxUser.userCode ? maxUser.userCode + 1 : 110100;

    if (existingUser) {
      // Sync strategy: update profile fields, save hashed password, set registrationCompleted = true, preserve caravan
      activeUser = await prisma.user.update({
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
    } else {
      // Create new student user and award 200 Zarik
      activeUser = await prisma.user.create({
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
      await prisma.zarikTransaction.create({
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
    const token = jwt.sign(
      { id: activeUser.id, role: activeUser.role, phoneNumber: activeUser.phoneNumber, tokenVersion: activeUser.tokenVersion, identityVerified: true, name: activeUser.name },
      secret,
      { expiresIn: (process.env.JWT_EXPIRATION || '30d') as any }
    );

    const activeSessions = await prisma.userSession.findMany({
      where: { userId: activeUser.id },
      orderBy: { createdAt: 'asc' }
    });

    if (activeSessions.length >= 3) {
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
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'رمز عبور فعلی و رمز جدید الزامی است' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ error: 'کاربر یافت نشد' });
    }

    const currentMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!currentMatch) {
      return res.status(401).json({ error: 'رمز عبور فعلی نامعتبر است' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash }
    });

    res.json({ success: true, message: 'رمز عبور با موفقیت تغییر یافت' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'خطا در تغییر رمز عبور رخ داد' });
  }
}
