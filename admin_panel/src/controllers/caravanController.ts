import { Response } from 'express';
import prisma from '../config/db';
import { changeBalance } from '../services/ledger';
import { CapitalAsset, conversionRule, getEconomyPolicy } from '../services/economy';
import { caravanStandings } from '../services/ranking';
import { AuthRequest } from '../middleware/auth';
import { refreshUserRooms } from '../modules/chat/realtime';
import { setCaravanMentor } from '../services/caravanMentor';
import { moveToCaravan } from '../services/caravanMembership';
import { caravanGroupTitle, customCaravanGroupTitle, setCaravanGroupTitle } from '../modules/chat/service';
import { isMentorRole } from '../utils/roles';

// Explicit field list for a caravan's mentor: never return the full User row
// (it contains passwordHash, nationalId, lockout state, ...).
const MENTOR_PUBLIC_SELECT = {
  id: true,
  name: true,
  phoneNumber: true,
  userCode: true,
  role: true,
  avatarUrl: true,
  mentorLevel: true,
  city: true,
  bio: true,
  academicDegree: true,
} as const;
import { logAdminAction } from './adminController';
import { getAssetNames } from '../utils/assetNames';


export async function toggleCaravanStatus(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const caravan = await prisma.caravan.findUnique({ where: { id } });
    if (!caravan) return res.status(404).json({ error: 'کاروان یافت نشد' });
    
    const newStatus = caravan.status === 'active' ? 'suspended' : 'active';
    await prisma.caravan.update({
      where: { id },
      data: { status: newStatus }
    });
    
    await logAdminAction(req.user!.id, 'Admin', 'TOGGLE_CARAVAN_STATUS', 'Caravan', id, `Set status to ${newStatus}`, req.ip || '');
    res.json({ message: `وضعیت کاروان به ${newStatus} تغییر یافت.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function bulkTransferMembers(req: AuthRequest, res: Response) {
  try {
    const { userIds, targetCaravanId } = req.body;
    
    if (!Array.isArray(userIds) || targetCaravanId === undefined) {
      return res.status(400).json({ error: 'لیست کاربران و شناسه کاروان مقصد الزامی است' });
    }
    
    // Assets and progress stay with each person; groups, challenges and chats follow the new caravan
    const result = await moveToCaravan(userIds, targetCaravanId || null);
    await logAdminAction(req.user!.id, 'Admin', 'BULK_TRANSFER', 'Caravan', targetCaravanId || 'UNASSIGNED', `Transferred ${result.moved.length} users`, req.ip || '');
    res.json({
      message: `${result.moved.length} نفر منتقل شدند.` + (result.skippedMentors.length ? ` ${result.skippedMentors.length} راهبر منتقل نشد (راهبر را از «تغییر راهبر» کاروان تعیین کنید).` : ''),
      ...result
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
}

// The exchange rules live in the economy policy (services/economy.ts).
const ASSET_FIELDS: Record<string, CapitalAsset> = { 'زریک': 'zarik', 'نخ': 'nakh', 'فرش': 'farsh', 'کلاف': 'nakh', 'قالیچه': 'farsh', zarik: 'zarik', nakh: 'nakh', farsh: 'farsh' };
const CONVERSION_CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000;

// Students convert their own capital immediately; the caravan mentor is only notified
// and may cancel within CONVERSION_CANCEL_WINDOW_MS (see cancelAssetConversion).
export async function submitStudentAssetConversion(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const { sourceAsset, targetAsset } = req.body;
    const sourceAmount = Number(req.body.sourceAmount);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'کاربر یافت نشد' });
    if (user.role !== 'student') {
      return res.status(403).json({ error: 'تنها دانش‌آموزان می‌توانند سرمایه خود را تبدیل کنند' });
    }
    if (!user.caravanId) return res.status(400).json({ error: 'شما عضو کاروانی نیستید' });

    // The client may send the current display name, a legacy name or the key
    const names = await getAssetNames();
    const resolve = (n: string) => ASSET_FIELDS[n] ?? (['zarik', 'nakh', 'farsh'] as const).find(k => k === n || names[k] === n);
    const from = resolve(sourceAsset);
    const to = resolve(targetAsset);
    const { config } = await getEconomyPolicy();
    const rule = from && to ? conversionRule(from, to, config) : null;
    if (!from || !to || !rule) {
      return res.status(400).json({ error: `تبدیل ${sourceAsset} به ${targetAsset} امکان‌پذیر نیست` });
    }
    if (!Number.isInteger(sourceAmount) || sourceAmount <= 0) {
      return res.status(400).json({ error: 'مقدار نامعتبر است' });
    }
    if (sourceAmount % rule.step !== 0) {
      return res.status(400).json({ error: `مقدار ${sourceAsset} باید مضربی از ${rule.step} باشد` });
    }
    const targetAmount = (sourceAmount / rule.step) * rule.pays;
    const caravanId = user.caravanId;

    let reqRecord;
    try {
      reqRecord = await prisma.$transaction(async (tx) => {
        const record = await tx.assetConversionRequest.create({
          data: {
            caravanId,
            requestedBy: user.id,
            status: 'completed',
            sourceAsset,
            targetAsset,
            sourceAmount,
            targetAmount,
            note: `تبدیل ${sourceAmount} ${sourceAsset} به ${targetAmount} ${targetAsset}`,
          },
        });
        const reason = `تبدیل ${sourceAmount} ${names[from]} به ${targetAmount} ${names[to]}`;
        const entry = { userId: user.id, sourceType: 'conversion', sourceId: record.id, reason, createdBy: user.id, zarikCategory: 'Asset Exchange' };
        await changeBalance(tx, { ...entry, asset: from, amount: -sourceAmount });
        await changeBalance(tx, { ...entry, asset: to, amount: targetAmount });
        return record;
      });
    } catch (e: any) {
      if (e?.message === 'INSUFFICIENT_BALANCE') return res.status(400).json({ error: 'دارایی شما کافی نیست' });
      throw e;
    }

    // Observer notification for the caravan mentor (best effort: never fails the exchange)
    try {
      const caravan = await prisma.caravan.findUnique({ where: { id: caravanId }, select: { mentorId: true } });
      if (caravan?.mentorId) {
        await prisma.notification.create({
          data: {
            userId: caravan.mentorId,
            title: 'صرافی سرمایه',
            message: `${user.name}: ${reqRecord.note}`,
            type: 'alert',
          },
        });
      }
    } catch (e) {
      console.error('conversion notify mentor error:', e);
    }

    res.json({ success: true, request: reqRecord });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// Cancels a completed conversion (mistaken exchange) and restores the balances.
// Allowed for the caravan's mentor within 24h of the exchange, or for an admin at any time.
export async function cancelAssetConversion(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const reason = String(req.body?.reason || req.body?.note || '').trim();
    const isAdmin = req.user!.role?.toLowerCase() === 'admin';

    const conversion = await prisma.assetConversionRequest.findUnique({
      where: { id },
      include: { caravan: { select: { mentorId: true } } },
    });
    if (!conversion || conversion.status !== 'completed') {
      return res.status(404).json({ error: 'صرافی معتبر یافت نشد' });
    }
    if (!isAdmin) {
      if (conversion.caravan.mentorId !== req.user!.id) {
        return res.status(403).json({ error: 'تنها راهبر همین کاروان می‌تواند صرافی را لغو کند' });
      }
      if (Date.now() - conversion.createdAt.getTime() > CONVERSION_CANCEL_WINDOW_MS) {
        return res.status(400).json({ error: 'مهلت ۲۴ ساعته لغو این صرافی به پایان رسیده است' });
      }
    }

    const from = ASSET_FIELDS[conversion.sourceAsset || ''];
    const to = ASSET_FIELDS[conversion.targetAsset || ''];
    if (!from || !to || !conversion.sourceAmount || !conversion.targetAmount) {
      return res.status(400).json({ error: 'اطلاعات این صرافی برای لغو کافی نیست' });
    }
    const sourceAmount = conversion.sourceAmount;
    const targetAmount = conversion.targetAmount;

    try {
      await prisma.$transaction(async (tx) => {
        // Claim first: a concurrent second cancel sees count 0 and aborts
        const claimed = await tx.assetConversionRequest.updateMany({
          where: { id, status: 'completed' },
          data: { status: 'cancelled', cancelledBy: req.user!.id, cancelledAt: new Date(), rejectionReason: reason || null },
        });
        if (claimed.count !== 1) throw new Error('ALREADY_HANDLED');
        // The student must still hold the converted capital; no negative balances allowed
        const ledgerReason = `لغو صرافی: ${conversion.note}`;
        const entry = { userId: conversion.requestedBy, sourceType: 'conversion_cancel', sourceId: id, reason: ledgerReason, createdBy: req.user!.id, zarikCategory: 'Asset Exchange' };
        await changeBalance(tx, { ...entry, asset: to, amount: -targetAmount });
        await changeBalance(tx, { ...entry, asset: from, amount: sourceAmount });
      });
    } catch (e: any) {
      if (e?.message === 'ALREADY_HANDLED') return res.status(404).json({ error: 'صرافی معتبر یافت نشد' });
      if (e?.message === 'INSUFFICIENT_BALANCE') {
        return res.status(400).json({ error: 'دانش‌آموز سرمایه‌ی تبدیل‌شده را خرج کرده و بازگرداندن صرافی ممکن نیست' });
      }
      throw e;
    }

    await prisma.notification.create({
      data: {
        userId: conversion.requestedBy,
        title: 'صرافی لغو شد',
        message: `صرافی «${conversion.note}» توسط راهبر لغو شد و سرمایه‌های شما بازگردانده شد.${reason ? ` علت: ${reason}` : ''}`,
        type: 'alert',
      },
    });
    await logAdminAction(req.user!.id, req.user!.phoneNumber || 'Mentor', 'CANCEL_ASSET_CONVERSION', 'AssetConversionRequest', id, reason || 'cancelled', req.ip || '');

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getAssetConversionsAdmin(req: AuthRequest, res: Response) {
  try {
    const requests = await prisma.assetConversionRequest.findMany({
      include: {
        caravan: { select: { name: true } },
        user: { select: { id: true, name: true, phoneNumber: true, avatarUrl: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(requests);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getCaravanAssetConversions(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role?.toLowerCase();

    // Mentors see every exchange of their caravan (observer view); students only their own.
    // A mentor of several caravans passes the one picked in the app as ?caravanId.
    const requestedCaravanId = typeof req.query.caravanId === 'string' ? req.query.caravanId : '';
    const mentorCaravan = await prisma.caravan.findFirst({
      where: {
        ...(requestedCaravanId ? { id: requestedCaravanId } : {}),
        ...(userRole === 'admin' && requestedCaravanId ? {} : { mentorId: userId }),
      },
      orderBy: { name: 'asc' },
    });

    const whereClause: any = {};
    if (mentorCaravan) {
      whereClause.caravanId = mentorCaravan.id;
    } else if (userRole !== 'admin') {
      whereClause.requestedBy = userId;
    }

    const requests = await prisma.assetConversionRequest.findMany({
      where: whereClause,
      include: {
        caravan: { select: { name: true } },
        user: { select: { id: true, name: true, phoneNumber: true, avatarUrl: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(requests);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}


export async function createCaravan(req: AuthRequest, res: Response) {
  try {
    const { name, capacityLimit, mentorId, description, coverImageUrl, targetStationId, studentIds, socialGroupLink } = req.body;
    
    // Check if mentor exists
    if (mentorId) {
      const mentor = await prisma.user.findUnique({ where: { id: mentorId } });
      if (!mentor || (mentor.role !== 'mentor' && !mentor.isDualRole)) {
        return res.status(400).json({ error: 'راهبر نامعتبر است' });
      }
    }

    const defaultLimitStr = (await prisma.systemSetting.findUnique({ where: { key: 'DEFAULT_CARAVAN_CAPACITY' } }))?.value;
    const finalLimit = capacityLimit ? parseInt(capacityLimit) : (defaultLimitStr ? parseInt(defaultLimitStr) : 25);

    if (studentIds && Array.isArray(studentIds)) {
      if (studentIds.length > finalLimit) {
        return res.status(400).json({ error: `ظرفیت این کاروان تکمیل شده است (حداکثر ${finalLimit} نفر)` });
      }
    }

    const caravan = await prisma.caravan.create({
      data: {
        name,
        capacityLimit: finalLimit,
        description,
        coverImageUrl,
        targetStationId,
        socialGroupLink: socialGroupLink?.trim() || undefined,
      }
    });

    if (mentorId) await setCaravanMentor(caravan.id, mentorId);

    if (studentIds && Array.isArray(studentIds) && studentIds.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: studentIds } },
        data: { caravanId: caravan.id }
      });
      await refreshUserRooms(studentIds);

    }

    await logAdminAction(req.user!.id, 'Admin', 'CREATE_CARAVAN', 'Caravan', caravan.id, `Created caravan ${name}`, req.ip || '');
    res.json({ success: true, caravan });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getCaravans(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role?.toLowerCase();

    let whereClause: any = { isDeleted: false };
    if (userRole === 'mentor' && userId) {
      whereClause = {
        isDeleted: false,
        OR: [
          { mentorId: userId },
          { members: { some: { id: userId } } }
        ]
      };
    }

    let caravans = await prisma.caravan.findMany({
      where: whereClause,
      include: {
        mentor: { select: { id: true, name: true, phoneNumber: true, avatarUrl: true } },
        members: {
          where: { isDeleted: false, role: 'student' },
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            userCode: true,
            zarikBalance: true,
            role: true,
            levelFrame: true,
            nakh: true,
            farsh: true,
            beyragh: true,
            avatarUrl: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // If mentor has no assigned caravans in filter, return all non-deleted caravans as fallback
    if (caravans.length === 0) {
      caravans = await prisma.caravan.findMany({
        where: { isDeleted: false },
        include: {
          mentor: { select: { id: true, name: true, phoneNumber: true, avatarUrl: true } },
          members: {
            where: { isDeleted: false, role: 'student' },
            select: {
              id: true,
              name: true,
              phoneNumber: true,
              userCode: true,
              zarikBalance: true,
              role: true,
              levelFrame: true,
              nakh: true,
              farsh: true,
              beyragh: true,
              avatarUrl: true
            }
          }
        },
        orderBy: { name: 'asc' }
      });
    }

    // Each caravan's totals, value and place as «برترین کاروان‌ها» counts them (the mentor's home, market and profile)
    const standings = await caravanStandings();
    res.json(caravans.map(c => ({ ...c, standing: standings.get(c.id) ?? null })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getCaravanDetails(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    const caravan = await prisma.caravan.findUnique({
      where: { id },
      include: {
        mentor: { select: MENTOR_PUBLIC_SELECT },
        members: {
          where: { isDeleted: false },
          select: { id: true, name: true, phoneNumber: true, userCode: true, zarikBalance: true, role: true, levelFrame: true, nakh: true, farsh: true, beyragh: true }
        }
      }
    });
    if (!caravan) return res.status(404).json({ error: 'کاروان یافت نشد' });

    const membersList = caravan.members || [];
    // Caravan capital is the students' total; a mentor who is also linked as a member adds nothing
    // Totals and value as «برترین کاروان‌ها» counts them (درفش includes the caravan's own banners; کلاف has no value)
    const standing = (await caravanStandings()).get(caravan.id) ?? null;
    const students = membersList.filter(u => u.role === 'student');
    const wealth = standing?.assets ?? {
      zarik: students.reduce((acc, u) => acc + (u.zarikBalance || 0), 0),
      nakh: students.reduce((acc, u) => acc + (u.nakh || 0), 0),
      farsh: students.reduce((acc, u) => acc + (u.farsh || 0), 0),
      beyragh: students.reduce((acc, u) => acc + (u.beyragh || 0), 0),
    };
    const totalWealth = standing?.totalWealth ?? 0;

    // Calculate progress based on station session watch records
    let overallProgress = caravan.overallProgress || 0;
    try {
      const totalSessions = await prisma.classSession.count({ where: { isDeleted: false } });
      if (membersList.length > 0 && totalSessions > 0) {
        const watchedCount = await prisma.sessionWatchRecord.count({
          where: {
            userId: { in: membersList.map(m => m.id) },
            watchedPercentage: { gte: 70 }
          }
        });
        const calculatedProgress = Math.min(100, Math.round((watchedCount / (membersList.length * totalSessions)) * 100));
        overallProgress = Math.max(overallProgress, calculatedProgress);
      }
    } catch (_) {}

    // The caravan's chat group carries the caravan's name unless it was given its own
    const space = await prisma.chatSpace.findUnique({ where: { key: `caravan:${caravan.id}` }, select: { title: true } });

    return res.json({
      ...caravan,
      groupTitle: caravanGroupTitle(caravan.name, space?.title),
      customGroupTitle: customCaravanGroupTitle(space?.title),
      mentorName: caravan.mentor?.name || 'فاقد راهبر',
      membersList,
      memberCount: membersList.length,
      wealth,
      totalWealth,
      standing,
      overallProgress
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'خطای سرور' });
  }
}

export async function addMemberToCaravan(req: AuthRequest, res: Response) {
  try {
    const { id, studentId } = req.params;
    const caravan = await prisma.caravan.findUnique({ where: { id }, include: { members: true } });
    if (!caravan) return res.status(404).json({ error: 'کاروان یافت نشد' });

    const capacityLimit = caravan.capacityLimit && caravan.capacityLimit > 0 ? caravan.capacityLimit : 50;
    if (caravan.members.length >= capacityLimit) {
      await prisma.caravan.update({
        where: { id },
        data: { capacityLimit: caravan.members.length + 10 }
      });
    }

    const result = await moveToCaravan([studentId], id);
    if (result.skippedMentors.length) return res.status(400).json({ error: 'راهبر عضو کاروان نمی‌شود؛ او را از «تغییر راهبر» کاروان تعیین کنید' });

    res.json({ success: true, message: 'عضو با موفقیت به کاروان اضافه شد' });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
}

export async function removeMemberFromCaravan(req: AuthRequest, res: Response) {
  try {
    const { id, studentId } = req.params;
    const student = await prisma.user.findUnique({ where: { id: studentId }, select: { caravanId: true } });
    if (student?.caravanId === id) await moveToCaravan([studentId], null);
    const newCount = await prisma.user.count({ where: { caravanId: id } });

    res.json({ success: true, message: 'فرد با موفقیت از کاروان حذف گردید', memberCount: newCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function transferMember(req: AuthRequest, res: Response) {
  try {
    const { studentId, targetCaravanId } = req.body;
    if (!studentId || !targetCaravanId) return res.status(400).json({ error: 'فرد و کاروان مقصد را مشخص کنید' });
    const targetCaravan = await prisma.caravan.findFirst({ where: { id: targetCaravanId, isDeleted: false } });
    if (!targetCaravan) return res.status(404).json({ error: 'کاروان مقصد یافت نشد' });

    const students = await prisma.user.count({ where: { caravanId: targetCaravanId, role: 'student', isDeleted: false, id: { not: studentId } } });
    if (targetCaravan.capacityLimit > 0 && students >= targetCaravan.capacityLimit) {
      return res.status(400).json({ error: `ظرفیت این کاروان تکمیل شده است (حداکثر ${targetCaravan.capacityLimit} نفر)` });
    }

    // Assets and progress stay with the person; groups, challenges and chats follow the new caravan
    const result = await moveToCaravan([studentId], targetCaravanId);
    if (result.skippedMentors.length) return res.status(400).json({ error: 'راهبر منتقل نمی‌شود؛ او را از «تغییر راهبر» کاروان مقصد تعیین کنید' });
    await logAdminAction(req.user!.id, 'Admin', 'TRANSFER_MEMBER', 'User', studentId, `انتقال به کاروان ${targetCaravan.name}`, req.ip || '');

    res.json({ success: true, message: `به کاروان «${targetCaravan.name}» منتقل شد`, ...result });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
}

export async function broadcastToCaravan(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { message, title } = req.body;
    
    const caravan = await prisma.caravan.findUnique({ where: { id }, include: { members: true } });
    if (!caravan) return res.status(404).json({ error: 'کاروان یافت نشد' });
    if (isMentorRole(req.user?.role) && caravan.mentorId !== req.user!.id) {
      return res.status(403).json({ error: 'فقط می‌توانید به کاروان خودتان پیام بفرستید' });
    }

    const notifications = caravan.members.map(m => ({
      userId: m.id,
      title: title || 'پیام راهبر کاروان',
      message,
      type: 'alert'
    }));

    await prisma.notification.createMany({ data: notifications });
    
    await logAdminAction(req.user!.id, 'Admin', 'BROADCAST_CARAVAN', 'Caravan', id, `Broadcasted: ${title}`, req.ip || '');

    res.json({ success: true, count: notifications.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getCaravanRequests(req: AuthRequest, res: Response) {
  try {
    const isMentor = req.user?.role === 'mentor';
    let whereAsset: any = { status: 'pending' };
    let whereTicket: any = { category: 'Caravan Transfer' };
    
    if (isMentor) {
      whereAsset.requestedBy = req.user?.id;
      whereTicket.studentId = req.user?.id;
    }

    const assetRequests = await prisma.assetConversionRequest.findMany({
      where: whereAsset,
      include: {
        caravan: { select: { name: true } },
        user: { select: { name: true, phoneNumber: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const transferRequests = await prisma.supportTicket.findMany({
      where: whereTicket,
      include: {
        student: { select: { name: true, phoneNumber: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      assetConversions: assetRequests,
      transferRequests: transferRequests
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateCaravan(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { mentorId, name, capacityLimit, description } = req.body;
  try {
    const dataToUpdate: any = {};
    if (mentorId !== undefined) dataToUpdate.mentorId = mentorId || null;
    if (name !== undefined) dataToUpdate.name = name;
    if (capacityLimit !== undefined) dataToUpdate.capacityLimit = Number(capacityLimit);
    if (description !== undefined) dataToUpdate.description = description;
    // The caravan's picture (the same one the mentor sets in the app); '' / null removes it
    const cover = req.body.coverImageUrl;
    if (cover !== undefined) {
      const url = typeof cover === 'string' && cover.trim() ? cover.trim() : null;
      if (url && !/^(\/uploads\/|https?:\/\/)/i.test(url)) return res.status(400).json({ error: 'آدرس عکس معتبر نیست' });
      dataToUpdate.coverImageUrl = url;
    }

    // A new mentor goes through setCaravanMentor: the old one leaves the caravan's groups at once
    const newMentorId = dataToUpdate.mentorId;
    delete dataToUpdate.mentorId;
    if (newMentorId !== undefined) await setCaravanMentor(id, newMentorId);
    const updated = await prisma.caravan.update({
      where: { id },
      data: dataToUpdate,
      include: { mentor: { select: MENTOR_PUBLIC_SELECT } }
    });
    // The name of the caravan's chat group; '' makes it follow the caravan's name again
    const groupTitle = req.body.groupTitle !== undefined ? await setCaravanGroupTitle(id, req.body.groupTitle) : undefined;
    res.json({ message: 'کاروان با موفقیت بروزرسانی شد', caravan: updated, ...(groupTitle !== undefined ? { groupTitle } : {}) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function bulkAddMembersToCaravan(req: AuthRequest, res: Response) {
  const caravanId = req.params.id || req.params.caravanId;
  const { userIds } = req.body;
  if (!caravanId) {
    return res.status(400).json({ error: 'شناسه کاروان مشخص نشده است' });
  }
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'حداقل یک دانش‌آموز برای افزودن به کاروان انتخاب کنید' });
  }
  try {
    // Check caravan exists
    const caravan = await prisma.caravan.findUnique({ where: { id: caravanId } });
    if (!caravan) {
      return res.status(404).json({ error: 'کاروان مورد نظر یافت نشد' });
    }

    // Students only; one already in another caravan is moved here (assets and progress stay with them)
    const students = await prisma.user.findMany({ where: { id: { in: userIds.map(String) }, role: 'student', isDeleted: false }, select: { id: true } });
    const result = await moveToCaravan(students.map(s => s.id), caravanId);
    const memberCount = await prisma.user.count({ where: { caravanId } });

    res.json({
      success: true,
      message: `${result.moved.length} دانش‌آموز با موفقیت به کاروان اضافه شدند`,
      addedCount: result.moved.length,
      memberCount
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
}

export async function deleteCaravan(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const caravan = await prisma.caravan.findUnique({ where: { id } });
    if (!caravan) return res.status(404).json({ error: 'کاروان یافت نشد.' });

    // Release all members
    const released = await prisma.user.findMany({ where: { caravanId: id }, select: { id: true } });
    await moveToCaravan(released.map(u => u.id), null, { notify: false });
    // a mentor left with a caravanId of it is released too
    await prisma.user.updateMany({ where: { caravanId: id }, data: { caravanId: null } });
    await refreshUserRooms(released.map(u => u.id));

    // Soft delete caravan
    await prisma.caravan.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() }
    });

    await logAdminAction(req.user!.id, 'Admin', 'DELETE_CARAVAN', 'Caravan', id, 'Soft deleted caravan and released members', req.ip || '');
    res.json({ message: 'کاروان با موفقیت حذف شد و اعضای آن آزاد شدند.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function blockCaravanMembers(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const caravan = await prisma.caravan.findUnique({ where: { id } });
    if (!caravan) return res.status(404).json({ error: 'کاروان یافت نشد.' });

    // Block all members of this caravan
    await prisma.user.updateMany({
      where: { caravanId: id },
      data: { blocked: true }
    });

    await logAdminAction(req.user!.id, 'Admin', 'BLOCK_CARAVAN_MEMBERS', 'Caravan', id, 'Blocked all members of caravan', req.ip || '');
    res.json({ message: 'تمامی اعضای این کاروان مسدود شدند.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
