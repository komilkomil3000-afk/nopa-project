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
    let { phoneNumber, role } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'شماره تلفن الزامی است' });
    }
    
    // 1. Flexible Phone Sanitization
    // Strip all non-numeric characters completely
    const numericPhone = phoneNumber.toString().replace(/\D/g, '');
    
    // Extract exactly the last 10 digits for matching
    const corePhone = numericPhone.length >= 10 ? numericPhone.slice(-10) : numericPhone;

    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    
    // Check IP Blacklist
    const blacklistedIp = await prisma.blacklist.findUnique({ where: { value: clientIp } });
    if (blacklistedIp) {
      return res.status(403).json({ error: 'دسترسی مسدود شده است (IP Blocked)' });
    }

    const users = await prisma.user.findMany({
      where: { phoneNumber: { endsWith: corePhone } }
    });

    if (users.length === 0) {
      console.log(`[LOGIN FAILED] Phone not found. Original: ${phoneNumber} | Searched Core: ${corePhone}`);
      return res.status(404).json({ message: 'شماره همراه در سیستم ثبت نشده است' });
    }
    
    // If multiple profiles exist, pick the first one initially
    let user = users[0];

    // 2. Universal Bypass & Multi-Role Access for Admins
    if (user.role === 'admin' || user.role === 'SUPER_MENTOR') {
      // Admin override: Allow them to assume the role they requested or default to their own role
      console.log(`[LOGIN ADMIN OVERRIDE] Admin logging in. Original Role: ${user.role}, Requested Role: ${role}`);
      if (role) {
        user.role = role; // Override session role for this login
      }
    } else {
      // Normal user: Match by requested role if provided
      if (role) {
        const matchedUser = users.find(u => u.role === role);
        if (matchedUser) {
          user = matchedUser;
        } else {
          return res.status(403).json({ error: 'حساب کاربری با این نقش برای شما یافت نشد' });
        }
      }
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

    // Always verified in this simplified dev mode
    user.identityVerified = true;

    // Reset failed login attempts on success
    if (user.failedLoginAttempts !== 0 || user.lockoutUntil) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockoutUntil: null }
      });
    }

    const secret = process.env.JWT_SECRET || 'nopa_super_secret_jwt_key_2026';
    const token = jwt.sign(
      { id: user.id, role: user.role, phoneNumber: user.phoneNumber, tokenVersion: user.tokenVersion, identityVerified: true, name: user.name },
      secret,
      { expiresIn: (process.env.JWT_EXPIRATION || '30d') as any }
    );

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
        identityVerified: true
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'خطایی در ورود به سیستم رخ داد' });
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
