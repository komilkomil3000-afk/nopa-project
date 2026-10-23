"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteInstructor = exports.createOrUpdateInstructor = exports.getInstructorById = exports.getInstructors = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getInstructors = async (req, res) => {
    try {
        const search = req.query.search;
        const where = {};
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
    }
    catch (error) {
        console.error('getInstructors error:', error);
        res.status(500).json({ error: error.message || 'خطا در دریافت لیست اساتید' });
    }
};
exports.getInstructors = getInstructors;
const getInstructorById = async (req, res) => {
    try {
        const { id } = req.params;
        const instructor = await prisma.instructor.findUnique({
            where: { id }
        });
        if (!instructor) {
            return res.status(404).json({ error: 'استاد مورد نظر یافت نشد' });
        }
        res.json({ success: true, data: instructor });
    }
    catch (error) {
        console.error('getInstructorById error:', error);
        res.status(500).json({ error: error.message || 'خطای سرور' });
    }
};
exports.getInstructorById = getInstructorById;
const createOrUpdateInstructor = async (req, res) => {
    try {
        const { id, name, nationalId, phoneNumber, degree, resume, description, classes, avatarUrl, isActive, orderIndex } = req.body;
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'نام و نام‌خانوادگی استاد الزامی است' });
        }
        const data = {
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
        }
        else {
            result = await prisma.instructor.create({
                data
            });
        }
        res.json({ success: true, message: 'اطلاعات استاد با موفقیت ذخیره شد', data: result });
    }
    catch (error) {
        console.error('createOrUpdateInstructor error:', error);
        res.status(500).json({ error: error.message || 'خطا در ذخیره‌سازی اطلاعات استاد' });
    }
};
exports.createOrUpdateInstructor = createOrUpdateInstructor;
const deleteInstructor = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.instructor.delete({
            where: { id }
        });
        res.json({ success: true, message: 'استاد با موفقیت حذف شد' });
    }
    catch (error) {
        console.error('deleteInstructor error:', error);
        res.status(500).json({ error: error.message || 'خطا در حذف استاد' });
    }
};
exports.deleteInstructor = deleteInstructor;
