"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrUpdateClass = exports.createSubCourse = exports.createPackage = exports.getCourseHierarchy = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// Get full course hierarchy (Packages -> SubCourses -> Classes)
const getCourseHierarchy = async (req, res) => {
    try {
        const packages = await prisma.coursePackage.findMany({
            include: {
                subCourses: {
                    include: {
                        classes: {
                            include: {
                                sessions: {
                                    include: {
                                        assignment: true
                                    }
                                },
                                assignments: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'asc' }
        });
        res.json(packages);
    }
    catch (error) {
        console.error('getCourseHierarchy Error:', error);
        res.status(500).json({ error: 'خطای سرور' });
    }
};
exports.getCourseHierarchy = getCourseHierarchy;
// Create Course Package
const createPackage = async (req, res) => {
    try {
        const { title, description } = req.body;
        const pkg = await prisma.coursePackage.create({
            data: { title, description }
        });
        res.status(201).json({ message: 'پکیج با موفقیت ایجاد شد', data: pkg });
    }
    catch (error) {
        console.error('createPackage Error:', error);
        res.status(500).json({ error: 'خطای سرور' });
    }
};
exports.createPackage = createPackage;
// Create Sub-Course Station
const createSubCourse = async (req, res) => {
    try {
        const { packageId, title, prerequisiteId, releaseDate, releaseTime } = req.body;
        const sub = await prisma.subCourseStation.create({
            data: { packageId, title, prerequisiteId, releaseDate: releaseDate ? new Date(releaseDate) : null, releaseTime }
        });
        res.status(201).json({ message: 'منزلگاه ایجاد شد', data: sub });
    }
    catch (error) {
        console.error('createSubCourse Error:', error);
        res.status(500).json({ error: 'خطای سرور' });
    }
};
exports.createSubCourse = createSubCourse;
// Create or Link Class to SubCourse
const createOrUpdateClass = async (req, res) => {
    try {
        const { id, subCourseId, title, teacher, bio, videoUrl, unlockCostZarik, releaseDate, releaseTime } = req.body;
        let courseClass;
        if (id) {
            // Update existing class
            courseClass = await prisma.courseClass.update({
                where: { id },
                data: { subCourseId, title, teacher, bio, videoUrl, unlockCostZarik, releaseDate: releaseDate ? new Date(releaseDate) : null, releaseTime }
            });
        }
        else {
            // Create new class
            courseClass = await prisma.courseClass.create({
                data: { subCourseId, title, teacher, bio, videoUrl, unlockCostZarik, releaseDate: releaseDate ? new Date(releaseDate) : null, releaseTime }
            });
        }
        res.json({ message: 'کلاس با موفقیت ثبت/ویرایش شد', data: courseClass });
    }
    catch (error) {
        console.error('createOrUpdateClass Error:', error);
        res.status(500).json({ error: 'خطای سرور' });
    }
};
exports.createOrUpdateClass = createOrUpdateClass;
