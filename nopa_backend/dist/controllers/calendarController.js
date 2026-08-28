"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCalendarEvents = void 0;
const db_1 = __importDefault(require("../config/db"));
const getCalendarEvents = async (req, res) => {
    try {
        const user = await db_1.default.user.findUnique({
            where: { id: req.user?.id },
            include: { caravan: true }
        });
        if (!user) {
            return res.status(404).json({ error: 'کاربر یافت نشد' });
        }
        // Fetch some sessions to show in calendar
        const sessions = await db_1.default.classSession.findMany({
            take: 4,
            orderBy: { createdAt: 'asc' },
            include: {
                category: true
            }
        });
        const events = sessions.map((session, index) => {
            const isMedia = session.category.title.includes('رسانه');
            const type = isMedia ? 'mediaClass' : 'skillClass';
            const time = isMedia ? 'ساعت ۱۵:۰۰' : 'ساعت ۱۷:۰۰';
            // Calculate a scheduled date based on createdAt or fallback
            // For realism, let's just return the createdAt date, or an offset from it
            const eventDate = session.createdAt ? session.createdAt.toISOString() : new Date().toISOString();
            return {
                eventDate,
                type,
                title: session.title,
                time
            };
        });
        // We can also fetch challenges here, but we'll stick to returning ISO dates for sessions
        // Real holidays would be synced from an API, we leave it empty for dynamic fetching
        const holidays = [];
        res.status(200).json({
            events,
            holidays
        });
    }
    catch (error) {
        console.error('getCalendarEvents error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getCalendarEvents = getCalendarEvents;
