import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/db';

export const getCalendarEvents = async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user?.id },
      include: { caravan: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'کاربر یافت نشد' });
    }

    // Fetch some sessions to show in calendar
    const sessions = await prisma.classSession.findMany({
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
    const holidays: string[] = [];
    
    res.status(200).json({
      events,
      holidays
    });
  } catch (error) {
    console.error('getCalendarEvents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
