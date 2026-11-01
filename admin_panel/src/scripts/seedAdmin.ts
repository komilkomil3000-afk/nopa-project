import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedDirectAdmin() {
  // No hard-coded credentials: both values must be supplied explicitly.
  const adminPhone = process.env.ADMIN_SEED_PHONE;
  const adminPassword = process.env.ADMIN_SEED_PASSWORD;
  if (!adminPhone || !adminPassword || adminPassword.length < 10) {
    throw new Error('Set ADMIN_SEED_PHONE and ADMIN_SEED_PASSWORD (min 10 chars) before running this script');
  }
  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  
  // Look up existing to handle the fact that phoneNumber might not be marked @unique in schema
  const existing = await prisma.user.findFirst({
    where: { phoneNumber: adminPhone }
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash: hashedPassword,
        role: 'admin',
        isDeleted: false,
        accountStatus: 'ACTIVE',
        blocked: false,
        suspendedUntil: null
      }
    });
  } else {
    await prisma.user.create({
      data: {
        phoneNumber: adminPhone,
        name: 'مدیر ارشد',
        passwordHash: hashedPassword,
        role: 'admin',
        isDeleted: false,
        accountStatus: 'ACTIVE',
        blocked: false,
        levelFrame: 1,
        zarikBalance: 10000,
        userCode: 100001
      }
    });
  }

  // Also ensure RolePermission for admin exists
  await prisma.rolePermission.upsert({
    where: { roleName: 'admin' },
    update: {
      manageContent: true,
      manageMentors: true,
      manageStudents: true,
      manageCaravans: true,
      manageSystem: true,
      canSendMessage: true,
      canManageUsers: true,
      canViewGlobalAnalytics: true
    },
    create: {
      roleName: 'admin',
      manageContent: true,
      manageMentors: true,
      manageStudents: true,
      manageCaravans: true,
      manageSystem: true,
      canSendMessage: true,
      canManageUsers: true,
      canViewGlobalAnalytics: true
    }
  });

  console.log(`✅ Admin ${adminPhone} guaranteed`);
}

seedDirectAdmin().finally(() => prisma.$disconnect());
