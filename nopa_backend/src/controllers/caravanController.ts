import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { logAdminAction } from './adminController';

const prisma = new PrismaClient();

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

export async function convertAssets(req: AuthRequest, res: Response) {
  try {
    if (!req.user || req.user.role !== 'mentor') {
      return res.status(403).json({ error: 'تنها راهبران مجاز به ثبت درخواست تبدیل هستند' });
    }

    const mentor = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!mentor || !mentor.caravanId) return res.status(404).json({ error: 'کاربر یا کاروان یافت نشد' });

    if (mentor.nakh < 5) {
      return res.status(400).json({ error: 'موجودی نخ شما کافی نیست (حداقل 5 کلاف نخ نیاز است)' });
    }

    // Create a request in the queue
    await prisma.assetConversionRequest.create({
      data: {
        caravanId: mentor.caravanId,
        requestedBy: mentor.id,
        note: 'درخواست تبدیل ۵ کلاف نخ به ۱ فرش'
      }
    });

    res.json({ success: true, message: 'درخواست تبدیل با موفقیت ثبت شد و در انتظار تایید مدیریت است' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function approveAssetConversion(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { approve, note } = req.body; // approve: boolean

    const conversionReq = await prisma.assetConversionRequest.findUnique({ where: { id } });
    if (!conversionReq || conversionReq.status !== 'pending') {
      return res.status(404).json({ error: 'درخواست معتبر یافت نشد' });
    }

    if (approve) {
      // Check mentor balance again just in case
      const mentor = await prisma.user.findUnique({ where: { id: conversionReq.requestedBy } });
      if (!mentor || mentor.nakh < 5) {
        return res.status(400).json({ error: 'موجودی راهبر کافی نیست' });
      }

      await prisma.$transaction([
        prisma.user.update({
          where: { id: mentor.id },
          data: { nakh: { decrement: 5 }, farsh: { increment: 1 } }
        }),
        prisma.assetConversionRequest.update({
          where: { id },
          data: { status: 'approved', note: note || 'تایید شد' }
        })
      ]);
    } else {
      await prisma.assetConversionRequest.update({
        where: { id },
        data: { status: 'rejected', note: note || 'رد شد' }
      });
    }

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
        user: { select: { name: true } }
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

export async function getCaravanDetails(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const caravan = await prisma.caravan.findUnique({
      where: { id },
      include: {
        mentor: true,
        _count: { select: { members: { where: { isDeleted: false } } } },
        members: { 
          where: { isDeleted: false },
          select: { 
            id: true, name: true, phoneNumber: true, userCode: true,
            role: true, levelFrame: true,
            zarikBalance: true, farsh: true, nakh: true, beyragh: true, 
            sessionWatchRecords: { select: { watchedPercentage: true } },
            quizSubmissions: { select: { score: true } }
          } 
        }
      }
    });
    if (!caravan) return res.status(404).json({ error: 'کاروان یافت نشد' });
    
    const activeMembers = caravan.members || [];
    const realMemberCount = caravan._count?.members || activeMembers.length;

    let totalZarik = 0, totalNakh = 0, totalFarsh = 0, totalBeyragh = 0;
    let totalProgressSum = 0;

    activeMembers.forEach(m => {
      totalZarik += m.zarikBalance || 0;
      totalNakh += m.nakh || 0;
      totalFarsh += m.farsh || 0;
      totalBeyragh += m.beyragh || 0;

      const watchScores = m.sessionWatchRecords?.reduce((s: any, w: any) => s + (w.watchedPercentage || 0), 0) || 0;
      const quizScores = m.quizSubmissions?.reduce((s: any, q: any) => s + (q.score || 0), 0) || 0;
      totalProgressSum += (watchScores + quizScores);
    });

    const overallProgress = activeMembers.length > 0 ? Math.min(100, Math.round(totalProgressSum / (activeMembers.length * 100))) : 0;

    res.json({
      ...caravan,
      memberCount: realMemberCount,
      overallProgress,
      wealth: { zarik: totalZarik, nakh: totalNakh, farsh: totalFarsh, beyragh: totalBeyragh },
      membersList: activeMembers,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function addMemberToCaravan(req: AuthRequest, res: Response) {
  try {
    const { id, studentId } = req.params;
    const caravan = await prisma.caravan.findUnique({ where: { id }, include: { members: true } });
    if (!caravan) return res.status(404).json({ error: 'کاروان یافت نشد' });

    if (caravan.members.length >= caravan.capacityLimit) {
      return res.status(400).json({ error: `ظرفیت این کاروان تکمیل شده است (حداکثر ${caravan.capacityLimit} نفر)` });
    }

    await prisma.user.update({
      where: { id: studentId },
      data: { caravanId: id }
    });
    


    res.json({ success: true });
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
    const caravan = await prisma.caravan.findUnique({ where: { id }, include: { members: true } });

    res.json({ success: true });
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
