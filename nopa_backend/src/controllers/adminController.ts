import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createQuizMock } from './quizController';
import { sendSystemNotification } from './notificationController';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

// Memory Cache for Zarik Analytics (invalidated upon adjustments)
let zarikAnalyticsCache: { data: any; expiry: number } | null = null;
const CACHE_TTL = 30000; // 30 seconds

// Utility function to log to AuditLog
export async function logAdminAction(
  actorId: string,
  actorName: string,
  action: string,
  targetEntity: string,
  targetEntityId: string,
  details: string,
  ipAddress: string,
  actorRole: string = 'admin'
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        actorName,
        actorRole,
        action,
        targetEntity,
        targetEntityId,
        details,
        ipAddress: ipAddress || '127.0.0.1',
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

// 1. HIGH-SCALE USER & CONTACT DIRECTORY
export async function getUsers(req: AuthRequest, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = (req.query.search as string) || '';
    const role = (req.query.role as string) || '';
    const caravanId = (req.query.caravanId as string) || '';
    const levelFrame = parseInt(req.query.levelFrame as string) || null;

    const skip = (page - 1) * limit;

    // Build Prisma query filters
    const whereClause: any = {};

    if (search) {
      whereClause.OR = [
        { name: { contains: search } },
        { phoneNumber: { contains: search } },
      ];
      
      const parsedSearch = parseInt(search.replace(/^NP-/i, ''));
      if (!isNaN(parsedSearch)) {
        whereClause.OR.push({ userCode: parsedSearch });
      }
    }

    if (role) {
      whereClause.role = role;
    }

    if (caravanId) {
      whereClause.caravanId = caravanId;
    }

    if (levelFrame !== null) {
      whereClause.levelFrame = levelFrame;
    }

    // Get paginated users and total count in parallel
    const [users, totalCount] = await prisma.$transaction([
      prisma.user.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          caravan: true,
          submissions: {
            select: { id: true, status: true },
          },
        },
      }),
      prisma.user.count({ where: whereClause }),
    ]);

    // Check RBAC to see if we should mask phone numbers for this admin
    const actorRole = req.user?.role || 'admin';
    const permission = await prisma.rolePermission.findUnique({
      where: { roleName: actorRole },
    });
    const shouldMask = permission?.maskPhoneNumbers ?? false;

    const sanitizedUsers = users.map((u) => {
      const completionRate =
        u.submissions.length > 0
          ? Math.round(
              (u.submissions.filter((s) => s.status === 'approved').length /
                u.submissions.length) *
                100
            )
          : 0;

      return {
        id: u.id,
        name: u.name,
        phoneNumber: shouldMask ? u.phoneNumber.replace(/(\d{4})\d{4}(\d{3})/, '$1****$2') : u.phoneNumber,
        role: u.role,
        zarikBalance: u.zarikBalance,
        levelFrame: u.levelFrame,
        caravanName: u.caravan?.name || 'فاقد کاروان',
        caravanId: u.caravanId,
        blocked: u.blocked,
        createdAt: u.createdAt,
        completionRate,
      };
    });

    res.json({
      users: sanitizedUsers,
      total: totalCount,
      page,
      pages: Math.ceil(totalCount / limit),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getUserMetrics(req: AuthRequest, res: Response) {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [totalUsers, activeUsers, inactiveUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { lastActiveTimestamp: { gte: thirtyDaysAgo } } }),
      prisma.user.count({ where: { lastActiveTimestamp: { lt: thirtyDaysAgo } } }),
    ]);
    res.json({ total: totalUsers, active: activeUsers, inactive: inactiveUsers });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getUserAnalytics(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    // Basic user
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Quiz / challenge history
    const quizzes = await prisma.submission.findMany({ where: { studentId: id }, orderBy: { submittedAt: 'desc' }, take: 20 });

    // Homework / assignment submissions
    const assignments = await prisma.quizSubmission.findMany({ where: { studentId: id }, orderBy: { submittedAt: 'desc' }, include: { quiz: true } });

    // Support tickets and replies
    const tickets = await prisma.supportTicket.findMany({ where: { studentId: id }, include: { replies: true } });

    // Certificates
    const certificates = await prisma.certificate.findMany({ where: { userId: id } });

    // Approximate watched videos and active time
    const watchRecords = await prisma.sessionWatchRecord.findMany({ 
      where: { userId: id },
      include: { session: { include: { category: true } } }
    });

    const activeTimeMinutes = Math.max(0, quizzes.length * 12 + assignments.length * 8 + watchRecords.length * 20);

    const caravanName = user.caravanId ? (await prisma.caravan.findUnique({ where: { id: user.caravanId } }))?.name || null : null;
    
    // Mentor specific data for dual-role
    let mentoredCaravans: any[] = [];
    if (user.isDualRole || user.role === 'mentor') {
      mentoredCaravans = await prisma.caravan.findMany({ where: { mentorId: id } });
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        nationalId: user.nationalId,
        dateOfBirth: user.dateOfBirth,
        city: user.city,
        role: user.role,
        isDualRole: user.isDualRole,
        caravanId: user.caravanId,
        caravanName,
        createdAt: user.createdAt,
        levelFrame: user.levelFrame,
        mentorLevel: user.mentorLevel,
        academicDegree: user.academicDegree,
      },
      metrics: {
        approximateActiveMinutes: activeTimeMinutes,
      },
      watchRecords,
      quizzes,
      assignments,
      tickets,
      certificates,
      mentoredCaravans,
      balances: {
        zarik: user.zarikBalance,
        nakh: user.nakh || 0,
        beyragh: user.beyragh || 0,
        farsh: user.farsh || 0,
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function createUser(req: AuthRequest, res: Response) {
  try {
    const { name, phoneNumber, password, role, caravanId, levelFrame, mentorLevel, nationalId, dateOfBirth } = req.body;

    if (!name || !phoneNumber || !password || !role) {
      return res.status(400).json({ error: 'وارد کردن تمامی فیلدهای اجباری الزامی است' });
    }
    
    // Sanitize phone number
    let sanitizedPhone = phoneNumber.toString().trim().replace(/\s+/g, '');
    if (sanitizedPhone.startsWith('+98')) sanitizedPhone = sanitizedPhone.replace('+98', '0');
    if (sanitizedPhone.startsWith('0098')) sanitizedPhone = sanitizedPhone.replace('0098', '0');
    if (sanitizedPhone.startsWith('9') && sanitizedPhone.length === 10) sanitizedPhone = '0' + sanitizedPhone;

    const existingUser = await prisma.user.findFirst({ where: { phoneNumber: sanitizedPhone } });
    if (existingUser) {
      return res.status(400).json({ error: 'کاربری با این شماره همراه قبلا ثبت نام کرده است' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const maxUser = await prisma.user.findFirst({
      orderBy: { userCode: 'desc' },
      where: { userCode: { not: null } }
    });
    const nextUserCode = maxUser && maxUser.userCode ? maxUser.userCode + 1 : 110100;

    const user = await prisma.user.create({
      data: {
        name,
        phoneNumber: sanitizedPhone,
        passwordHash,
        role,
        caravanId: caravanId || null,
        levelFrame: levelFrame || 1,
        mentorLevel: mentorLevel || 1,
        nationalId: nationalId || null,
        dateOfBirth: dateOfBirth || null,
        identityVerified: true,
        isDualRole: role === 'dual' ? true : false,
        userCode: nextUserCode
      },
    });

    await logAdminAction(
      req.user?.id || 'system',
      req.user?.phoneNumber || 'Admin',
      'CREATE_USER',
      'User',
      user.id,
      `ایجاد کاربر جدید: ${name} با نقش ${role}`,
      req.ip || '127.0.0.1'
    );

    res.status(201).json({ message: 'کاربر با موفقیت ایجاد شد', userId: user.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateUser(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { name, role, caravanId, levelFrame, mentorLevel, nationalId, dateOfBirth, phoneNumber } = req.body;

    const prevUser = await prisma.user.findUnique({ where: { id } });

    const user = await prisma.user.update({
      where: { id },
      data: {
        name,
        role,
        phoneNumber: phoneNumber || undefined,
        caravanId: caravanId !== undefined ? (caravanId || null) : undefined,
        levelFrame: levelFrame ? parseInt(levelFrame) : undefined,
        mentorLevel: mentorLevel ? parseInt(mentorLevel) : undefined,
        nationalId: nationalId || undefined,
        dateOfBirth: dateOfBirth || undefined,
      },
    });

    // Update caravan member counts if caravan changed
    if (prevUser && prevUser.caravanId && prevUser.caravanId !== user.caravanId) {
      const prevCount = await prisma.user.count({ where: { caravanId: prevUser.caravanId } });
      await prisma.caravan.update({ where: { id: prevUser.caravanId }, data: { memberCount: prevCount } }).catch(() => {});
    }
    if (user.caravanId) {
      const newCount = await prisma.user.count({ where: { caravanId: user.caravanId } });
      await prisma.caravan.update({ where: { id: user.caravanId }, data: { memberCount: newCount } }).catch(() => {});
    }

    await logAdminAction(
      req.user?.id || 'system',
      req.user?.phoneNumber || 'Admin',
      'UPDATE_USER',
      'User',
      id,
      `ویرایش مشخصات کاربر: ${name}`,
      req.ip || '127.0.0.1'
    );

    await prisma.notification.create({
      data: {
        userId: id,
        title: 'بروزرسانی حساب کاربری 🔄',
        message: 'مدیریت اطلاعات حساب کاربری شما را ویرایش کرد.',
        type: 'alert'
      }
    });

    res.json({ message: 'مشخصات کاربر با موفقیت ویرایش شد', user });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function toggleBlockUser(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { blocked } = req.body;

    const user = await prisma.user.update({
      where: { id },
      data: { blocked },
    });

    await logAdminAction(
      req.user?.id || 'system',
      req.user?.phoneNumber || 'Admin',
      blocked ? 'BLOCK_USER' : 'UNBLOCK_USER',
      'User',
      id,
      `${blocked ? 'مسدودسازی' : 'رفع مسدودسازی'} کاربر ${user.name}`,
      req.ip || '127.0.0.1'
    );

    res.json({ message: `کاربر با موفقیت ${blocked ? 'مسدود' : 'فعال'} شد` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteUser(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check custom permissions first
    const actorRole = req.user?.role || 'admin';
    const permission = await prisma.rolePermission.findUnique({
      where: { roleName: actorRole },
    });
    if (permission?.lockUserDeletions) {
      return res.status(403).json({ error: 'شما دسترسی حذف کاربر را ندارید' });
    }

    const user = await prisma.user.delete({ where: { id } });

    await logAdminAction(
      req.user?.id || 'system',
      req.user?.phoneNumber || 'Admin',
      'DELETE_USER',
      'User',
      id,
      `حذف کاربر ${user.name}`,
      req.ip || '127.0.0.1'
    );

    res.json({ message: 'کاربر با موفقیت حذف شد' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function overridePasswordOrOtp(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'رمز عبور جدید الزامی است' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const user = await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    await logAdminAction(
      req.user?.id || 'system',
      req.user?.phoneNumber || 'Admin',
      'OVERRIDE_PASSWORD',
      'User',
      id,
      `تغییر رمز عبور کاربر ${user.name}`,
      req.ip || '127.0.0.1'
    );

    res.json({ message: 'گذرواژه با موفقیت بازنویسی شد' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// STREAMING CHUNKED EXPORT TO CSV FOR 500+ RECORDS
export async function exportUsersCsv(req: AuthRequest, res: Response) {
  try {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="users_export.csv"');
    res.setHeader('Transfer-Encoding', 'chunked');

    // UTF-8 BOM for Excel Farsi display
    res.write('\ufeff');
    res.write('شناسه,نام,شماره همراه,نقش,موجودی زریک,سطح,تاریخ ثبت‌نام\n');

    let skip = 0;
    const batchSize = 100;
    let hasMore = true;

    while (hasMore) {
      const users = await prisma.user.findMany({
        take: batchSize,
        skip: skip,
        orderBy: { name: 'asc' },
      });

      if (users.length === 0) {
        hasMore = false;
        break;
      }

      for (const u of users) {
        res.write(`"${u.id}","${u.name}","${u.phoneNumber}","${u.role}",${u.zarikBalance},${u.levelFrame},"${u.createdAt.toISOString()}"\n`);
      }

      skip += batchSize;
    }

    res.end();
  } catch (error: any) {
    console.error('CSV Export Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
}

// 2. ZARIK LEDGER & CATEGORIZED REWARDS
export async function getZarikLedger(req: AuthRequest, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const category = (req.query.category as string) || '';

    const skip = (page - 1) * limit;

    const whereClause: any = {};
    if (category) {
      whereClause.category = category;
    }

    const [transactions, totalCount] = await prisma.$transaction([
      prisma.zarikTransaction.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.zarikTransaction.count({ where: whereClause }),
    ]);

    // Fetch user names for transactions
    const userIds = Array.from(new Set(transactions.map((t) => t.userId)));
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, phoneNumber: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    const enrichedTransactions = transactions.map((t) => {
      const u = userMap.get(t.userId);
      return {
        ...t,
        userName: u?.name || 'کاربر ناشناس',
        userPhone: u?.phoneNumber || 'ناشناس',
      };
    });

    res.json({
      transactions: enrichedTransactions,
      total: totalCount,
      page,
      pages: Math.ceil(totalCount / limit),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getAssetLeaderboard(req: AuthRequest, res: Response) {
  try {
    const students = await prisma.user.findMany({ where: { role: 'student' }, select: { id:true, name:true, phoneNumber:true, zarikBalance:true, nakh:true, beyragh:true, farsh:true } });
    const enriched = students.map(s => ({
      ...s,
      totalAssets: (s.zarikBalance || 0) + (s.nakh || 0) + (s.beyragh || 0) + (s.farsh || 0)
    }));
    enriched.sort((a,b) => b.totalAssets - a.totalAssets);
    res.json(enriched.slice(0, 200));
  } catch (error:any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getRewardRules(req: AuthRequest, res: Response) {
  try {
    const rules = await prisma.rewardRule.findMany({ orderBy: { key: 'asc' } });
    res.json(rules);
  } catch (error:any) {
    res.status(500).json({ error: error.message });
  }
}

export async function upsertRewardRule(req: AuthRequest, res: Response) {
  try {
    const { key, min, max, metadata } = req.body;
    if (!key || typeof min !== 'number' || typeof max !== 'number') return res.status(400).json({ error: 'Invalid payload' });
    const rule = await prisma.rewardRule.upsert({
      where: { key },
      update: { min, max, metadata },
      create: { key, min, max, metadata }
    });
    res.json(rule);
  } catch (error:any) {
    res.status(500).json({ error: error.message });
  }
}

export async function adjustZarik(req: AuthRequest, res: Response) {
  try {
    const { userId, amount, category, reason } = req.body;

    if (!userId || amount === undefined || !category || !reason) {
      return res.status(400).json({ error: 'تمام اطلاعات تراکنش (شناسه کاربر، مقدار، دسته‌بندی و دلیل) الزامی است' });
    }

    // Check permission
    const actorRole = req.user?.role || 'admin';
    const permission = await prisma.rolePermission.findUnique({
      where: { roleName: actorRole },
    });
    if (permission?.restrictZarik) {
      return res.status(403).json({ error: 'شما دسترسی انجام عملیات تراکنش زریک را ندارید' });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return res.status(404).json({ error: 'کاربر مورد نظر یافت نشد' });
    }

    const newBalance = targetUser.zarikBalance + amount;
    if (newBalance < 0) {
      return res.status(400).json({ error: 'موجودی کاربر نمی‌تواند منفی شود' });
    }

    // Transaction execution
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { zarikBalance: newBalance },
      }),
      prisma.zarikTransaction.create({
        data: {
          userId,
          amount,
          category,
          reason,
          createdBy: req.user?.phoneNumber || 'Admin',
        },
      }),
      prisma.notification.create({
        data: {
          userId,
          title: 'تراکنش زریک 💰',
          message: `موجودی شما تغییر کرد. مقدار: ${amount > 0 ? '+' : ''}${amount} زریک. بابت: ${reason}`,
          type: 'reward'
        }
      })
    ]);

    // Invalidate Cache
    zarikAnalyticsCache = null;

    await logAdminAction(
      req.user?.id || 'system',
      req.user?.phoneNumber || 'Admin',
      amount > 0 ? 'DEPOSIT_ZARIK' : 'DEDUCT_ZARIK',
      'User',
      userId,
      `تغییر زریک به مقدار ${amount} در دسته ${category} به دلیل: ${reason}`,
      req.ip || '127.0.0.1'
    );

    res.json({ message: 'تراکنش با موفقیت ثبت و موجودی ویرایش شد', balance: newBalance });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getZarikAnalytics(req: AuthRequest, res: Response) {
  try {
    const now = Date.now();
    if (zarikAnalyticsCache && now < zarikAnalyticsCache.expiry) {
      return res.json(zarikAnalyticsCache.data);
    }

    // Calculate metrics
    const totalCirculation = await prisma.user.aggregate({
      _sum: { zarikBalance: true },
    });

    const topWealthy = await prisma.user.findMany({
      take: 5,
      orderBy: { zarikBalance: 'desc' },
      select: { name: true, zarikBalance: true },
    });

    const categoriesDistribution = await prisma.zarikTransaction.groupBy({
      by: ['category'],
      _sum: { amount: true },
      _count: { id: true },
    });

    const result = {
      circulation: totalCirculation._sum.zarikBalance || 0,
      topWealthy,
      distributions: categoriesDistribution.map((c) => ({
        category: c.category,
        totalAmount: c._sum.amount || 0,
        count: c._count.id,
      })),
      timestamp: new Date(),
    };

    zarikAnalyticsCache = {
      data: result,
      expiry: now + CACHE_TTL,
    };

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getEconomyHub(req: AuthRequest, res: Response) {
  try {
    const aggregates = await prisma.user.aggregate({
      _sum: {
        zarikBalance: true,
        nakh: true,
        beyragh: true,
        farsh: true,
      },
    });

    const topIndividuals = await prisma.user.findMany({
      take: 5,
      orderBy: { zarikBalance: 'desc' },
      select: { name: true, zarikBalance: true, nakh: true, beyragh: true, farsh: true },
    });

    res.json({
      totalZarik: aggregates._sum.zarikBalance || 0,
      totalNakh: aggregates._sum.nakh || 0,
      totalBeyragh: aggregates._sum.beyragh || 0,
      totalFarsh: aggregates._sum.farsh || 0,
      topWealthy: topIndividuals,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// 3. ROLE-BASED ACCESS CONTROL (RBAC)
export async function getRolePermissions(req: AuthRequest, res: Response) {
  try {
    const roles = await prisma.rolePermission.findMany();
    res.json(roles);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateRolePermissions(req: AuthRequest, res: Response) {
  try {
    const { 
      roleName, maskPhoneNumbers, restrictZarik, lockUserDeletions, manageContent,
      manageMentors, manageStudents, manageCaravans, manageSystem,
      canSendMessage, canJoinClasses, canScoreAndEvaluate, canConvertAssets,
      canCreateChallenges, canViewGlobalAnalytics, canManageUsers
    } = req.body;

    const data = {
      maskPhoneNumbers, restrictZarik, lockUserDeletions, manageContent,
      manageMentors, manageStudents, manageCaravans, manageSystem,
      canSendMessage, canJoinClasses, canScoreAndEvaluate, canConvertAssets,
      canCreateChallenges, canViewGlobalAnalytics, canManageUsers
    };

    const updated = await prisma.rolePermission.upsert({
      where: { roleName },
      update: data,
      create: { roleName, ...data },
    });

    await logAdminAction(
      req.user?.id || 'system',
      req.user?.phoneNumber || 'Admin',
      'UPDATE_RBAC',
      'RolePermission',
      roleName,
      `بروزرسانی دسترسی‌های نقش ${roleName}`,
      req.ip || '127.0.0.1',
      req.user?.role || 'admin'
    );

    res.json({ message: 'دسترسی نقش با موفقیت بروزرسانی شد', role: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// 4. CARAVANS & MENTORS OPERATIONS CENTER
export async function getCaravansAdmin(req: AuthRequest, res: Response) {
  try {
    const userRole = req.user?.role;
    const isMentor = userRole === 'mentor';
    
    let whereClause: any = { isDeleted: false };
    if (isMentor) {
      whereClause.mentorId = req.user?.id;
    }
    
    const caravans = await prisma.caravan.findMany({
      where: whereClause,
      include: {
        mentor: { select: { id: true, name: true, phoneNumber: true, userCode: true } },
        _count: { select: { members: { where: { isDeleted: false } } } },
        members: {
          where: { isDeleted: false },
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            userCode: true,
            role: true,
            levelFrame: true,
            zarikBalance: true,
            nakh: true,
            beyragh: true,
            farsh: true,
            sessionWatchRecords: { select: { watchedPercentage: true } },
            quizSubmissions: { select: { score: true } }
          }
        }
      },
    });

    const enrichedCaravans = caravans.map(c => {
      const activeMembers = c.members || [];
      const realMemberCount = c._count?.members || activeMembers.length;
      
      let totalZarik = 0, totalNakh = 0, totalBeyragh = 0, totalFarsh = 0;
      let totalProgressSum = 0;

      activeMembers.forEach(m => {
        totalZarik += m.zarikBalance || 0;
        totalNakh += m.nakh || 0;
        totalBeyragh += m.beyragh || 0;
        totalFarsh += m.farsh || 0;

        const watchScores = m.sessionWatchRecords?.reduce((s: any, w: any) => s + (w.watchedPercentage || 0), 0) || 0;
        const quizScores = m.quizSubmissions?.reduce((s: any, q: any) => s + (q.score || 0), 0) || 0;
        totalProgressSum += (watchScores + quizScores);
      });

      const overallProgress = activeMembers.length > 0 ? Math.min(100, Math.round(totalProgressSum / (activeMembers.length * 100))) : 0;

      return {
        ...c,
        mentorName: c.mentor?.name || 'بدون راهبر',
        memberCount: activeMembers.length || 0,
        _count: c._count,
        membersList: activeMembers || [],
        totalWealth: totalZarik,
        wealth: {
          zarik: totalZarik,
          nakh: totalNakh,
          beyragh: totalBeyragh,
          farsh: totalFarsh
        },
        overallProgress
      };
    });

    res.json(enrichedCaravans);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getMentorScorecards(req: AuthRequest, res: Response) {
  try {
    const mentors = await prisma.user.findMany({
      where: { role: 'mentor' },
      include: {
        ratingsReceived: true,
        mentoredCaravans: true,
      },
    });

    const scorecards = await Promise.all(
      mentors.map(async (m) => {
        // Satisfaction rating average
        const totalRatings = m.ratingsReceived.length;
        const avgRating =
          totalRatings > 0
            ? parseFloat(
                (
                  m.ratingsReceived.reduce((sum, r) => sum + r.ratingValue, 0) /
                  totalRatings
                ).toFixed(2)
              )
            : 5.0;

        // Pending reviews count
        const pendingCount = await prisma.submission.count({
          where: {
            challenge: { createdByMentorId: m.id },
            status: 'pending',
          },
        });

        return {
          id: m.id,
          name: m.name,
          avgRating,
          totalRatings,
          pendingReviews: pendingCount,
          caravansCount: m.mentoredCaravans.length,
          academicDegree: m.academicDegree,
          academicCertificates: m.academicCertificates,
        };
      })
    );

    res.json(scorecards);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// ======================= MENTOR DOSSIER & MODERATION ======================= //

export async function getMentorDossier(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const mentor = await prisma.user.findUnique({
      where: { id },
      include: {
        mentoredCaravans: true,
        ratingsReceived: true,
      }
    });

    if (!mentor) {
      return res.status(404).json({ error: 'راهبر مورد نظر یافت نشد' });
    }

    // Get challenges created by mentor
    const challenges = await prisma.challenge.findMany({
      where: { createdByMentorId: id },
      include: {
        submissions: { select: { status: true } }
      }
    });

    // Compute stats
    let totalScore = 0;
    mentor.ratingsReceived.forEach((r) => totalScore += r.ratingValue);
    const avgRating = mentor.ratingsReceived.length > 0 ? (totalScore / mentor.ratingsReceived.length).toFixed(1) : '0.0';

    const challengeOperations = challenges.map((ch) => {
      const reviewed = ch.submissions.filter((s) => s.status !== 'pending').length;
      const pending = ch.submissions.filter((s) => s.status === 'pending').length;
      return {
        id: ch.id,
        title: ch.title,
        type: ch.type,
        createdAt: ch.createdAt,
        reward: ch.rewardZarik,
        stats: { reviewed, pending, total: ch.submissions.length }
      };
    });

    // Group ratings by caravan if any logic required, here we just return all ratings
    res.json({
      identity: {
        name: mentor.name,
        phoneNumber: mentor.phoneNumber,
        nationalId: mentor.nationalId,
        dateOfBirth: mentor.dateOfBirth,
        academicDegree: mentor.academicDegree,
        academicCertificates: mentor.academicCertificates,
        accountStatus: mentor.accountStatus,
        isDeleted: mentor.isDeleted,
        suspendedUntil: mentor.suspendedUntil
      },
      caravans: mentor.mentoredCaravans.map((c) => ({
        id: c.id,
        name: c.name,
        memberCount: c.memberCount,
        progress: c.overallProgress
      })),
      satisfaction: {
        avgRating,
        totalRatings: mentor.ratingsReceived.length,
        breakdown: mentor.ratingsReceived // Simplified, the UI can render
      },
      challenges: challengeOperations
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function moderateMentor(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { action, suspendedUntil } = req.body; // action: 'soft_delete', 'permanent_suspend', 'temp_suspend'

    if (!['soft_delete', 'permanent_suspend', 'temp_suspend'].includes(action)) {
      return res.status(400).json({ error: 'عملیات نامعتبر است' });
    }

    if (action === 'soft_delete') {
      await prisma.user.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date() }
      });
      // Optionally revoke sessions
      await prisma.userSession.deleteMany({ where: { userId: id } });
    } else if (action === 'permanent_suspend') {
      await prisma.user.update({
        where: { id },
        data: { accountStatus: 'SUSPENDED' }
      });
      // Invalidate active sessions
      await prisma.userSession.deleteMany({ where: { userId: id } });
    } else if (action === 'temp_suspend') {
      if (!suspendedUntil) {
        return res.status(400).json({ error: 'تاریخ پایان مسدودسازی الزامی است' });
      }
      await prisma.user.update({
        where: { id },
        data: { suspendedUntil: new Date(suspendedUntil) }
      });
      // Invalidate active sessions
      await prisma.userSession.deleteMany({ where: { userId: id } });
    }

    await logAdminAction(
      req.user?.id || 'system',
      req.user?.phoneNumber || 'Admin',
      'MODERATE_MENTOR',
      'User',
      id,
      `عملیات مدیریت وضعیت راهبر: ${action}`,
      req.ip || '127.0.0.1'
    );

    res.json({ success: true, message: 'عملیات با موفقیت انجام شد' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateMentor(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const {
      name,
      nationalId,
      phoneNumber,
      dateOfBirth,
      city,
      socialMessengerHandle,
      socialPlatform,
      accountStatus,
      mentorLevel,
      caravanIds
    } = req.body;

    const mentor = await prisma.user.findUnique({ where: { id } });
    if (!mentor || !['mentor', 'SUPER_MENTOR'].includes(mentor.role)) {
      return res.status(404).json({ error: 'راهبر یافت نشد' });
    }

    const data: any = {
      name,
      nationalId,
      phoneNumber,
      dateOfBirth,
      city,
      socialMessengerHandle,
      socialPlatform,
      accountStatus,
      mentorLevel: parseInt(mentorLevel) || 1
    };

    if (Array.isArray(caravanIds)) {
      data.mentoredCaravans = {
        set: caravanIds.map((cId: string) => ({ id: cId }))
      };
    }

    const updatedMentor = await prisma.user.update({
      where: { id },
      data,
      include: { mentoredCaravans: true }
    });

    await sendSystemNotification(id, 'به‌روزرسانی پروفایل', 'پروفایل شما توسط مدیریت به‌روزرسانی شد.', 'info');

    res.json({ success: true, mentor: updatedMentor });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// 5. EDUCATIONAL CONTENT & GLOBAL ANNOUNCEMENTS
export async function createGlobalAnnouncement(req: AuthRequest, res: Response) {
  try {
    const { title, message, caravanId } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: 'عنوان و متن اطلاعیه الزامی است' });
    }

    let targetUsers: string[] = [];

    if (caravanId) {
      const users = await prisma.user.findMany({
        where: { caravanId },
        select: { id: true },
      });
      targetUsers = users.map((u) => u.id);
    } else {
      const users = await prisma.user.findMany({
        select: { id: true },
      });
      targetUsers = users.map((u) => u.id);
    }

    const notificationsData = targetUsers.map((uid) => ({
      userId: uid,
      title,
      message,
      type: 'alert',
    }));

    await prisma.notification.createMany({
      data: notificationsData,
    });

    await logAdminAction(
      req.user?.id || 'system',
      req.user?.phoneNumber || 'Admin',
      'BROADCAST_ANNOUNCEMENT',
      'Notification',
      'global',
      `ارسال اطلاعیه: ${title} به ${targetUsers.length} کاربر`,
      req.ip || '127.0.0.1'
    );

    res.json({ message: 'اطلاعیه با موفقیت برای کاربران ارسال شد' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// 6. SYSTEM AUDIT LOGS
export async function getAuditLogs(req: AuthRequest, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const action = (req.query.action as string) || '';
    const actorRole = (req.query.actorRole as string) || '';
    const search = (req.query.search as string) || '';

    const skip = (page - 1) * limit;

    const whereClause: any = {};
    if (action) {
      whereClause.action = action;
    }
    if (actorRole) {
      whereClause.actorRole = actorRole;
    }
    if (search) {
      whereClause.OR = [
        { actorName: { contains: search } },
        { details: { contains: search } }
      ];
    }

    const [logs, totalCount] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where: whereClause }),
    ]);

    res.json({
      logs,
      total: totalCount,
      page,
      pages: Math.ceil(totalCount / limit),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// 7. MENTOR EVALUATIONS & PERKS
export async function getMentorEvaluations(req: AuthRequest, res: Response) {
  try {
    const mentors = await prisma.user.findMany({
      where: { role: 'mentor' },
      include: {
        mentoredCaravans: { select: { id: true, name: true, memberCount: true } },
        ratingsReceived: { select: { ratingValue: true } }
      }
    });

    const evaluatedMentors = mentors.map(m => {
      const avgRating = m.ratingsReceived.length > 0 
        ? m.ratingsReceived.reduce((sum, r) => sum + r.ratingValue, 0) / m.ratingsReceived.length
        : 0;
      return {
        id: m.id,
        name: m.name,
        mentorLevel: m.mentorLevel,
        activeCaravans: m.mentoredCaravans.length,
        avgRating: avgRating.toFixed(1),
        totalRatings: m.ratingsReceived.length,
        // Mock task velocity for now
        taskVelocity: (Math.random() * (48 - 12) + 12).toFixed(1) + ' hrs'
      };
    });

    // Rank mentors by avg rating
    evaluatedMentors.sort((a, b) => parseFloat(b.avgRating) - parseFloat(a.avgRating));
    
    // Assign global rank
    const rankedMentors = evaluatedMentors.map((m, idx) => ({ ...m, globalRank: idx + 1 }));

    res.json(rankedMentors);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function grantUserLevel(req: AuthRequest, res: Response) {
  try {
    const { targetUserId, levelFrame, zarikBonus } = req.body;
    
    const user = await prisma.user.update({
      where: { id: targetUserId },
      data: {
        levelFrame,
        zarikBalance: { increment: zarikBonus || 0 }
      }
    });

    await logAdminAction(
      req.user?.id || 'system',
      req.user?.phoneNumber || 'Admin',
      'GRANT_LEVEL',
      'User',
      targetUserId,
      `ارتقا سطح به ${levelFrame} و هدیه زریک ${zarikBonus}`,
      req.ip || '127.0.0.1'
    );

    await prisma.notification.create({
      data: {
        userId: targetUserId,
        title: 'ارتقا سطح کاربری 🌟',
        message: `سطح کاربری شما به قاب ${levelFrame} ارتقا یافت!${zarikBonus ? ` و ${zarikBonus} زریک پاداش گرفتید.` : ''}`,
        type: 'reward'
      }
    });

    res.json({ message: 'عملیات با موفقیت انجام شد', data: user });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function setAccountStatus(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    const user = await prisma.user.update({
      where: { id },
      data: { accountStatus: status }
    });
    await logAdminAction(
      req.user?.id || 'system',
      req.user?.phoneNumber || 'Admin',
      'SET_ACCOUNT_STATUS',
      'User',
      user.id,
      `تغییر وضعیت به ${status}: ${reason || 'بدون دلیل'}`,
      req.ip || '127.0.0.1'
    );
    res.json({ success: true, message: 'وضعیت حساب بروزرسانی شد', user });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export const getLevelsAndCertificates = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: 'student' },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        levelFrame: true,
        registrationCompleted: true,
        certificates: {
          orderBy: { issuedAt: 'desc' },
          take: 1
        },
        physicalOrders: {
          include: { certificate: true }
        }
      }
    });

    res.json({ success: true, data: users });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
