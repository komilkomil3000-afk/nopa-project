import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/db';

export const getCalendarEvents = async (req: AuthRequest, res: Response) => {
  try {
    const stations = await prisma.station.findMany({
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

    const events: any[] = [];
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
    const challenges = await prisma.challenge.findMany({
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
  } catch (error: any) {
    console.error('getCalendarEvents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
