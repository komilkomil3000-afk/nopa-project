import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('123456', 10);
  
  const existing = await prisma.user.findFirst({
    where: { phoneNumber: '09120000001' }
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash: hash,
        role: 'admin',
        blocked: false,
        isDeleted: false,
        accountStatus: 'ACTIVE',
        identityVerified: true,
        failedLoginAttempts: 0,
        lockoutUntil: null,
        suspendedUntil: null
      }
    });
  } else {
    await prisma.user.create({
      data: {
        phoneNumber: '09120000001',
        name: 'Admin',
        passwordHash: hash,
        role: 'admin',
        blocked: false,
        isDeleted: false,
        accountStatus: 'ACTIVE',
        identityVerified: true,
        userCode: 999999
      }
    });
  }

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

  console.log('Admin seeded and permissions granted');
}

main().finally(() => prisma.$disconnect());
