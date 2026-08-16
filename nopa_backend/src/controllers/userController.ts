import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/db';

export async function getMe(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'کاربر احراز هویت نشده است' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { caravan: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'کاربر یافت نشد' });
    }

    res.json({
      id: user.id,
      name: user.name,
      phoneNumber: user.phoneNumber,
      role: user.role,
      zarikBalance: user.zarikBalance,
      levelFrame: user.levelFrame,
      caravanId: user.caravanId,
      avatarUrl: user.avatarUrl,
      hasEvaluatedMentorThisSeason: user.hasEvaluatedMentorThisSeason,
      identityVerified: user.identityVerified,
      socialGroupLink: user.caravan?.socialGroupLink,
      userCode: user.userCode
    });
  } catch (error) {
    console.error('getMe error:', error);
    res.status(500).json({ error: 'خطایی در دریافت اطلاعات کاربر رخ داد' });
  }
}

export async function completeProfile(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'کاربر احراز هویت نشده است' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'کاربر یافت نشد' });

    if (user.identityVerified) {
      return res.status(400).json({ error: 'پروفایل شما قبلا تکمیل شده است' });
    }

    if (user.role === 'student') {
      const { nationalId, name, city, dateOfBirth } = req.body;
      if (!nationalId || !name) return res.status(400).json({ error: 'نام و کد ملی الزامی است' });

      await prisma.user.update({
        where: { id: user.id },
        data: {
          name,
          nationalId,
          dateOfBirth,
          identityVerified: true,
          zarikBalance: { increment: 200 }
        }
      });
      return res.json({ success: true, message: 'پروفایل تایید شد و 200 زریک پاداش گرفتید' });
    } else if (user.role === 'mentor') {
      const { nationalId, dateOfBirth, city, academicDegree, bio } = req.body;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          nationalId,
          dateOfBirth,
          city,
          academicDegree,
          bio,
          identityVerified: true,
          mentorLevel: { increment: 1 },
          zarikBalance: { increment: 500 }
        }
      });
      return res.json({ success: true, message: 'پروفایل راهبر تایید شد و 500 زریک دریافت کردید' });
    }

    res.status(400).json({ error: 'نقش کاربری نامعتبر' });
  } catch (error) {
    console.error('completeProfile error:', error);
    res.status(500).json({ error: 'خطا در تکمیل پروفایل' });
  }
}

export async function getMentorById(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const mentor = await prisma.user.findFirst({
      where: { id, role: 'mentor' }
    });

    if (!mentor) {
      return res.status(404).json({ error: 'راهبر مورد نظر یافت نشد' });
    }

    // Aggregate rating statistics
    const ratings = await prisma.mentorRating.findMany({
      where: { mentorId: id }
    });

    const totalRatings = ratings.length;
    const avgRating = totalRatings > 0 
      ? ratings.reduce((sum, r) => sum + r.ratingValue, 0) / totalRatings 
      : 4.8; // Default initial mock value

    const caravansCount = await prisma.caravan.count({
      where: { mentorId: id }
    });

    const membersCount = await prisma.user.count({
      where: { caravan: { mentorId: id } }
    });

    res.json({
      id: mentor.id,
      name: mentor.name,
      avatarUrl: mentor.avatarUrl || 'http://127.0.0.1:5000/uploads/avatars/default.png',
      rating: parseFloat(avgRating.toFixed(1)),
      caravansCount,
      membersCount,
      bio: 'راهبر ارشد سرزمین نپا، مربی تفکر خلاق و سواد رسانه‌ای نوجوانان.',
      certificates: [
        'گواهی عالی مربیگری تربیتی نپا',
        'گواهی تخصصی رسانه و تولید محتوا',
        'گواهی شایستگی مدیریت کاروان نپا'
      ]
    });
  } catch (error) {
    console.error('getMentorById error:', error);
    res.status(500).json({ error: 'خطایی در دریافت اطلاعات راهبر رخ داد' });
  }
}

