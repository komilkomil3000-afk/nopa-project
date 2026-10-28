import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function createOrUpdateStudent(req: AuthRequest, res: Response) {
  try {
    const { id, name, phoneNumber, nationalId, dateOfBirth, city, caravanId, mentorId } = req.body;

    // Check if CRM verified this number. If it exists as another student, it's a family sub-profile.
    let user;
    if (id) {
      user = await prisma.user.update({
        where: { id },
        data: {
          name,
          phoneNumber,
          nationalId,
          dateOfBirth,
          caravanId: caravanId || null
          // city and mentorId should be added if added to schema, but they are not in schema currently.
          // Mentor is assigned through caravan.
        }
      });
    } else {
      const maxUser = await prisma.user.findFirst({
        orderBy: { userCode: 'desc' },
        where: { userCode: { not: null } }
      });
      const nextUserCode = maxUser && maxUser.userCode ? maxUser.userCode + 1 : 110100;

      user = await prisma.user.create({
        data: {
          name,
          phoneNumber,
          nationalId,
          dateOfBirth,
          role: 'student',
          passwordHash: bcrypt.hashSync('123456', 10), // Default password for new student
          caravanId: caravanId || null,
          userCode: nextUserCode
        }
      });
    }

    res.json({ success: true, user });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function adjustBalance(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { assetType, amount, note } = req.body; // assetType: 'zarik' | 'nakh' | 'beyragh' | 'farsh'

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'کاربر یافت نشد' });

    let updateData: any = {};
    if (assetType === 'zarik') updateData.zarikBalance = user.zarikBalance + amount;
    else if (assetType === 'nakh') updateData.nakh = user.nakh + amount;
    else if (assetType === 'beyragh') updateData.beyragh = user.beyragh + amount;
    else if (assetType === 'farsh') updateData.farsh = user.farsh + amount;
    
    // Prevent negative balances
    if ((Object.values(updateData)[0] as number) < 0) {
        return res.status(400).json({ error: 'موجودی نمی‌تواند منفی شود' });
    }

    await prisma.user.update({
      where: { id },
      data: updateData
    });

    // Notify the user
    await prisma.notification.create({
      data: {
        userId: id,
        title: amount > 0 ? 'پاداش جدید 🎁' : 'کسر موجودی ⚖️',
        message: `موجودی ${assetType} شما به میزان ${Math.abs(amount)} تغییر کرد. بابت: ${note}`,
        type: 'alert'
      }
    });
    
    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: req.user!.id,
        actorName: req.user!.role,
        action: 'ADJUST_BALANCE',
        targetEntity: 'User',
        targetEntityId: id,
        details: `تغییر ${assetType} به میزان ${amount}. علت: ${note}`,
        ipAddress: req.ip || '127.0.0.1',
      }
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function adjustLevelFrame(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { levelFrame } = req.body;

    await prisma.user.update({
      where: { id },
      data: { levelFrame }
    });

    await prisma.notification.create({
      data: {
        userId: id,
        title: 'ارتقای سطح 🚀',
        message: `سطح فریم شما به ${levelFrame} ارتقا یافت!`,
        type: 'alert'
      }
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
