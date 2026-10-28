import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedDirectAdmin() {
  const hashedPassword = await bcrypt.hash('123456', 10);
  
  // Look up existing to handle the fact that phoneNumber might not be marked @unique in schema
  const existing = await prisma.user.findFirst({
    where: { phoneNumber: '09380346668' }
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
        phoneNumber: '09380346668',
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

  console.log('✅ Admin 09380346668 guaranteed with password 123456');
}

seedDirectAdmin().finally(() => prisma.$disconnect());
