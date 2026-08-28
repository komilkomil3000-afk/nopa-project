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
      include: {
        caravan: {
          include: { mentor: { select: { id: true, name: true, phoneNumber: true } } }
        },
        mentoredCaravans: {
          include: { members: true }
        },
        ratingsReceived: true,
        evaluationsReceived: true,
        sessionWatchRecords: true,
        quizSubmissions: true,
        mentorDocuments: true,
        certificates: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'کاربر یافت نشد' });
    }

    // Calculate real station progress dynamically
    const completedStationsCount = await prisma.sessionWatchRecord.count({
      where: { userId: user.id, watchedPercentage: { gte: 70 } }
    });

    let managedMembersCount = 0;
    let satisfactionScore = 0;
    let assignedCaravan = null;

    if (user.role === 'mentor' || user.role === 'SUPER_MENTOR') {
      assignedCaravan = user.mentoredCaravans && user.mentoredCaravans.length > 0 ? user.mentoredCaravans[0] : null;
      managedMembersCount = assignedCaravan?.members?.length || 0;
      
      const totalRatings = user.ratingsReceived?.length || 0;
      const totalEvaluations = user.evaluationsReceived?.length || 0;
      
      const sumRatings = user.ratingsReceived?.reduce((acc, r) => acc + r.ratingValue, 0) || 0;
      const sumEvals = user.evaluationsReceived?.reduce((acc, e) => acc + e.rating, 0) || 0;
      
      const combinedCount = totalRatings + totalEvaluations;
      satisfactionScore = combinedCount > 0 ? (sumRatings + sumEvals) / combinedCount : 0;
    }

    res.json({
      id: user.id,
      name: user.name,
      phoneNumber: user.phoneNumber,
      userCode: user.userCode,
      role: user.role,
      caravanId: assignedCaravan ? assignedCaravan.id : user.caravanId,
      caravanName: assignedCaravan ? assignedCaravan.name : (user.caravan?.name || 'فاقد کاروان'),
      caravanMentor: assignedCaravan ? user.name : (user.caravan?.mentor?.name || 'تعیین نشده'),
      mentorPhone: assignedCaravan ? user.phoneNumber : (user.caravan?.mentor?.phoneNumber || ''),
      socialGroupLink: assignedCaravan ? assignedCaravan.socialGroupLink : (user.caravan?.socialGroupLink || ''),
      managedMembersCount,
      satisfactionScore: parseFloat(satisfactionScore.toFixed(1)),
      completedStationsCount: Math.floor(completedStationsCount / 4), // 4 sessions per station baseline
      zarikBalance: user.zarikBalance,
      nakh: user.nakh,
      beyragh: user.beyragh,
      farsh: user.farsh,
      levelFrame: user.levelFrame,
      identityVerified: user.identityVerified,
      avatarUrl: user.avatarUrl,
      hasEvaluatedMentorThisSeason: user.hasEvaluatedMentorThisSeason,
      nationalId: user.nationalId,
      dateOfBirth: user.dateOfBirth,
      city: user.city,
      mentorDocuments: user.mentorDocuments,
      certificates: user.certificates
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

    const isFirstTime = !user.identityVerified;

    if (user.role === 'student') {
      const { nationalId, name, city, dateOfBirth } = req.body;
      if (!nationalId || !name) return res.status(400).json({ error: 'نام و کد ملی الزامی است' });

      const updateData: any = {
        name,
        nationalId,
        dateOfBirth,
        identityVerified: true,
      };

      if (isFirstTime) {
        updateData.zarikBalance = { increment: 200 };
      }

      await prisma.user.update({
        where: { id: user.id },
        data: updateData
      });
      return res.json({ success: true, message: isFirstTime ? 'پروفایل تایید شد و 200 زریک پاداش گرفتید' : 'پروفایل با موفقیت بروزرسانی شد' });
    } else if (user.role === 'mentor') {
      const { nationalId, dateOfBirth, city, academicDegree, bio } = req.body;
      const updateData: any = {
        nationalId,
        dateOfBirth,
        city,
        academicDegree,
        bio,
        identityVerified: true,
      };

      if (isFirstTime) {
        updateData.mentorLevel = { increment: 1 };
        updateData.zarikBalance = { increment: 500 };
      }

      await prisma.user.update({
        where: { id: user.id },
        data: updateData
      });
      return res.json({ success: true, message: isFirstTime ? 'پروفایل راهبر تایید شد و 500 زریک دریافت کردید' : 'پروفایل با موفقیت بروزرسانی شد' });
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

