"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClasses = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getClasses = async (req, res) => {
    try {
        const classes = await prisma.courseClass.findMany({
            orderBy: { createdAt: 'asc' },
        });
        res.json(classes);
    }
    catch (error) {
        console.error('Error fetching classes:', error);
        res.status(500).json({ error: 'Failed to fetch classes' });
    }
};
exports.getClasses = getClasses;
