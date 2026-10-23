import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getInstructors = async (req: Request, res: Response) => {
  try {
    const search = req.query.search as string;
    const where: any = {};

    if (search && search.trim() !== '') {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { phoneNumber: { contains: q } },
        { nationalId: { contains: q } },
        { classes: { contains: q } },
        { degree: { contains: q } },
        { description: { contains: q } }
      ];
    }

    const instructors = await prisma.instructor.findMany({
      where,
      orderBy: [
        { orderIndex: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    res.json({ success: true, data: instructors });
  } catch (error: any) {
    console.error('getInstructors error:', error);
    res.status(500).json({ error: error.message || 'خطا در دریافت لیست اساتید' });
  }
};

export const getInstructorById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const instructor = await prisma.instructor.findUnique({
      where: { id }
    });
    if (!instructor) {
      return res.status(404).json({ error: 'استاد مورد نظر یافت نشد' });
    }
    res.json({ success: true, data: instructor });
  } catch (error: any) {
    console.error('getInstructorById error:', error);
    res.status(500).json({ error: error.message || 'خطای سرور' });
  }
};

export const createOrUpdateInstructor = async (req: Request, res: Response) => {
  try {
    const {
      id,
      name,
      nationalId,
      phoneNumber,
      degree,
      resume,
      description,
      classes,
      avatarUrl,
      isActive,
      orderIndex
    } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'نام و نام‌خانوادگی استاد الزامی است' });
    }

    const data: any = {
      name: name.trim(),
      nationalId: nationalId ? String(nationalId).trim() : null,
      phoneNumber: phoneNumber ? String(phoneNumber).trim() : null,
      degree: degree ? String(degree).trim() : null,
      resume: resume ? String(resume).trim() : null,
      description: description ? String(description).trim() : null,
      classes: classes ? String(classes).trim() : null,
      avatarUrl: avatarUrl ? String(avatarUrl).trim() : null,
      isActive: typeof isActive === 'boolean' ? isActive : true,
      orderIndex: parseInt(orderIndex) || 0
    };

    let result;
    if (id && !id.startsWith('new_')) {
      result = await prisma.instructor.update({
        where: { id },
        data
      });
    } else {
      result = await prisma.instructor.create({
        data
      });
    }

    res.json({ success: true, message: 'اطلاعات استاد با موفقیت ذخیره شد', data: result });
  } catch (error: any) {
    console.error('createOrUpdateInstructor error:', error);
    res.status(500).json({ error: error.message || 'خطا در ذخیره‌سازی اطلاعات استاد' });
  }
};

export const deleteInstructor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.instructor.delete({
      where: { id }
    });
    res.json({ success: true, message: 'استاد با موفقیت حذف شد' });
  } catch (error: any) {
    console.error('deleteInstructor error:', error);
    res.status(500).json({ error: error.message || 'خطا در حذف استاد' });
  }
};
