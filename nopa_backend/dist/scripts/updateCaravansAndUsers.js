"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Starting Caravan and User update script...');
    const passwordHash = await bcrypt.hash('123456', 10);
    // Preserve Super Admins
    // Assuming '09120000001' and '09380346668' are the super admins from the initial seed
    const superAdminPhones = ['09120000001', '09380346668'];
    // List of new required phones to keep
    const requiredPhones = [
        '09196657042', // علیرضا خوشمنظر
        '09102517714', // عرفان پیروی
        '09961230588', // رضا شفیعی
        '09050421242', // طیب جوشقانی
        '09194403070', // طیب علی روغنی
        '09036658547', // حسینعلی
        ...superAdminPhones
    ];
    const mentorKoveytiPhone = '09200000001';
    const mentorJalaliPhone = '09200000002';
    requiredPhones.push(mentorKoveytiPhone, mentorJalaliPhone);
    console.log('Cleaning up old users and caravans...');
    // Clean caravans
    await prisma.caravan.deleteMany({});
    // Clean non-required users
    // To avoid breaking constraints, just delete all users except required ones
    await prisma.user.deleteMany({
        where: {
            phoneNumber: {
                notIn: requiredPhones
            }
        }
    });
    // Upsert Users
    console.log('Upserting Users...');
    async function upsertUser(phone, updateData, createData) {
        const existing = await prisma.user.findFirst({ where: { phoneNumber: phone } });
        if (existing) {
            return await prisma.user.update({ where: { id: existing.id }, data: updateData });
        }
        else {
            return await prisma.user.create({ data: createData });
        }
    }
    // 1. Admins
    const alireza = await upsertUser('09196657042', { name: 'علیرضا خوشمنظر', role: 'admin', zarikBalance: 0, levelFrame: 1 }, { phoneNumber: '09196657042', name: 'علیرضا خوشمنظر', role: 'admin', passwordHash, zarikBalance: 0, levelFrame: 1, identityVerified: true });
    // 2. Mentors
    const mentorKoveyti = await upsertUser(mentorKoveytiPhone, { name: 'محمد کویتی', role: 'mentor', zarikBalance: 0, levelFrame: 1 }, { phoneNumber: mentorKoveytiPhone, name: 'محمد کویتی', role: 'mentor', passwordHash, zarikBalance: 0, levelFrame: 1, identityVerified: true });
    const mentorJalali = await upsertUser(mentorJalaliPhone, { name: 'رضا جلالی', role: 'mentor', zarikBalance: 0, levelFrame: 1 }, { phoneNumber: mentorJalaliPhone, name: 'رضا جلالی', role: 'mentor', passwordHash, zarikBalance: 0, levelFrame: 1, identityVerified: true });
    // Super admin fetch to set as mentor for "کاروان مدیر ارشد"
    const superAdmin = await prisma.user.findFirst({ where: { role: 'admin', name: 'مدیر ارشد' } });
    // Upsert Caravans
    console.log('Upserting Caravans...');
    const caravanKoveyti = await prisma.caravan.create({
        data: {
            name: 'کاروان کویتی',
            mentorId: mentorKoveyti.id,
            memberCount: 0,
            overallProgress: 0,
            groupPoints: 0,
        }
    });
    const caravanJalali = await prisma.caravan.create({
        data: {
            name: 'کاروان جلالی',
            mentorId: mentorJalali.id,
            memberCount: 0,
            overallProgress: 0,
            groupPoints: 0,
        }
    });
    const caravanModir = await prisma.caravan.create({
        data: {
            name: 'کاروان مدیر ارشد',
            mentorId: superAdmin?.id,
            memberCount: 0,
            overallProgress: 0,
            groupPoints: 0,
        }
    });
    // 3. Students
    console.log('Upserting Students...');
    const students = [
        { name: 'عرفان پیروی', phone: '09102517714', caravanId: caravanKoveyti.id },
        { name: 'رضا شفیعی', phone: '09961230588', caravanId: caravanKoveyti.id },
        { name: 'طیب جوشقانی', phone: '09050421242', caravanId: caravanJalali.id },
        { name: 'طیب علی روغنی', phone: '09194403070', caravanId: caravanJalali.id },
        { name: 'حسینعلی', phone: '09036658547', caravanId: caravanModir.id },
    ];
    for (const st of students) {
        await upsertUser(st.phone, { name: st.name, role: 'student', zarikBalance: 0, levelFrame: 1, caravanId: st.caravanId }, { phoneNumber: st.phone, name: st.name, role: 'student', passwordHash, zarikBalance: 0, levelFrame: 1, caravanId: st.caravanId, identityVerified: true });
    }
    // Update Caravan Member Counts
    await prisma.caravan.update({ where: { id: caravanKoveyti.id }, data: { memberCount: 2 } });
    await prisma.caravan.update({ where: { id: caravanJalali.id }, data: { memberCount: 2 } });
    await prisma.caravan.update({ where: { id: caravanModir.id }, data: { memberCount: 1 } });
    // Update existing Super Admin Zarik to 0 if instructed (the prompt says: "Ensure all members start with zarikBalance: 0")
    if (superAdmin) {
        await prisma.user.update({
            where: { id: superAdmin.id },
            data: { zarikBalance: 0, levelFrame: 1 }
        });
    }
    console.log('✅ Update completed successfully!');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
