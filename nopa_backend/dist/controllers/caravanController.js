"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleCaravanStatus = toggleCaravanStatus;
exports.bulkTransferMembers = bulkTransferMembers;
exports.convertAssets = convertAssets;
exports.approveAssetConversion = approveAssetConversion;
exports.getAssetConversionsAdmin = getAssetConversionsAdmin;
exports.createCaravan = createCaravan;
exports.getCaravanDetails = getCaravanDetails;
exports.addMemberToCaravan = addMemberToCaravan;
exports.removeMemberFromCaravan = removeMemberFromCaravan;
exports.transferMember = transferMember;
exports.broadcastToCaravan = broadcastToCaravan;
exports.getCaravanRequests = getCaravanRequests;
exports.updateCaravan = updateCaravan;
exports.bulkAddMembersToCaravan = bulkAddMembersToCaravan;
exports.deleteCaravan = deleteCaravan;
exports.blockCaravanMembers = blockCaravanMembers;
const client_1 = require("@prisma/client");
const adminController_1 = require("./adminController");
const prisma = new client_1.PrismaClient();
async function toggleCaravanStatus(req, res) {
    try {
        const { id } = req.params;
        const caravan = await prisma.caravan.findUnique({ where: { id } });
        if (!caravan)
            return res.status(404).json({ error: 'کاروان یافت نشد' });
        const newStatus = caravan.status === 'active' ? 'suspended' : 'active';
        await prisma.caravan.update({
            where: { id },
            data: { status: newStatus }
        });
        await (0, adminController_1.logAdminAction)(req.user.id, 'Admin', 'TOGGLE_CARAVAN_STATUS', 'Caravan', id, `Set status to ${newStatus}`, req.ip || '');
        res.json({ message: `وضعیت کاروان به ${newStatus} تغییر یافت.` });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function bulkTransferMembers(req, res) {
    try {
        const { userIds, targetCaravanId } = req.body;
        if (!Array.isArray(userIds) || targetCaravanId === undefined) {
            return res.status(400).json({ error: 'لیست کاربران و شناسه کاروان مقصد الزامی است' });
        }
        if (targetCaravanId !== null) {
            const targetCaravan = await prisma.caravan.findUnique({ where: { id: targetCaravanId } });
            if (!targetCaravan)
                return res.status(404).json({ error: 'کاروان مقصد یافت نشد' });
        }
        await prisma.user.updateMany({
            where: { id: { in: userIds } },
            data: { caravanId: targetCaravanId }
        });
        // Update member counts (approximate, or recalculate)
        await (0, adminController_1.logAdminAction)(req.user.id, 'Admin', 'BULK_TRANSFER', 'Caravan', targetCaravanId || 'UNASSIGNED', `Transferred ${userIds.length} users`, req.ip || '');
        res.json({ message: 'اعضا با موفقیت منتقل شدند.' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function convertAssets(req, res) {
    try {
        if (!req.user || req.user.role !== 'mentor') {
            return res.status(403).json({ error: 'تنها راهبران مجاز به ثبت درخواست تبدیل هستند' });
        }
        const mentor = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!mentor || !mentor.caravanId)
            return res.status(404).json({ error: 'کاربر یا کاروان یافت نشد' });
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function approveAssetConversion(req, res) {
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
        }
        else {
            await prisma.assetConversionRequest.update({
                where: { id },
                data: { status: 'rejected', note: note || 'رد شد' }
            });
        }
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function getAssetConversionsAdmin(req, res) {
    try {
        const requests = await prisma.assetConversionRequest.findMany({
            include: {
                caravan: { select: { name: true } },
                user: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(requests);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function createCaravan(req, res) {
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
        await (0, adminController_1.logAdminAction)(req.user.id, 'Admin', 'CREATE_CARAVAN', 'Caravan', caravan.id, `Created caravan ${name}`, req.ip || '');
        res.json({ success: true, caravan });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function getCaravanDetails(req, res) {
    const { id } = req.params;
    try {
        const caravan = await prisma.caravan.findUnique({
            where: { id },
            include: {
                mentor: true,
                members: {
                    where: { isDeleted: false },
                    select: { id: true, name: true, phoneNumber: true, userCode: true, zarikBalance: true, role: true, levelFrame: true }
                }
            }
        });
        if (!caravan)
            return res.status(404).json({ error: 'کاروان یافت نشد' });
        const membersList = caravan.members || [];
        const totalWealth = membersList.reduce((acc, u) => acc + (u.zarikBalance || 0), 0);
        return res.json({
            ...caravan,
            mentorName: caravan.mentor?.name || 'فاقد راهبر',
            membersList,
            memberCount: membersList.length,
            totalWealth
        });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'خطای سرور' });
    }
}
async function addMemberToCaravan(req, res) {
    try {
        const { id, studentId } = req.params;
        const caravan = await prisma.caravan.findUnique({ where: { id }, include: { members: true } });
        if (!caravan)
            return res.status(404).json({ error: 'کاروان یافت نشد' });
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function removeMemberFromCaravan(req, res) {
    try {
        const { id, studentId } = req.params;
        await prisma.user.update({
            where: { id: studentId },
            data: { caravanId: null }
        });
        const caravan = await prisma.caravan.findUnique({ where: { id }, include: { members: true } });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function transferMember(req, res) {
    try {
        const { studentId, targetCaravanId } = req.body;
        const targetCaravan = await prisma.caravan.findUnique({ where: { id: targetCaravanId }, include: { members: true } });
        if (!targetCaravan)
            return res.status(404).json({ error: 'کاروان مقصد یافت نشد' });
        if (targetCaravan.members.length >= targetCaravan.capacityLimit) {
            return res.status(400).json({ error: `ظرفیت این کاروان تکمیل شده است (حداکثر ${targetCaravan.capacityLimit} نفر)` });
        }
        await prisma.user.update({
            where: { id: studentId },
            data: { caravanId: targetCaravanId }
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function broadcastToCaravan(req, res) {
    try {
        const { id } = req.params;
        const { message, title } = req.body;
        const caravan = await prisma.caravan.findUnique({ where: { id }, include: { members: true } });
        if (!caravan)
            return res.status(404).json({ error: 'کاروان یافت نشد' });
        const notifications = caravan.members.map(m => ({
            userId: m.id,
            title: title || 'پیام راهبر کاروان',
            message,
            type: 'alert'
        }));
        await prisma.notification.createMany({ data: notifications });
        await (0, adminController_1.logAdminAction)(req.user.id, 'Admin', 'BROADCAST_CARAVAN', 'Caravan', id, `Broadcasted: ${title}`, req.ip || '');
        res.json({ success: true, count: notifications.length });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function getCaravanRequests(req, res) {
    try {
        const isMentor = req.user?.role === 'mentor';
        let whereAsset = { status: 'pending' };
        let whereTicket = { category: 'Caravan Transfer' };
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function updateCaravan(req, res) {
    const { id } = req.params;
    const { mentorId, name, capacityLimit, description } = req.body;
    try {
        const dataToUpdate = {};
        if (mentorId !== undefined)
            dataToUpdate.mentorId = mentorId || null;
        if (name !== undefined)
            dataToUpdate.name = name;
        if (capacityLimit !== undefined)
            dataToUpdate.capacityLimit = Number(capacityLimit);
        if (description !== undefined)
            dataToUpdate.description = description;
        const updated = await prisma.caravan.update({
            where: { id },
            data: dataToUpdate,
            include: { mentor: true }
        });
        res.json({ message: 'کاروان با موفقیت بروزرسانی شد', caravan: updated });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function bulkAddMembersToCaravan(req, res) {
    const caravanId = req.params.id || req.params.caravanId;
    const { userIds } = req.body;
    if (!caravanId) {
        return res.status(400).json({ error: 'شناسه کاروان مشخص نشده است' });
    }
    if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: 'حداقل یک کاربر برای افزودن به کاروان انتخاب کنید' });
    }
    try {
        await prisma.user.updateMany({
            where: { id: { in: userIds } },
            data: { caravanId }
        });
        const memberCount = await prisma.user.count({ where: { caravanId } });
        await prisma.caravan.update({
            where: { id: caravanId },
            data: { memberCount }
        });
        res.json({ message: 'اعضا با موفقیت به کاروان اضافه شدند', memberCount });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function deleteCaravan(req, res) {
    try {
        const { id } = req.params;
        const caravan = await prisma.caravan.findUnique({ where: { id } });
        if (!caravan)
            return res.status(404).json({ error: 'کاروان یافت نشد.' });
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
        await (0, adminController_1.logAdminAction)(req.user.id, 'Admin', 'DELETE_CARAVAN', 'Caravan', id, 'Soft deleted caravan and released members', req.ip || '');
        res.json({ message: 'کاروان با موفقیت حذف شد و اعضای آن آزاد شدند.' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function blockCaravanMembers(req, res) {
    try {
        const { id } = req.params;
        const caravan = await prisma.caravan.findUnique({ where: { id } });
        if (!caravan)
            return res.status(404).json({ error: 'کاروان یافت نشد.' });
        // Block all members of this caravan
        await prisma.user.updateMany({
            where: { caravanId: id },
            data: { blocked: true }
        });
        await (0, adminController_1.logAdminAction)(req.user.id, 'Admin', 'BLOCK_CARAVAN_MEMBERS', 'Caravan', id, 'Blocked all members of caravan', req.ip || '');
        res.json({ message: 'تمامی اعضای این کاروان مسدود شدند.' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
