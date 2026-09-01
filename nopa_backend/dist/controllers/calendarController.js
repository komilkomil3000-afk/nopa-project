"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCalendarEvents = void 0;
const db_1 = __importDefault(require("../config/db"));
const getCalendarEvents = async (req, res) => {
    try {
        const stations = await db_1.default.station.findMany({
            orderBy: { orderIndex: 'asc' },
            include: {
                categories: {
                    include: {
                        sessions: {
                            orderBy: { orderIndex: 'asc' }
                        }
                    }
                }
            }
        });
        const events = [];
        const baseNow = new Date();
        stations.forEach((st, stIdx) => {
            // Base date for this station (from admin configured releaseDate or weekly interval)
            const stBaseDate = st.releaseDate ? new Date(st.releaseDate) : new Date(baseNow.getTime() + stIdx * 7 * 24 * 3600 * 1000);
            const stReleaseTime = st.releaseTime || '16:00';
            st.categories.forEach((cat) => {
                const isMedia = cat.title.includes('رسانه');
                const type = isMedia ? 'mediaClass' : 'skillClass';
                const defaultTime = isMedia ? 'ساعت ۱۸:۰۰' : `ساعت ${stReleaseTime}`;
                cat.sessions.forEach((sess, sessIdx) => {
                    // Schedule days distributed across the station period
                    const dayOffset = isMedia ? (sessIdx * 2 + 1) : (sessIdx * 2);
                    const sessionDate = new Date(stBaseDate.getTime() + dayOffset * 24 * 3600 * 1000);
                    events.push({
                        id: sess.id,
                        stationId: st.id,
                        stationTitle: st.title,
                        stationSubtitle: st.subtitle,
                        title: sess.title,
                        instructor: sess.instructor || 'استاد نپا',
                        type,
                        time: defaultTime,
                        eventDate: sessionDate.toISOString(),
                        orderIndex: sess.orderIndex,
                    });
                });
            });
        });
        // Also include any active Challenges with deadlines
        const challenges = await db_1.default.challenge.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' }
        });
        challenges.forEach((ch, chIdx) => {
            const chDate = new Date(baseNow.getTime() + (chIdx * 3 + 2) * 24 * 3600 * 1000);
            events.push({
                id: ch.id,
                title: ch.title,
                type: 'assignment',
                time: 'مهلت تحویل تا ۲۳:۵۹',
                eventDate: chDate.toISOString(),
            });
        });
        res.status(200).json({
            events,
            holidays: []
        });
    }
    catch (error) {
        console.error('getCalendarEvents error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getCalendarEvents = getCalendarEvents;
