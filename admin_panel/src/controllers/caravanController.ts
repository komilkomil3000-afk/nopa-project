import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/auth';

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
    
    if (targetCaravanId !== null) {
      const targetCaravan = await prisma.caravan.findUnique({ where: { id: targetCaravanId } });
      if (!targetCaravan) return res.status(404).json({ error: 'کاروان مقصد یافت نشد' });
    }
    
    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { caravanId: targetCaravanId }
    });
    
    // Update member counts (approximate, or recalculate)
    await logAdminAction(req.user!.id, 'Admin', 'BULK_TRANSFER', 'Caravan', targetCaravanId || 'UNASSIGNED', `Transferred ${userIds.length} users`, req.ip || '');
    res.json({ message: 'اعضا با موفقیت منتقل شدند.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// Capital exchange rules: only zarik -> nakh and nakh -> farsh are allowed.
// The rate is how many units of the source make one unit of the target.
const ASSET_FIELDS: Record<string, 'zarik' | 'nakh' | 'farsh'> = { 'زریک': 'zarik', 'نخ': 'nakh', 'فرش': 'farsh', 'کلاف': 'nakh', 'قالیچه': 'farsh' };
const CONVERSION_RATES: Record<string, number> = { 'zarik>nakh': 500, 'nakh>farsh': 5 };
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
    const rate = from && to ? CONVERSION_RATES[`${from}>${to}`] : undefined;
    if (!from || !to || !rate) {
      return res.status(400).json({ error: `تبدیل ${sourceAsset} به ${targetAsset} امکان‌پذیر نیست` });
    }
    if (!Number.isInteger(sourceAmount) || sourceAmount <= 0) {
      return res.status(400).json({ error: 'مقدار نامعتبر است' });
    }
    if (sourceAmount % rate !== 0) {
      return res.status(400).json({ error: `مقدار ${sourceAsset} باید مضربی از ${rate} باشد` });
    }
    const targetAmount = sourceAmount / rate;
    const caravanId = user.caravanId;

    let reqRecord;
    try {
      reqRecord = await prisma.$transaction(async (tx) => {
        // Guarded decrement: the balance can never go negative, even under concurrent requests
        const debited = await tx.user.updateMany({
          where: { id: user.id, [from]: { gte: sourceAmount } },
          data: { [from]: { decrement: sourceAmount }, [to]: { increment: targetAmount } },
        });
        if (debited.count !== 1) throw new Error('INSUFFICIENT_BALANCE');
        if (from === 'zarik') {
          await tx.zarikTransaction.create({
            data: { userId: user.id, amount: -sourceAmount, category: 'Asset Exchange', reason: `تبدیل ${sourceAmount} ${names.zarik} به ${targetAmount} ${names.nakh}`, createdBy: user.id },
          });
        }
        return tx.assetConversionRequest.create({
          data: {
            caravanId,
            requestedBy: user.id,
            status: 'completed',
            sourceAsset,
            targetAsset,
            sourceAmount,
            targetAmount,
            note: `تبدیل ${sourceAmount} ${sourceAsset} ➔ ${targetAmount} ${targetAsset}`,
          },
        });
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
            title: 'مبادله سرمایه 🔄',
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
      return res.status(404).json({ error: 'مبادله معتبر یافت نشد' });
    }
    if (!isAdmin) {
      if (conversion.caravan.mentorId !== req.user!.id) {
        return res.status(403).json({ error: 'تنها راهبر همین کاروان می‌تواند مبادله را لغو کند' });
      }
      if (Date.now() - conversion.createdAt.getTime() > CONVERSION_CANCEL_WINDOW_MS) {
        return res.status(400).json({ error: 'مهلت ۲۴ ساعته لغو این مبادله به پایان رسیده است' });
      }
    }

    const from = ASSET_FIELDS[conversion.sourceAsset || ''];
    const to = ASSET_FIELDS[conversion.targetAsset || ''];
    if (!from || !to || !conversion.sourceAmount || !conversion.targetAmount) {
      return res.status(400).json({ error: 'اطلاعات این مبادله برای لغو کافی نیست' });
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
        const reverted = await tx.user.updateMany({
          where: { id: conversion.requestedBy, [to]: { gte: targetAmount } },
          data: { [to]: { decrement: targetAmount }, [from]: { increment: sourceAmount } },
        });
        if (reverted.count !== 1) throw new Error('INSUFFICIENT_BALANCE');
        if (from === 'zarik') {
          await tx.zarikTransaction.create({
            data: { userId: conversion.requestedBy, amount: sourceAmount, category: 'Asset Exchange', reason: `لغو مبادله: بازگشت ${sourceAmount} زریک`, createdBy: req.user!.id },
          });
        }
      });
    } catch (e: any) {
      if (e?.message === 'ALREADY_HANDLED') return res.status(404).json({ error: 'مبادله معتبر یافت نشد' });
      if (e?.message === 'INSUFFICIENT_BALANCE') {
        return res.status(400).json({ error: 'دانش‌آموز سرمایه‌ی تبدیل‌شده را خرج کرده و بازگرداندن مبادله ممکن نیست' });
      }
      throw e;
    }

    await prisma.notification.create({
      data: {
        userId: conversion.requestedBy,
        title: 'مبادله لغو شد ↩️',
        message: `مبادله «${conversion.note}» توسط راهبر لغو شد و سرمایه‌های شما بازگردانده شد.${reason ? ` علت: ${reason}` : ''}`,
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

    // Mentors see every exchange of their caravan (observer view); students only their own
    const mentorCaravan = await prisma.caravan.findFirst({ where: { mentorId: userId } });

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
        mentorId,
        description,
        coverImageUrl,
        targetStationId,
        socialGroupLink: socialGroupLink?.trim() || undefined,
      }
    });

    if (studentIds && Array.isArray(studentIds) && studentIds.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: studentIds } },
        data: { caravanId: caravan.id }
      });

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
        mentor: { select: { id: true, name: true, phoneNumber: true } },
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
          mentor: { select: { id: true, name: true, phoneNumber: true } },
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

    res.json(caravans);
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
    const students = membersList.filter(u => u.role === 'student');
    const wealth = {
      zarik: students.reduce((acc, u) => acc + (u.zarikBalance || 0), 0),
      nakh: students.reduce((acc, u) => acc + (u.nakh || 0), 0),
      farsh: students.reduce((acc, u) => acc + (u.farsh || 0), 0),
      beyragh: students.reduce((acc, u) => acc + (u.beyragh || 0), 0),
    };
    const totalWealth = wealth.zarik;

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

    return res.json({
      ...caravan,
      mentorName: caravan.mentor?.name || 'فاقد راهبر',
      membersList,
      memberCount: membersList.length,
      wealth,
      totalWealth,
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

    await prisma.user.update({
      where: { id: studentId },
      data: { caravanId: id }
    });

    const memberCount = await prisma.user.count({ where: { caravanId: id } });
    await prisma.caravan.update({
      where: { id },
      data: { memberCount }
    });

    res.json({ success: true, message: 'عضو با موفقیت به کاروان اضافه شد' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function removeMemberFromCaravan(req: AuthRequest, res: Response) {
  try {
    const { id, studentId } = req.params;
    await prisma.user.update({
      where: { id: studentId },
      data: { caravanId: null }
    });
    const newCount = await prisma.user.count({ where: { caravanId: id } });
    await prisma.caravan.update({
      where: { id },
      data: { memberCount: newCount }
    }).catch(() => {});

    res.json({ success: true, message: 'فرد با موفقیت از کاروان حذف گردید', memberCount: newCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function transferMember(req: AuthRequest, res: Response) {
  try {
    const { studentId, targetCaravanId } = req.body;
    const targetCaravan = await prisma.caravan.findUnique({ where: { id: targetCaravanId }, include: { members: true } });
    if (!targetCaravan) return res.status(404).json({ error: 'کاروان مقصد یافت نشد' });

    if (targetCaravan.members.length >= targetCaravan.capacityLimit) {
      return res.status(400).json({ error: `ظرفیت این کاروان تکمیل شده است (حداکثر ${targetCaravan.capacityLimit} نفر)` });
    }

    await prisma.user.update({
      where: { id: studentId },
      data: { caravanId: targetCaravanId }
    });


    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function broadcastToCaravan(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { message, title } = req.body;
    
    const caravan = await prisma.caravan.findUnique({ where: { id }, include: { members: true } });
    if (!caravan) return res.status(404).json({ error: 'کاروان یافت نشد' });

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

    const updated = await prisma.caravan.update({
      where: { id },
      data: dataToUpdate,
      include: { mentor: { select: MENTOR_PUBLIC_SELECT } }
    });
    res.json({ message: 'کاروان با موفقیت بروزرسانی شد', caravan: updated });
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

    // Only assign students who do not already belong to any caravan
    const updateResult = await prisma.user.updateMany({
      where: {
        id: { in: userIds },
        role: 'student',
        caravanId: null
      },
      data: { caravanId }
    });

    const memberCount = await prisma.user.count({ where: { caravanId } });
    await prisma.caravan.update({
      where: { id: caravanId },
      data: { memberCount }
    });

    res.json({
      success: true,
      message: `${updateResult.count} دانش‌آموز با موفقیت به کاروان اضافه شدند`,
      addedCount: updateResult.count,
      memberCount
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteCaravan(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const caravan = await prisma.caravan.findUnique({ where: { id } });
    if (!caravan) return res.status(404).json({ error: 'کاروان یافت نشد.' });

    // Release all members
    await prisma.user.updateMany({
      where: { caravanId: id },
      data: { caravanId: null }
    });

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
