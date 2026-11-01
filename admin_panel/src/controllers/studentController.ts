import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/db';
import bcrypt from 'bcryptjs';


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
    const { assetType, note } = req.body; // assetType: 'zarik' | 'nakh' | 'beyragh' | 'farsh'
    const amount = Number(req.body.amount);

    // A string amount would be concatenated ("5" + "10" = "510") instead of added
    if (!Number.isInteger(amount) || amount === 0) {
      return res.status(400).json({ error: 'مقدار باید یک عدد صحیح غیرصفر باشد' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'کاربر یافت نشد' });

    let updateData: any = {};
    let currentValue = 0;
    if (assetType === 'zarik') { updateData.zarikBalance = { increment: amount }; currentValue = user.zarikBalance; }
    else if (assetType === 'nakh') { updateData.nakh = { increment: amount }; currentValue = user.nakh; }
    else if (assetType === 'beyragh') { updateData.beyragh = { increment: amount }; currentValue = user.beyragh; }
    else if (assetType === 'farsh') { updateData.farsh = { increment: amount }; currentValue = user.farsh; }
    else return res.status(400).json({ error: 'نوع دارایی نامعتبر است' });

    // Prevent negative balances
    if (currentValue + amount < 0) {
        return res.status(400).json({ error: 'موجودی نمی‌تواند منفی شود' });
    }

    // Balance change and ledger entry (zarik) are written atomically
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: updateData });
      if (assetType === 'zarik') {
        await tx.zarikTransaction.create({
          data: {
            userId: id,
            amount,
            category: 'Special Campaigns',
            reason: note ? String(note) : 'تغییر دستی موجودی توسط مدیر',
            createdBy: req.user!.id
          }
        });
      }
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
