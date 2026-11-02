import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/db';
import { canUseChat, getChatSettings } from '../services/chatSettings';
import { changeBalance } from '../services/ledger';
import { STUDENT_AVATARS, isMentorRole } from '../utils/avatar';

/**
 * Number of leading stations (in station order) the user has completed: every video clip of the station is
 * watched or its quiz passed. A station without clips (e.g. only a gallery) counts as completed, so it never
 * blocks the next one. The app opens station i only when i <= this count.
 */
async function countCompletedStations(userId: string): Promise<number> {
  const stations = await prisma.station.findMany({
    orderBy: { orderIndex: 'asc' },
    select: {
      categories: { select: { sessions: { where: { isDeleted: false }, select: { videoClips: { select: { id: true } } } } } }
    }
  });
  const done = await prisma.userProgress.findMany({
    where: { userId, OR: [{ isWatched: true }, { quizPassed: true }] },
    select: { clipId: true }
  });
  const doneIds = new Set(done.map(d => d.clipId));
  let count = 0;
  for (const st of stations) {
    const clipIds = st.categories.flatMap(c => c.sessions.flatMap(s => s.videoClips.map(v => v.id)));
    if (clipIds.every(id => doneIds.has(id))) count++;
    else break;
  }
  return count;
}

export async function getMe(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'کاربر احراز هویت نشده است' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        caravan: {
          include: { 
            mentor: { select: { id: true, name: true, phoneNumber: true, socialMessengerHandle: true, socialPlatform: true } },
            members: { select: { id: true, name: true } }
          }
        },
        mentoredCaravans: {
          include: { members: { select: { id: true, name: true } } }
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

    // Completed sessions (kept for the profile) and the real number of completed stations
    const completedSessionsCount = await prisma.sessionWatchRecord.count({
      where: { userId: user.id, watchedPercentage: { gte: 70 } }
    });
    const completedStationsCount = await countCompletedStations(user.id);

    const isDualRole = Boolean(user.isDualRole || user.role === 'admin');
    let managedMembersCount = 0;
    let satisfactionScore = 0;
    let assignedCaravan = null;

    if (user.role === 'mentor' || user.role === 'SUPER_MENTOR' || isDualRole) {
      if (user.mentoredCaravans && user.mentoredCaravans.length > 0) {
        assignedCaravan = user.mentoredCaravans[0];
      } else if (user.role === 'admin') {
        assignedCaravan = await prisma.caravan.findFirst({
          where: { isDeleted: false },
          include: { 
            members: { select: { id: true, name: true } },
            mentor: { select: { id: true, name: true, phoneNumber: true, socialMessengerHandle: true, socialPlatform: true } }
          }
        });
      }
      managedMembersCount = assignedCaravan?.members?.length || 0;
      
      const totalRatings = user.ratingsReceived?.length || 0;
      const totalEvaluations = user.evaluationsReceived?.length || 0;
      
      const sumRatings = user.ratingsReceived?.reduce((acc, r) => acc + r.ratingValue, 0) || 0;
      const sumEvals = user.evaluationsReceived?.reduce((acc, e) => acc + e.rating, 0) || 0;
      
      const combinedCount = totalRatings + totalEvaluations;
      satisfactionScore = combinedCount > 0 ? (sumRatings + sumEvals) / combinedCount : 0;
    }

    const caravanMembersList = assignedCaravan 
      ? (assignedCaravan.members?.map((m: any) => ({ id: m.id, name: m.name })) || [])
      : (user.caravan?.members?.map((m: any) => ({ id: m.id, name: m.name })) || []);

    // The mentor a user reaches out to: the caravan's mentor for students, themselves for mentors
    const contactMentor: any = assignedCaravan
      ? ((assignedCaravan as any).mentor || user)
      : user.caravan?.mentor;

    const chatSettings = await getChatSettings();

    res.json({
      id: user.id,
      name: user.name,
      phoneNumber: user.phoneNumber,
      userCode: user.userCode,
      role: user.role,
      isDualRole,
      features: { chat: canUseChat(user, chatSettings) },
      caravanId: assignedCaravan ? assignedCaravan.id : user.caravanId,
      caravanName: assignedCaravan ? assignedCaravan.name : (user.caravan?.name || 'فاقد کاروان'),
      caravanMentor: assignedCaravan ? ((assignedCaravan as any).mentor?.name || user.name) : (user.caravan?.mentor?.name || 'تعیین نشده'),
      mentorPhone: assignedCaravan ? ((assignedCaravan as any).mentor?.phoneNumber || user.phoneNumber) : (user.caravan?.mentor?.phoneNumber || ''),
      mentorSocialPlatform: contactMentor?.socialPlatform || '',
      mentorSocialHandle: contactMentor?.socialMessengerHandle || '',
      socialGroupLink: assignedCaravan ? assignedCaravan.socialGroupLink : (user.caravan?.socialGroupLink || ''),
      managedMembersCount,
      satisfactionScore: parseFloat(satisfactionScore.toFixed(1)),
      completedSessionsCount,
      completedStationsCount,
      zarikBalance: user.zarikBalance,
      nakh: user.nakh,
      beyragh: user.beyragh,
      farsh: user.farsh,
      levelFrame: user.levelFrame,
      identityVerified: user.identityVerified,
      avatarUrl: user.avatarUrl,
      gender: user.gender,
      hasEvaluatedMentorThisSeason: user.hasEvaluatedMentorThisSeason,
      nationalId: user.nationalId,
      dateOfBirth: user.dateOfBirth,
      email: user.email,
      city: user.city,
      mentorDocuments: user.mentorDocuments,
      certificates: user.certificates,
      caravanMembers: caravanMembersList
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

    const existingReward = await prisma.zarikTransaction.findFirst({
      where: {
        userId: user.id,
        reason: { contains: 'تکمیل پروفایل' }
      }
    });

    const isEligibleForReward = !existingReward && Boolean(req.body?.nationalId && String(req.body.nationalId).trim());
    let rewardAmount = isEligibleForReward ? 100 : 0;

    // Every field that was sent is saved (an empty value clears it); fields that were not sent stay untouched.
    const pick = (key: string, current: string | null): string | null => {
      const v = req.body?.[key];
      if (v === undefined || v === null) return current;
      const t = String(v).trim();
      return t === '' ? null : t;
    };

    const isMentorAccount = user.role === 'mentor' || user.role === 'SUPER_MENTOR' || user.role === 'admin';
    const newName = req.body?.name !== undefined ? String(req.body.name).trim() : user.name;
    if (!newName) return res.status(400).json({ error: 'نام الزامی است' });

    const nationalId = pick('nationalId', user.nationalId);
    const email = pick('email', user.email);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return res.status(400).json({ error: 'آدرس ایمیل نامعتبر است' });
    }
    const updateData: any = {
      name: newName,
      nationalId,
      dateOfBirth: pick('dateOfBirth', user.dateOfBirth),
      email,
      city: pick('city', user.city),
      identityVerified: Boolean(nationalId),
    };

    if (isMentorAccount) {
      updateData.academicDegree = pick('academicDegree', user.academicDegree);
      updateData.bio = pick('bio', user.bio);
      if (!user.identityVerified && nationalId && user.role !== 'admin') {
        updateData.mentorLevel = { increment: 1 };
      }
    } else if (user.role !== 'student') {
      return res.status(400).json({ error: 'نقش کاربری نامعتبر' });
    }

    let updatedUser: any;
    await prisma.$transaction(async (tx) => {
      updatedUser = await tx.user.update({
        where: { id: user.id },
        data: updateData
      });

      if (isEligibleForReward) {
        await changeBalance(tx, {
          userId: user.id,
          asset: 'zarik',
          amount: rewardAmount,
          sourceType: 'profile_completion',
          sourceId: user.id,
          reason: 'پاداش تکمیل پروفایل',
          createdBy: 'SYSTEM',
          zarikCategory: 'Profile Completion'
        });
        updatedUser = await tx.user.findUnique({ where: { id: user.id } });

        // Clean up prompt notifications
        await tx.notification.deleteMany({
          where: {
            userId: user.id,
            type: 'profile_completion'
          }
        });

        // Create success notification
        await tx.notification.create({
          data: {
            userId: user.id,
            title: 'پاداش تکمیل پروفایل واریز شد',
            message: 'مشخصات شما با موفقیت ثبت شد و ۱۰۰ زریک به کیف پول شما افزوده گردید.',
            type: 'reward'
          }
        });
      }
    });

    return res.json({
      success: true,
      rewardZarik: rewardAmount,
      zarikBalance: updatedUser.zarikBalance,
      message: isEligibleForReward
        ? 'پروفایل با موفقیت تایید شد و ۱۰۰ زریک هدیه دریافت کردید!'
        : 'پروفایل با موفقیت بروزرسانی شد'
    });
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
      avatarUrl: mentor.avatarUrl || '/uploads/avatars/default.png',
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


/**
 * PATCH /users/me/avatar { avatarKey } – a student picks one of the bundled pictures of the gender that the admin
 * panel set for them. Mentors cannot choose: they always have the mentor picture of their gender.
 */
export async function updateMyAvatar(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: 'کاربر احراز هویت نشده است' });
    const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { role: true, gender: true } });
    if (!me) return res.status(404).json({ error: 'کاربر یافت نشد' });
    if (me.gender !== 'male' && me.gender !== 'female') {
      return res.status(400).json({ error: 'جنسیت شما هنوز توسط مدیریت ثبت نشده است' });
    }
    if (isMentorRole(me.role)) {
      return res.status(403).json({ error: 'تصویر راهبر بر اساس جنسیت تعیین می‌شود' });
    }
    const key = String(req.body?.avatarKey || '');
    if (!STUDENT_AVATARS[me.gender].includes(key)) {
      return res.status(400).json({ error: 'آواتار نامعتبر است' });
    }
    const avatarUrl = `asset:${key}`;
    await prisma.user.update({ where: { id: req.user.id }, data: { avatarUrl } });
    res.json({ gender: me.gender, avatarUrl });
  } catch (error) {
    console.error('updateMyAvatar error:', error);
    res.status(500).json({ error: 'خطا در ذخیره آواتار' });
  }
}
