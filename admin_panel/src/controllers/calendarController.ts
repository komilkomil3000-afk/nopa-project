import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/db';

// Standard Jalali to Gregorian algorithm
function jalaliToGregorian(jy: number, jm: number, jd: number) {
  let gy = jy > 979 ? 1600 : 621;
  let jYear = jy > 979 ? jy - 979 : jy;

  let days =
    365 * jYear +
    Math.floor(jYear / 33) * 8 +
    Math.floor(((jYear % 33) + 3) / 4) +
    78 +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);

  gy += 400 * Math.floor(days / 146097);
  days %= 146097;

  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }

  gy += 4 * Math.floor(days / 1461);
  days %= 1461;

  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }

  let gd = days + 1;
  const sal_a = [0, 31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  for (gm = 0; gm < 13; gm++) {
    const v = sal_a[gm];
    if (gd <= v) break;
    gd -= v;
  }

  return { gy, gm, gd };
}

// Master curriculum schedule from شیت دوم.xlsx (Sheet 03)
// Key: `${stationNumber}_${isMedia ? 'media' : 'skill'}_${sessionNumber}`
const CURRICULUM_SCHEDULE: Record<string, { date: string; time: string; instructor?: string }> = {
  // Station 1: مبانی شناخت و رسانه (شوک و اینشات)
  '1_media_1': { date: '1405/07/02', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'علیرضا خوشمنظر' },
  '1_media_2': { date: '1405/07/03', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'علیرضا خوشمنظر' },
  '1_skill_1': { date: '1405/07/05', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیراینه‌گر' },
  '1_skill_2': { date: '1405/07/07', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیراینه‌گر' },

  // Station 2: خودشناسی جامع و پادکست
  '2_skill_1': { date: '1405/07/06', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیرچهره‌تراش' },
  '2_skill_2': { date: '1405/07/08', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیرچهره‌تراش' },
  '2_media_1': { date: '1405/07/09', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'علیرضا خوشمنظر' },
  '2_media_2': { date: '1405/07/10', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'علیرضا خوشمنظر' },
  '2_skill_3': { date: '1405/07/13', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیرچهره‌تراش' },
  '2_skill_4': { date: '1405/07/15', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیرچهره‌تراش' },
  '2_media_3': { date: '1405/07/16', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'علیرضا خوشمنظر' },
  '2_media_4': { date: '1405/07/17', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'علیرضا خوشمنظر' },
  '2_skill_5': { date: '1405/07/20', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیرچهره‌تراش' },
  '2_skill_6': { date: '1405/07/22', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیرچهره‌تراش' },
  '2_media_5': { date: '1405/07/23', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'علیرضا خوشمنظر' },
  '2_media_6': { date: '1405/07/24', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'علیرضا خوشمنظر' },
  '2_skill_7': { date: '1405/07/27', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیرچهره‌تراش' },
  '2_skill_8': { date: '1405/07/29', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیرچهره‌تراش' },
  '2_media_7': { date: '1405/07/30', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'علیرضا خوشمنظر' },
  '2_media_8': { date: '1405/07/31', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'علیرضا خوشمنظر' },

  // Station 3: شناخت همراهان و دشمنان (کنوا)
  '3_skill_1': { date: '1405/08/03', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیردیده‌بان' },
  '3_skill_2': { date: '1405/08/05', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیردیده‌بان' },
  '3_media_1': { date: '1405/08/06', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'حیدری' },
  '3_media_2': { date: '1405/08/07', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'حیدری' },
  '3_skill_3': { date: '1405/08/10', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیردیده‌بان' },
  '3_skill_4': { date: '1405/08/12', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیردیده‌بان' },
  '3_media_3': { date: '1405/08/13', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'حیدری' },
  '3_media_4': { date: '1405/08/14', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'حیدری' },
  '3_skill_5': { date: '1405/08/17', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیردیده‌بان' },
  '3_skill_6': { date: '1405/08/19', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیردیده‌بان' },
  '3_media_5': { date: '1405/08/20', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'حیدری' },
  '3_media_6': { date: '1405/08/21', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'حیدری' },

  // Station 4: شناخت هستی (کنوا پیشرفته)
  '4_skill_1': { date: '1405/09/01', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیرناخدا' },
  '4_skill_2': { date: '1405/09/03', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیرناخدا' },
  '4_media_1': { date: '1405/09/04', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'حیدری' },
  '4_media_2': { date: '1405/09/05', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'حیدری' },
  '4_skill_3': { date: '1405/09/08', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیرناخدا' },
  '4_skill_4': { date: '1405/09/10', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیرناخدا' },
  '4_media_3': { date: '1405/09/11', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'حیدری' },
  '4_media_4': { date: '1405/09/12', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'حیدری' },

  // Station 5: هدف‌گذاری (فتوشاپ)
  '5_skill_1': { date: '1405/09/15', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیرمنجم' },
  '5_skill_2': { date: '1405/09/16', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیرمنجم' },
  '5_skill_3': { date: '1405/09/17', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیرمنجم' },
  '5_media_1': { date: '1405/09/18', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'کمیل زاهدی' },
  '5_media_2': { date: '1405/09/19', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'کمیل زاهدی' },
  '5_skill_4': { date: '1405/09/22', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیرمنجم' },
  '5_media_3': { date: '1405/09/22', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'کمیل زاهدی' },
  '5_media_4': { date: '1405/09/23', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'کمیل زاهدی' },
  '5_skill_5': { date: '1405/09/24', time: '۱۶:۰۰ الی ۱۷:۳۰', instructor: 'پیرمنجم' },
  '5_media_5': { date: '1405/09/24', time: '۱۸:۰۰ الی ۱۹:۳۰', instructor: 'کمیل زاهدی' },
};

// Challenges schedule from شیت دوم.xlsx (Sheet 05)
const CHALLENGE_SCHEDULE: Record<string, { date: string; time: string }> = {
  CH301: { date: '1405/07/20', time: 'مهلت تحویل تا ۲۳:۵۹' },
  CH302: { date: '1405/07/22', time: 'مهلت تحویل تا ۲۳:۵۹' },
  CH401: { date: '1405/07/24', time: 'مهلت تحویل تا ۲۳:۵۹' },
  CH402: { date: '1405/07/26', time: 'مهلت تحویل تا ۲۳:۵۹' },
  CH501: { date: '1405/07/28', time: 'مهلت تحویل تا ۲۳:۵۹' },
  CH502: { date: '1405/07/30', time: 'مهلت تحویل تا ۲۳:۵۹' },
};

export const getCalendarEvents = async (req: AuthRequest, res: Response) => {
  try {
    const stations = await prisma.station.findMany({
      orderBy: { orderIndex: 'asc' },
      include: {
        categories: {
          include: {
            sessions: {
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
      },
    });

    const events: any[] = [];

    stations.forEach((st) => {
      const stNum = st.orderIndex || 1;

      st.categories.forEach((cat) => {
        const isMedia = cat.title.includes('رسانه');
        const type = isMedia ? 'mediaClass' : 'skillClass';

        cat.sessions.forEach((sess) => {
          const sessNum = sess.orderIndex || 1;
          const key = `${stNum}_${isMedia ? 'media' : 'skill'}_${sessNum}`;
          const schedule = CURRICULUM_SCHEDULE[key];

          const jalaliDateStr = sess.sessionDate || (schedule ? schedule.date : '1405/07/02');
          const [jYear, jMonth, jDay] = jalaliDateStr.split('/').map((n: string) => parseInt(n, 10));

          const { gy, gm, gd } = jalaliToGregorian(jYear, jMonth, jDay);
          const timeStr = sess.sessionTime || (schedule ? schedule.time : isMedia ? '۱۸:۰۰ الی ۱۹:۳۰' : '۱۶:۰۰ الی ۱۷:۳۰');
          const instructor = sess.instructor || schedule?.instructor || (isMedia ? 'علیرضا خوشمنظر' : 'استاد نپا');

          // Hour offset for ISO: Media at 18:00 (14:30 UTC), Skill at 16:00 (12:30 UTC)
          const hourUtc = isMedia ? 14 : 12;
          const minuteUtc = 30;
          const gregorianDate = new Date(Date.UTC(gy, gm - 1, gd, hourUtc, minuteUtc, 0));

          events.push({
            id: sess.id,
            stationId: st.id,
            stationTitle: st.title,
            stationSubtitle: st.subtitle,
            title: sess.title,
            instructor,
            type,
            time: timeStr,
            jalaliDate: jalaliDateStr,
            year: jYear,
            month: jMonth,
            day: jDay,
            eventDate: gregorianDate.toISOString(),
            orderIndex: sess.orderIndex,
          });
        });
      });
    });

    // Also include official Challenges with actual deadlines from Sheet 05
    const challenges = await prisma.challenge.findMany({
      orderBy: { createdAt: 'asc' },
    });

    challenges.forEach((ch, idx) => {
      const schedule = CHALLENGE_SCHEDULE[ch.id] || {
        date: `1405/07/${20 + (idx * 2) % 10}`,
        time: 'مهلت تحویل تا ۲۳:۵۹',
      };

      const [jYear, jMonth, jDay] = schedule.date.split('/').map((n) => parseInt(n, 10));
      const { gy, gm, gd } = jalaliToGregorian(jYear, jMonth, jDay);
      const gregorianDate = new Date(Date.UTC(gy, gm - 1, gd, 20, 29, 0)); // 23:59 Iran = 20:29 UTC

      events.push({
        id: ch.id,
        title: ch.title,
        type: 'assignment',
        time: schedule.time,
        jalaliDate: schedule.date,
        year: jYear,
        month: jMonth,
        day: jDay,
        eventDate: gregorianDate.toISOString(),
      });
    });

    // Sort all events chronologically
    events.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      if (a.month !== b.month) return a.month - b.month;
      return a.day - b.day;
    });

    res.status(200).json({
      events,
      holidays: [],
      semester: {
        title: 'ترم پاییز نُپا ۱۴۰۵',
        startJalali: '1405/07/02',
        endJalali: '1405/09/24',
        activeMonths: [7, 8, 9],
      },
    });
  } catch (error: any) {
    console.error('getCalendarEvents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

