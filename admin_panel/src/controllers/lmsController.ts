import { Request, Response } from 'express';
import { addActivity } from '../services/activity';
import prisma from '../config/db';
import { changeBalance } from '../services/ledger';
import { stripAnswerKeys, stripStationAnswerKeys, isAdminRole } from '../utils/answerKeys';
import { evaluateStudentProgress } from './certificateController';
import { isMentorRole } from '../utils/roles';
import { CATEGORY_ORDER_BY, trackTypeForCategory } from '../utils/stationCategories';

// The full station tree is expensive (5 nested includes, ~165 KB) and identical for every user of a
// role class, so the serialized response is kept briefly in memory. Any non-chat write clears it.
const STATIONS_CACHE_TTL_MS = 20_000;
const stationsCache = new Map<string, { at: number; body: string }>();
export function clearStationsCache() {
  stationsCache.clear();
}

export const getStations = async (req: Request, res: Response) => {
  try {
    const role = (req as any).user?.role;
    const cacheKey = isAdminRole(role) ? 'admin' : isMentorRole(role) ? 'mentor' : 'student';
    const hit = stationsCache.get(cacheKey);
    if (hit && Date.now() - hit.at < STATIONS_CACHE_TTL_MS) {
      res.setHeader('Cache-Control', 'private, no-cache');
      return res.type('application/json').send(hit.body);
    }
    const stations = await prisma.station.findMany({
      include: {
        challenges: true,
        categories: {
          include: {
            sessions: {
              include: { 
                quizzes: true,
                videoClips: {
                  include: { quizzes: true },
                  orderBy: { clipOrder: 'asc' }
                }
              },
              orderBy: { orderIndex: 'asc' }
            }
          },
          orderBy: CATEGORY_ORDER_BY
        }
      },
      orderBy: { orderIndex: 'asc' }
    });

    // Students must never receive answer keys; only admins (who edit the quizzes) get them
    if (!isAdminRole((req as any).user?.role)) {
      stripStationAnswerKeys(stations);
    }

    const now = new Date();
    // Mentors are not bound by the release schedule (the order of content still applies)
    const isMentor = isMentorRole((req as any).user?.role);
    const mapped = stations.map(st => {
      let instructors = null;
      let schedule = null;
      let category = null;
      let sessionsCount = null;
      if (st.subtitle) {
        try {
          const parsed = JSON.parse(st.subtitle);
          if (parsed && typeof parsed === 'object') {
            instructors = parsed.instructors;
            schedule = parsed.schedule;
            category = parsed.category;
            sessionsCount = parsed.sessionsCount;
          }
        } catch (e) {
          instructors = st.subtitle;
        }
      }

      // Check scheduled unlock time
      const isTimeLocked = !isMentor && st.scheduledUnlockTime ? (now < new Date(st.scheduledUnlockTime)) : false;
      const isLocked = Boolean(st.isLocked || st.status === 'locked' || isTimeLocked);

      // Parse multiple animations
      let animations: any[] = [];
      if (st.animationsJson) {
        try {
          const parsed = JSON.parse(st.animationsJson);
          if (Array.isArray(parsed)) animations = parsed;
        } catch (_) {}
      }
      if (animations.length === 0 && st.animationUrl) {
        animations.push({
          id: `anim-${st.id}`,
          title: st.animationTitle || 'انیمیشن معرفی منزلگاه',
          url: st.animationUrl,
          videoUrl: st.animationUrl,
          description: st.description || ''
        });
      }

      return {
        ...st,
        isLocked,
        status: isLocked ? 'locked' : (st.status || 'active'),
        rawIsLocked: Boolean(st.isLocked),
        isTimeLocked,
        scheduledUnlockTime: st.scheduledUnlockTime,
        requirePreviousComplete: Boolean(st.requirePreviousComplete),
        targetCaravansJson: st.targetCaravansJson,
        animations,
        instructors,
        schedule,
        category,
        sessionsCount
      };
    });

    const body = JSON.stringify(mapped);
    stationsCache.set(cacheKey, { at: Date.now(), body });
    res.setHeader('Cache-Control', 'private, no-cache');
    res.type('application/json').send(body);
  } catch (error) {
    console.error('getStations error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getClasses = async (req: Request, res: Response) => {
  try {
    const classes = await prisma.classCategory.findMany({
      orderBy: CATEGORY_ORDER_BY
    });
    res.json(classes);
  } catch (error) {
    console.error('getClasses error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getSessions = async (req: Request, res: Response) => {
  try {
    const sessions = await prisma.classSession.findMany({
      orderBy: { orderIndex: 'asc' }
    });
    res.json(sessions);
  } catch (error) {
    console.error('getSessions error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getClips = async (req: Request, res: Response) => {
  try {
    const clips = await prisma.videoClip.findMany({
      orderBy: { clipOrder: 'asc' }
    });
    res.json(clips);
  } catch (error) {
    console.error('getClips error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getQuizzes = async (req: Request, res: Response) => {
  try {
    const quizzes = await prisma.quiz.findMany({
      orderBy: { orderIndex: 'asc' }
    });
    if (!isAdminRole((req as any).user?.role)) {
      quizzes.forEach((q: any) => { q.questionsJson = stripAnswerKeys(q.questionsJson); });
    }
    res.json(quizzes);
  } catch (error) {
    console.error('getQuizzes error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Stations are numbered consecutively in their order. Setting one station's number moves the whole run:
// station at position p gets [number], the first one gets number - p (never below 0), and so on.
async function renumberStationsAround(tx: any, stationId: string, number: number) {
  const all = await tx.station.findMany({ orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }], select: { id: true } });
  const pos = all.findIndex((s: any) => s.id === stationId);
  if (pos < 0) return;
  const base = Math.max(0, number - pos);
  for (let i = 0; i < all.length; i++) {
    await tx.station.update({ where: { id: all[i].id }, data: { orderIndex: base + i } });
  }
}

/** A part that has a video must have a real quiz (no made-up one is ever shown to students). Throws a 400-style error naming the parts. */
async function assertClipsHaveQuiz(tx: any, clipIds: string[]) {
  if (clipIds.length === 0) return;
  const clips = await tx.videoClip.findMany({
    where: { id: { in: clipIds } },
    select: { id: true, title: true, clipOrder: true, videoUrl: true, sessionId: true, session: { select: { title: true } } },
    orderBy: [{ sessionId: 'asc' }, { clipOrder: 'asc' }]
  });
  const quizzes = await tx.quiz.findMany({
    where: { sessionId: { in: Array.from(new Set(clips.map((c: any) => c.sessionId))) as string[] } },
    select: { clipId: true, orderIndex: true, sessionId: true, questionsJson: true }
  });
  const hasQuestions = (json: string) => {
    try { const a = JSON.parse(json || '[]'); return Array.isArray(a) && a.length > 0; } catch (_) { return false; }
  };
  const missing = clips.filter((c: any) => String(c.videoUrl || '').trim() &&
    !quizzes.some((q: any) => q.sessionId === c.sessionId && (q.clipId === c.id || (!q.clipId && q.orderIndex === c.clipOrder)) && hasQuestions(q.questionsJson)));
  if (missing.length > 0) {
    const names = missing.map((c: any) => `«${c.title || 'پارت ' + c.clipOrder}» (جلسه ${c.session?.title || ''})`).join('، ');
    throw Object.assign(new Error(`برای هر پارت باید آزمونک ساخته شود. آزمونک این پارت‌ها ثبت نشده است: ${names}`), { statusCode: 400 });
  }
}

export const createOrUpdateStation = async (req: Request, res: Response) => {
  try {
    const { id, title, subtitle, description, stayDuration, animationCount, animationTitle, animationUrl, animations, animationsJson, iconUrl, orderIndex, releaseDate, releaseTime, scoringCriteriaJson, categories, instructors, schedule, category, sessionsCount, isLocked, status, scheduledUnlockTime, requirePreviousComplete, targetCaravansJson } = req.body;
    
    const subtitleVal = subtitle || (instructors || schedule || category || sessionsCount ? JSON.stringify({ instructors, schedule, category, sessionsCount }) : null);

    // Admin-entered number of animation episodes (empty / invalid = not set)
    const animCountParsed = parseInt(String(animationCount ?? ''), 10);
    const animCountVal: number | null = Number.isFinite(animCountParsed) && animCountParsed >= 0 ? animCountParsed : null;

    // Prepare animations JSON and fallback single animationTitle/animationUrl
    let parsedAnimationsJson: string | null = null;
    let effectiveAnimTitle = animationTitle;
    let effectiveAnimUrl = animationUrl;

    if (animations && Array.isArray(animations)) {
      parsedAnimationsJson = JSON.stringify(animations);
      if (animations.length > 0) {
        if (!effectiveAnimTitle) effectiveAnimTitle = animations[0].title || 'انیمیشن منزلگاه';
        if (!effectiveAnimUrl) effectiveAnimUrl = animations[0].url || animations[0].videoUrl || '';
      }
    } else if (animationsJson && typeof animationsJson === 'string') {
      parsedAnimationsJson = animationsJson;
      try {
        const arr = JSON.parse(animationsJson);
        if (Array.isArray(arr) && arr.length > 0) {
          if (!effectiveAnimTitle) effectiveAnimTitle = arr[0].title || 'انیمیشن منزلگاه';
          if (!effectiveAnimUrl) effectiveAnimUrl = arr[0].url || arr[0].videoUrl || '';
        }
      } catch (_) {}
    } else if (animationUrl) {
      parsedAnimationsJson = JSON.stringify([{
        id: 'anim_1',
        title: animationTitle || 'انیمیشن منزلگاه',
        url: animationUrl,
        videoUrl: animationUrl,
        description: ''
      }]);
    }

    const result = await prisma.$transaction(async (tx) => {
      let station;
      const releaseDateVal = (releaseDate && String(releaseDate).trim() !== '') ? new Date(releaseDate) : null;
      // -1 = no number given (keep / assign automatically); 0 is a real station number
      const parsedOrder = parseInt(orderIndex);
      let orderIndexVal = Number.isNaN(parsedOrder) || parsedOrder < 0 ? -1 : parsedOrder;

      const parsedUnlockTime = (scheduledUnlockTime && String(scheduledUnlockTime).trim() !== '') ? new Date(scheduledUnlockTime) : undefined;
      const lockedVal = typeof isLocked === 'boolean' ? isLocked : (status === 'locked' ? true : (status === 'active' ? false : undefined));

      if (id && !id.startsWith('new_')) {
        // When updating, ensure orderIndex is not duplicated with another station
        if (orderIndexVal >= 0) {
          const current = await tx.station.findUnique({ where: { id } });
          if (current && current.orderIndex !== orderIndexVal) {
            // A new display number for this station: the others follow it in their current order (so 0 can be the first)
            await renumberStationsAround(tx, id, orderIndexVal);
          }
          orderIndexVal = current ? (await tx.station.findUnique({ where: { id } }))!.orderIndex : orderIndexVal;
        } else {
          const current = await tx.station.findUnique({ where: { id } });
          orderIndexVal = current ? current.orderIndex : 1;
        }

        const updateData: any = { 
          title: title || 'منزلگاه', 
          subtitle: subtitleVal, 
          description: description !== undefined ? description : '', 
          stayDuration: stayDuration !== undefined ? stayDuration : null,
          ...(animationCount !== undefined ? { animationCount: animCountVal } : {}),
          orderIndex: orderIndexVal,
          releaseDate: releaseDateVal,
          releaseTime: releaseTime || null,
          scoringCriteriaJson
        };

        // Station image and gallery (نگارستان) are only changed when the request actually sends them,
        // so saving unrelated fields never wipes them.
        if (iconUrl !== undefined) updateData.iconUrl = iconUrl || '';
        if (parsedAnimationsJson !== null || animations !== undefined || animationsJson !== undefined || animationUrl !== undefined) {
          updateData.animationTitle = effectiveAnimTitle !== undefined ? effectiveAnimTitle : null;
          updateData.animationUrl = effectiveAnimUrl !== undefined ? effectiveAnimUrl : null;
          updateData.animationsJson = parsedAnimationsJson;
        }

        if (lockedVal !== undefined) updateData.isLocked = lockedVal;
        if (status !== undefined) updateData.status = status;
        if (parsedUnlockTime !== undefined) updateData.scheduledUnlockTime = parsedUnlockTime;
        if (requirePreviousComplete !== undefined) updateData.requirePreviousComplete = Boolean(requirePreviousComplete);
        if (targetCaravansJson !== undefined) updateData.targetCaravansJson = typeof targetCaravansJson === 'string' ? targetCaravansJson : JSON.stringify(targetCaravansJson);

        station = await tx.station.update({
          where: { id },
          data: updateData
        });
      } else {
        // When creating a new station: strictly prevent duplicate number
        const maxOrderAgg = await tx.station.aggregate({ _max: { orderIndex: true } });
        const nextAutoOrder = (maxOrderAgg._max.orderIndex || 0) + 1;

        if (orderIndexVal < 0) {
          orderIndexVal = nextAutoOrder;
        } else {
          const existingWithSameOrder = await tx.station.findFirst({
            where: { orderIndex: orderIndexVal }
          });
          if (existingWithSameOrder) {
            orderIndexVal = nextAutoOrder;
          }
        }

        station = await tx.station.create({
          data: { 
            title: title || 'منزلگاه جدید', 
            subtitle: subtitleVal, 
            description: description !== undefined ? description : '', 
            stayDuration: stayDuration !== undefined ? stayDuration : null,
            animationCount: animCountVal,
            animationTitle: effectiveAnimTitle !== undefined ? effectiveAnimTitle : null,
            animationUrl: effectiveAnimUrl !== undefined ? effectiveAnimUrl : null,
            animationsJson: parsedAnimationsJson,
            iconUrl: iconUrl || '', 
            orderIndex: orderIndexVal, 
            releaseDate: releaseDateVal, 
            releaseTime: releaseTime || null, 
            scoringCriteriaJson,
            isLocked: lockedVal || false,
            status: status || (lockedVal ? 'locked' : 'active'),
            scheduledUnlockTime: parsedUnlockTime || null,
            requirePreviousComplete: Boolean(requirePreviousComplete),
            targetCaravansJson: typeof targetCaravansJson === 'string' ? targetCaravansJson : (targetCaravansJson ? JSON.stringify(targetCaravansJson) : null)
          }
        });
      }

      if (categories && Array.isArray(categories)) {
        const existingCategories = await tx.classCategory.findMany({
          where: { stationId: station.id }
        });
        const existingCategoryIds = existingCategories.map(c => c.id);
        const incomingCategoryIds = categories.filter(c => c.id && !c.id.startsWith('new_')).map(c => c.id);

        const categoriesToDelete = existingCategoryIds.filter(cid => !incomingCategoryIds.includes(cid));
        if (categoriesToDelete.length > 0) {
          await tx.classCategory.deleteMany({
            where: { id: { in: categoriesToDelete } }
          });
        }

        for (let i = 0; i < categories.length; i++) {
          const cat = categories[i];
          let dbCategory;
          const catOrder = parseInt(cat.orderIndex) || (i + 1);
          if (cat.id && !cat.id.startsWith('new_') && existingCategoryIds.includes(cat.id)) {
            dbCategory = await tx.classCategory.update({
              where: { id: cat.id },
              data: { title: cat.title || 'دسته کلاس', orderIndex: catOrder }
            });
          } else {
            dbCategory = await tx.classCategory.create({
              data: { stationId: station.id, title: cat.title || 'دسته کلاس', orderIndex: catOrder }
            });
          }

          let incomingSessions = cat.sessions || [];
          const existingSessions = await tx.classSession.findMany({
            where: { categoryId: dbCategory.id }
          });
          const existingSessionIds = existingSessions.map(s => s.id);
          const incomingSessionIds = incomingSessions.filter((s: any) => s.id && !s.id.startsWith('new_')).map((s: any) => s.id);

          // If no sessions exist or generating new structure with specified sessionsCount
          if (incomingSessions.length === 0 && existingSessions.length === 0) {
            const count = parseInt(cat.sessionsCount) || 2;
            const partsCount = parseInt(cat.partsPerSession) || 2;
            incomingSessions = [];
            for (let s = 1; s <= count; s++) {
              const isSkill = i === 0;
              const sessionDay = isSkill ? (s === 1 ? 'شنبه' : 'دوشنبه') : (s === 1 ? 'پنجشنبه' : 'جمعه');
              const clips = [];
              const quizzes = [];
              for (let p = 1; p <= partsCount; p++) {
                clips.push({
                  title: `پارت ${p} - ${cat.title}`,
                  videoUrl: '',
                  clipOrder: p
                });
                quizzes.push({
                  title: `آزمونک پارت ${p}`,
                  questionsJson: JSON.stringify([{
                    question: `مفهوم اصلی مطرح‌شده در پارت ${p} کدام است؟`,
                    options: ['گزینه صحیح', 'گزینه نادرست اول', 'گزینه نادرست دوم', 'گزینه نادرست سوم'],
                    correctIndex: 0
                  }]),
                  rewardZarik: 10,
                  orderIndex: p
                });
              }
              incomingSessions.push({
                title: `جلسه ${s} (${sessionDay}): ${cat.title}`,
                instructor: cat.instructor || 'استاد دوره',
                orderIndex: s,
                videoClips: clips,
                quizzes: quizzes
              });
            }
          }

          const sessionsToDelete = existingSessionIds.filter(sid => !incomingSessionIds.includes(sid));
          if (sessionsToDelete.length > 0 && incomingSessionIds.length > 0) {
            await tx.classSession.deleteMany({
              where: { id: { in: sessionsToDelete } }
            });
          }

          for (let j = 0; j < incomingSessions.length; j++) {
            const sess = incomingSessions[j];
            let dbSession;
            const sessData = {
              title: sess.title || `جلسه ${j + 1}`,
              description: sess.description || '',
              videoUrl: sess.videoUrl || '',
              instructor: sess.instructor || cat.instructor || 'استاد نپا',
              minWatchThreshold: parseInt(sess.minWatchThreshold) || 70,
              minPassScore: parseInt(sess.minPassScore) || 0,
              maxZarikReward: parseInt(sess.maxZarikReward) || 0,
              maxPointsReward: parseInt(sess.maxPointsReward) || 0,
              orderIndex: parseInt(sess.orderIndex) || (j + 1)
            };

            if (sess.id && !sess.id.startsWith('new_') && existingSessionIds.includes(sess.id)) {
              dbSession = await tx.classSession.update({
                where: { id: sess.id },
                data: sessData
              });
            } else {
              dbSession = await tx.classSession.create({
                data: {
                  categoryId: dbCategory.id,
                  ...sessData
                }
              });
            }

            const incomingClips = sess.videoClips || [];
            const existingClips = await tx.videoClip.findMany({
              where: { sessionId: dbSession.id }
            });
            const existingClipIds = existingClips.map(clip => clip.id);
            const incomingClipIds = incomingClips.filter((clip: any) => clip.id && !clip.id.startsWith('new_')).map((clip: any) => clip.id);

            const clipsToDelete = existingClipIds.filter(cid => !incomingClipIds.includes(cid));
            if (clipsToDelete.length > 0 && incomingClipIds.length > 0) {
              await tx.videoClip.deleteMany({
                where: { id: { in: clipsToDelete } }
              });
            }

            const savedClips: any[] = [];
            for (let k = 0; k < incomingClips.length; k++) {
              const clip = incomingClips[k];
              const clipData = {
                title: clip.title || `پارت ${k + 1}`,
                videoUrl: clip.videoUrl || '',
                ...(clip.coverImageUrl !== undefined ? { coverImageUrl: clip.coverImageUrl || null } : {}),
                clipOrder: parseInt(clip.clipOrder) || (k + 1),
                duration: parseInt(clip.duration) || 0
              };

              let savedClip;
              if (clip.id && !clip.id.startsWith('new_') && existingClipIds.includes(clip.id)) {
                savedClip = await tx.videoClip.update({
                  where: { id: clip.id },
                  data: clipData
                });
              } else {
                savedClip = await tx.videoClip.create({
                  data: {
                    sessionId: dbSession.id,
                    ...clipData
                  }
                });
              }
              savedClips.push(savedClip);
            }

            const incomingQuizzes = sess.quizzes || (sess.quiz ? [sess.quiz] : []);
            if (incomingQuizzes.length > 0) {
              // Quizzes are updated in place (never deleted and recreated): deleting one would wipe the students'
              // submissions and progress, locking stations they had already passed.
              const existingQuizzes = await tx.quiz.findMany({ where: { sessionId: dbSession.id } });
              const keptQuizIds = new Set<string>();
              for (let q = 0; q < incomingQuizzes.length; q++) {
                const quizPayload = incomingQuizzes[q];
                const matchedClip = savedClips.find(c => c.clipOrder === (quizPayload.orderIndex || q + 1)) || savedClips[q];
                const quizData = {
                  clipId: matchedClip ? matchedClip.id : (quizPayload.clipId || undefined),
                  title: quizPayload.title || `آزمونک پارت ${q + 1}`,
                  questionsJson: typeof quizPayload.questionsJson === 'string' 
                      ? quizPayload.questionsJson 
                      : JSON.stringify(quizPayload.questionsJson || []),
                  rewardZarik: quizReward(quizPayload.rewardZarik),
                  rewardNakh: parseInt(quizPayload.rewardNakh) || 0,
                  rewardFarsh: parseInt(quizPayload.rewardFarsh) || 0,
                  orderIndex: parseInt(quizPayload.orderIndex) || (q + 1)
                };
                const existing = existingQuizzes.find(x => !keptQuizIds.has(x.id) && quizPayload.id && x.id === quizPayload.id)
                  || existingQuizzes.find(x => !keptQuizIds.has(x.id) && quizData.clipId && x.clipId === quizData.clipId);
                if (existing) {
                  keptQuizIds.add(existing.id);
                  await tx.quiz.update({ where: { id: existing.id }, data: quizData });
                } else {
                  const created = await tx.quiz.create({ data: { sessionId: dbSession.id, ...quizData } });
                  keptQuizIds.add(created.id);
                }
              }
              const staleIds = existingQuizzes.filter(x => !keptQuizIds.has(x.id)).map(x => x.id);
              if (staleIds.length > 0) await tx.quiz.deleteMany({ where: { id: { in: staleIds } } });
            }
            await assertClipsHaveQuiz(tx, savedClips.map(c => c.id));
          }
        }
      }

      return station;
    });

    res.json({ message: 'ساختار منزلگاه با موفقیت ذخیره شد', data: result });
  } catch (error: any) {
    console.error('createOrUpdateStation error:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Internal Server Error' });
  }
};

export const createOrUpdateCategory = async (req: Request, res: Response) => {
  try {
    const { id, stationId, packageId, title, orderIndex } = req.body;
    const finalStationId = stationId || packageId;
    let category;
    const targetId = id || req.params.id;
    if (targetId) {
      // Only what was sent changes: renaming a category must not reset its position (that used to move every
      // renamed category to the front, so the app and the panel showed it under the wrong class tab)
      category = await prisma.classCategory.update({
        where: { id: targetId },
        data: {
          ...(title !== undefined && String(title).trim() ? { title: String(title).trim() } : {}),
          ...(orderIndex !== undefined && orderIndex !== null && orderIndex !== '' ? { orderIndex: Number(orderIndex) || 0 } : {})
        }
      });
    } else {
      if (!finalStationId) return res.status(400).json({ error: 'stationId is required' });
      let order = Number(orderIndex);
      if (!order) {
        const last = await prisma.classCategory.findFirst({ where: { stationId: finalStationId }, orderBy: { orderIndex: 'desc' } });
        order = (last?.orderIndex || 0) + 1;
      }
      category = await prisma.classCategory.create({
        data: { stationId: finalStationId, title: String(title || '').trim() || 'دسته کلاس', orderIndex: order }
      });
    }
    res.json({ message: 'Saved successfully', data: category });
  } catch (error) {
    console.error('createOrUpdateCategory error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const createOrUpdateSession = async (req: Request, res: Response) => {
  try {
    const { id: paramId } = req.params;
    const { id, categoryId, subCourseId, title, description, videoUrl, instructor, teacher, sessionDate, sessionTime, handoutUrl, handoutTitle, minWatchThreshold, minPassScore, maxZarikReward, maxPointsReward, orderIndex } = req.body;
    const targetId = id || paramId;
    const finalCategoryId = categoryId || subCourseId;
    const finalInstructor = instructor || teacher;
    let session;
    if (targetId) {
      session = await prisma.classSession.update({
        where: { id: targetId },
        data: { 
          ...(title !== undefined ? { title } : {}), 
          ...(description !== undefined ? { description } : {}), 
          ...(videoUrl !== undefined ? { videoUrl } : {}), 
          ...(finalInstructor !== undefined ? { instructor: finalInstructor } : {}),
          ...(sessionDate !== undefined ? { sessionDate } : {}),
          ...(sessionTime !== undefined ? { sessionTime } : {}),
          ...(handoutUrl !== undefined ? { handoutUrl: String(handoutUrl).trim() || null } : {}),
          ...(handoutTitle !== undefined ? { handoutTitle: String(handoutTitle).trim() || null } : {}),
          ...(finalCategoryId ? { categoryId: finalCategoryId } : {}),
          // Saving a session's details must not reset what was not sent (order, rewards, watch threshold)
          ...(minWatchThreshold !== undefined ? { minWatchThreshold: Number(minWatchThreshold) || 70 } : {}),
          ...(minPassScore !== undefined ? { minPassScore: Number(minPassScore) || 0 } : {}),
          ...(maxZarikReward !== undefined ? { maxZarikReward: Number(maxZarikReward) || 0 } : {}),
          ...(maxPointsReward !== undefined ? { maxPointsReward: Number(maxPointsReward) || 0 } : {}),
          ...(orderIndex !== undefined ? { orderIndex: Number(orderIndex) || 0 } : {})
        }
      });
    } else {
      session = await prisma.classSession.create({
        data: { 
          categoryId: finalCategoryId, 
          title, 
          description, 
          videoUrl, 
          instructor: finalInstructor,
          sessionDate,
          sessionTime,
          handoutUrl: handoutUrl ? String(handoutUrl).trim() : null,
          handoutTitle: handoutTitle ? String(handoutTitle).trim() : null,
          minWatchThreshold: Number(minWatchThreshold || 70), 
          minPassScore: Number(minPassScore || 0), 
          maxZarikReward: Number(maxZarikReward || 0), 
          maxPointsReward: Number(maxPointsReward || 0), 
          orderIndex: Number(orderIndex || 0) 
        }
      });
    }
    res.json({ message: 'Saved successfully', data: session });
  } catch (error) {
    console.error('createOrUpdateSession error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const createOrUpdateClip = async (req: Request, res: Response) => {
  try {
    const { id: paramId } = req.params;
    const {
      id: bodyId, clipId, sessionId, title, clipOrder, videoUrl, coverImageUrl, duration,
      unlockDate, unlockTime, scheduledUnlockTime, isLocked
    } = req.body;
    const finalSessionId = sessionId || paramId;
    const targetClipId = clipId || (bodyId && !String(bodyId).startsWith('new_') ? bodyId : (paramId && !sessionId ? paramId : undefined));
    
    // Parse scheduled unlock time if date is given
    let calculatedScheduledUnlockTime: Date | null | undefined = undefined;
    if (scheduledUnlockTime !== undefined) {
      calculatedScheduledUnlockTime = scheduledUnlockTime ? new Date(scheduledUnlockTime) : null;
    } else if (unlockDate !== undefined) {
      if (unlockDate && unlockDate.trim() !== '') {
        try {
          const dt = new Date(`${unlockDate.trim()}T${(unlockTime && unlockTime.trim()) ? unlockTime.trim() : '00:00'}`);
          if (!isNaN(dt.getTime())) calculatedScheduledUnlockTime = dt;
        } catch (_) {}
      } else {
        calculatedScheduledUnlockTime = null;
      }
    }

    let clip;
    if (targetClipId) {
      clip = await prisma.videoClip.update({
        where: { id: targetClipId },
        data: {
          ...(title ? { title } : {}),
          ...(videoUrl !== undefined ? { videoUrl } : {}),
          ...(coverImageUrl !== undefined ? { coverImageUrl: coverImageUrl || null } : {}),
          ...(clipOrder !== undefined ? { clipOrder: Number(clipOrder) } : {}),
          ...(duration !== undefined ? { duration: Number(duration) } : {}),
          ...(unlockDate !== undefined ? { unlockDate: unlockDate || null } : {}),
          ...(unlockTime !== undefined ? { unlockTime: unlockTime || null } : {}),
          ...(calculatedScheduledUnlockTime !== undefined ? { scheduledUnlockTime: calculatedScheduledUnlockTime } : {}),
          ...(isLocked !== undefined ? { isLocked: Boolean(isLocked) } : {})
        }
      });
    } else {
      clip = await prisma.videoClip.create({
        data: {
          sessionId: finalSessionId,
          title: title || 'پارت جدید',
          videoUrl: videoUrl || '',
          coverImageUrl: coverImageUrl || null,
          clipOrder: Number(clipOrder || 1),
          duration: Number(duration || 0),
          unlockDate: unlockDate || null,
          unlockTime: unlockTime || null,
          scheduledUnlockTime: calculatedScheduledUnlockTime || null,
          isLocked: Boolean(isLocked)
        }
      });
    }
    
    res.json({ message: 'پارت با موفقیت ذخیره شد', data: clip });
  } catch (error) {
    console.error('createOrUpdateClip error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Explicit entry points so the target is never guessed from which id happens to be present.
// POST /lms/sessions/:id/clips  -> always CREATE a clip inside session :id
export const createClipForSession = async (req: Request, res: Response) => {
  req.body = { ...(req.body || {}), sessionId: req.params.id, clipId: undefined, id: undefined };
  return createOrUpdateClip(req, res);
};

// PUT /lms/clips/:id -> always UPDATE clip :id
export const updateClipById = async (req: Request, res: Response) => {
  req.body = { ...(req.body || {}), clipId: req.params.id };
  return createOrUpdateClip(req, res);
};

export const batchSaveStationContent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { stationTitle, stationDescription, releaseDate, clips, sessions } = req.body;

    await prisma.$transaction(async (tx) => {
      // 1. Update station basic info
      if (id) {
        const updateData: any = {};
        if (stationTitle) updateData.title = stationTitle;
        if (stationDescription !== undefined) updateData.description = stationDescription;
        if (releaseDate) updateData.releaseDate = new Date(releaseDate);
        if (Object.keys(updateData).length > 0) {
          await tx.station.update({
            where: { id },
            data: updateData
          });
        }
      }

      // 2. Update clips
      if (Array.isArray(clips)) {
        for (const clip of clips) {
          if (clip.id) {
            const clipUpdate: any = {};
            if (clip.title) clipUpdate.title = clip.title;
            if (clip.videoUrl !== undefined) clipUpdate.videoUrl = clip.videoUrl;
            if (clip.coverImageUrl !== undefined) clipUpdate.coverImageUrl = clip.coverImageUrl || null;
            if (clip.clipOrder !== undefined) clipUpdate.clipOrder = Number(clip.clipOrder);
            if (clip.unlockDate !== undefined) clipUpdate.unlockDate = clip.unlockDate || null;
            if (clip.unlockTime !== undefined) clipUpdate.unlockTime = clip.unlockTime || null;
            if (clip.isLocked !== undefined) clipUpdate.isLocked = Boolean(clip.isLocked);
            
            if (clip.scheduledUnlockTime !== undefined) {
              clipUpdate.scheduledUnlockTime = clip.scheduledUnlockTime ? new Date(clip.scheduledUnlockTime) : null;
            } else if (clip.unlockDate !== undefined) {
              if (clip.unlockDate && clip.unlockDate.trim() !== '') {
                try {
                  const dt = new Date(`${clip.unlockDate.trim()}T${(clip.unlockTime && clip.unlockTime.trim()) ? clip.unlockTime.trim() : '00:00'}`);
                  if (!isNaN(dt.getTime())) clipUpdate.scheduledUnlockTime = dt;
                } catch (_) {}
              } else {
                clipUpdate.scheduledUnlockTime = null;
              }
            }

            await tx.videoClip.update({
              where: { id: clip.id },
              data: clipUpdate
            });
          }
        }
      }

      // 3. Update sessions if any
      if (Array.isArray(sessions)) {
        for (const sess of sessions) {
          if (sess.id) {
            await tx.classSession.update({
              where: { id: sess.id },
              data: {
                ...(sess.title ? { title: sess.title } : {}),
                ...(sess.instructor ? { instructor: sess.instructor } : {}),
                ...(sess.sessionDate !== undefined ? { sessionDate: sess.sessionDate } : {}),
                ...(sess.sessionTime !== undefined ? { sessionTime: sess.sessionTime } : {}),
                ...(sess.handoutUrl !== undefined ? { handoutUrl: sess.handoutUrl || null } : {}),
                ...(sess.handoutTitle !== undefined ? { handoutTitle: sess.handoutTitle || null } : {}),
              }
            });
          }
        }
      }

      // Every touched part with a video must have a quiz
      if (Array.isArray(clips)) {
        await assertClipsHaveQuiz(tx, clips.filter((c: any) => c && c.id).map((c: any) => String(c.id)));
      }

      // 4. Update categories if any
      const { categories } = req.body;
      if (Array.isArray(categories)) {
        for (const cat of categories) {
          if (cat.id) {
            await tx.classCategory.update({
              where: { id: cat.id },
              data: {
                ...(cat.title ? { title: cat.title } : {}),
                ...(cat.orderIndex !== undefined ? { orderIndex: Number(cat.orderIndex) } : {})
              }
            });
          }
        }
      }
    });

    res.json({ message: 'کلیه تغییرات با موفقیت ثبت نهایی شد' });
  } catch (error: any) {
    console.error('batchSaveStationContent error:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'خطا در ثبت نهایی تغییرات' });
  }
};

export const reorderClips = async (req: Request, res: Response) => {
  try {
    const { id: sessionId } = req.params;
    const { clipIds } = req.body;
    if (!Array.isArray(clipIds) || clipIds.length === 0) {
      return res.status(400).json({ error: 'لیست شناسه‌های پارت‌ها الزامی است' });
    }

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < clipIds.length; i++) {
        await tx.videoClip.update({
          where: { id: clipIds[i] },
          data: { clipOrder: -(i + 1) }
        });
      }
      for (let i = 0; i < clipIds.length; i++) {
        await tx.videoClip.update({
          where: { id: clipIds[i] },
          data: { clipOrder: i + 1 }
        });
      }
    });

    res.json({ message: 'ترتیب پارت‌ها با موفقیت ذخیره شد' });
  } catch (error: any) {
    console.error('reorderClips error:', error);
    res.status(500).json({ error: error.message || 'خطا در تغییر ترتیب پارت‌ها' });
  }
};

// A quiz's zarik for a right answer: 0 is a valid choice; missing / invalid falls back to 10
function quizReward(v: any): number {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : 10;
}

export const createOrUpdateQuiz = async (req: Request, res: Response) => {
  try {
    const { id: paramId } = req.params;
    const { id: bodyId, quizId, sessionId, clipId, title, type, questionsJson, rewardZarik, rewardNakh, rewardFarsh, orderIndex } = req.body;
    const targetQuizId = quizId || (bodyId && !String(bodyId).startsWith('new_') ? bodyId : (paramId ? paramId : undefined));
    
    let quiz;
    if (targetQuizId) {
      quiz = await prisma.quiz.update({
        where: { id: targetQuizId },
        data: { 
          title: title || 'آزمونک پارت', 
          type: type || 'MULTIPLE_CHOICE', 
          questionsJson: typeof questionsJson === 'string' ? questionsJson : JSON.stringify(questionsJson || []), 
          rewardZarik: quizReward(rewardZarik), 
          rewardNakh: Number(rewardNakh || 0), 
          rewardFarsh: Number(rewardFarsh || 0),
          ...(clipId ? { clipId } : {}),
          ...(orderIndex !== undefined ? { orderIndex: Number(orderIndex) } : {})
        }
      });
    } else {
      quiz = await prisma.quiz.create({
        data: { 
          sessionId, 
          clipId: clipId || undefined,
          title: title || 'آزمونک پارت', 
          type: type || 'MULTIPLE_CHOICE', 
          questionsJson: typeof questionsJson === 'string' ? questionsJson : JSON.stringify(questionsJson || []), 
          rewardZarik: quizReward(rewardZarik), 
          rewardNakh: Number(rewardNakh || 0), 
          rewardFarsh: Number(rewardFarsh || 0),
          orderIndex: Number(orderIndex || 1)
        }
      });
    }
    clearStationsCache(); // the panel re-reads the stations right after this reply
    res.json({ message: 'آزمونک با موفقیت ذخیره شد', data: quiz });
  } catch (error) {
    console.error('createOrUpdateQuiz error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const setBatchCategoryZarik = async (req: Request, res: Response) => {
  try {
    const { id: categoryId } = req.params;
    const { rewardZarik } = req.body;
    const amount = parseInt(rewardZarik);
    if (isNaN(amount) || amount < 0) {
      return res.status(400).json({ error: 'مقدار زریک نامعتبر است' });
    }

    const sessions = await prisma.classSession.findMany({
      where: { categoryId },
      include: { quizzes: true, videoClips: { include: { quizzes: true } } }
    });

    const sessionIds = sessions.map(s => s.id);
    let quizIds: string[] = [];

    sessions.forEach(s => {
      (s.quizzes || []).forEach(q => quizIds.push(q.id));
      (s.videoClips || []).forEach(clip => {
        (clip.quizzes || []).forEach(q => quizIds.push(q.id));
      });
    });

    quizIds = Array.from(new Set(quizIds));

    await prisma.$transaction(async (tx) => {
      if (quizIds.length > 0) {
        await tx.quiz.updateMany({
          where: { id: { in: quizIds } },
          data: { rewardZarik: amount }
        });
      }
      if (sessionIds.length > 0) {
        await tx.classSession.updateMany({
          where: { id: { in: sessionIds } },
          data: { maxZarikReward: amount }
        });
      }
    });

    clearStationsCache(); // the panel re-reads the stations right after this reply
    res.json({ 
      message: `پاداش ${amount} زریک با موفقیت روی تمامی ${quizIds.length} آزمونک این دسته اعمال شد`, 
      updatedCount: quizIds.length,
      rewardZarik: amount,
      quizIds
    });
  } catch (error: any) {
    console.error('setBatchCategoryZarik error:', error);
    res.status(500).json({ error: error.message || 'خطا در اعمال پاداش زریک' });
  }
};

export const setBatchCategoryInstructor = async (req: Request, res: Response) => {
  try {
    const { id: categoryId } = req.params;
    const { instructor } = req.body;
    if (!instructor || typeof instructor !== 'string' || !instructor.trim()) {
      return res.status(400).json({ error: 'نام استاد / مدرس الزامی است' });
    }

    const cleanInstructor = instructor.trim();
    const updated = await prisma.classSession.updateMany({
      where: { categoryId },
      data: { instructor: cleanInstructor }
    });

    res.json({
      message: `نام استاد با موفقیت به «${cleanInstructor}» برای تمام ${updated.count} جلسه این دسته تغییر یافت`,
      updatedCount: updated.count,
      instructor: cleanInstructor
    });
  } catch (error: any) {
    console.error('setBatchCategoryInstructor error:', error);
    res.status(500).json({ error: error.message || 'خطا در اعمال نام استاد' });
  }
};

export const seedStations = async (req: Request, res: Response) => {
  try {
    const existing = await prisma.station.count();
    if (existing > 0) return res.status(400).json({ error: 'Stations already exist.' });
    
    const stations = [
      { title: 'منزلگاه اول', subtitle: 'آغاز راه', orderIndex: 1 },
      { title: 'منزلگاه دوم', subtitle: 'تثبیت مهارت', orderIndex: 2 },
      { title: 'منزلگاه سوم', subtitle: 'پیشرفت مستمر', orderIndex: 3 },
      { title: 'منزلگاه چهارم', subtitle: 'تسلط', orderIndex: 4 },
      { title: 'منزلگاه پنجم', subtitle: 'راهبران نوباوه', orderIndex: 5 },
    ];
    
    await prisma.station.createMany({ data: stations });
    res.json({ message: 'Seeded 5 base stations successfully' });
  } catch (error) {
    console.error('seedStations error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getBookmarks = async (req: any, res: Response) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const bookmarks = await prisma.videoBookmark.findMany({
      where: { sessionId, userId },
      orderBy: { videoSeconds: 'asc' }
    });
    res.json(bookmarks);
  } catch (error) {
    console.error('getBookmarks error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const addBookmark = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { sessionId, videoSeconds, noteText } = req.body;
    const bookmark = await prisma.videoBookmark.create({
      data: {
        sessionId,
        userId,
        videoSeconds,
        noteText
      }
    });
    res.status(201).json(bookmark);
  } catch (error) {
    console.error('addBookmark error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const heartbeatSessionWatch = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { id: sessionId } = req.params;
    const { currentPositionSeconds, durationSeconds } = req.body;

    if (currentPositionSeconds === undefined || !durationSeconds) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    let record = await prisma.sessionWatchRecord.findUnique({
      where: { userId_sessionId: { userId, sessionId } }
    });

    const now = new Date();

    if (!record) {
      record = await prisma.sessionWatchRecord.create({
        data: {
          userId,
          sessionId,
          watchedPercentage: 0,
          lastPositionSeconds: currentPositionSeconds,
          watchedSeconds: 0,
          lastWatchedAt: now
        }
      });
    } else {
      const elapsedRealSeconds = Math.max(0, Math.floor((now.getTime() - record.lastWatchedAt.getTime()) / 1000));
      const delta = currentPositionSeconds - record.lastPositionSeconds;

      // Time spent watching (wall clock, for the panel's charts): only while the position moves, at most 2 minutes per beat
      if (delta > 0 && elapsedRealSeconds > 0) void addActivity(userId, 'video', Math.min(elapsedRealSeconds, delta, 120), sessionId);

      if (delta > 0 && elapsedRealSeconds > 0) {
        const maxAllowedDelta = Math.max(5, elapsedRealSeconds * 2.5); // Support up to 2.5x speed
        if (delta <= maxAllowedDelta) {
          record.watchedSeconds += delta;
        } else {
          record.watchedSeconds += elapsedRealSeconds; // Cap at real elapsed time
        }
      }

      const watchedPercentage = Math.min(100.0, (record.watchedSeconds / durationSeconds) * 100.0);

      record = await prisma.sessionWatchRecord.update({
        where: { id: record.id },
        data: {
          watchedPercentage,
          lastPositionSeconds: currentPositionSeconds,
          watchedSeconds: record.watchedSeconds,
          lastWatchedAt: now
        }
      });
    }

    res.json({
      watchedPercentage: record.watchedPercentage,
      lastPositionSeconds: record.lastPositionSeconds,
      quizUnlocked: record.watchedPercentage >= 70.0
    });
    
    // Evaluate progress asynchronously (mentors have no personal progress/levels)
    if (!isMentorRole(req.user?.role)) evaluateStudentProgress(userId);
  } catch (error) {
    console.error('heartbeatSessionWatch error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getSessionWatchProgress = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { id: sessionId } = req.params;

    const record = await prisma.sessionWatchRecord.findUnique({
      where: { userId_sessionId: { userId, sessionId } }
    });

    if (!record) {
      return res.json({ resumePosition: 0, watchedPercentage: 0 });
    }

    const now = new Date();
    const elapsedMinutes = Math.floor((now.getTime() - record.lastWatchedAt.getTime()) / 60000);

    let resumePosition = record.lastPositionSeconds;
    if (elapsedMinutes > 60) {
      resumePosition = 0;
    }

    res.json({
      resumePosition,
      watchedPercentage: record.watchedPercentage
    });
  } catch (error) {
    console.error('getSessionWatchProgress error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const submitSessionQuiz = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { id: sessionId } = req.params;
    const { answers, quizId } = req.body;

    if (!Array.isArray(answers)) {
      return res.status(400).json({ error: 'فرمت پاسخ‌ها نامعتبر است' });
    }

    const session = await prisma.classSession.findUnique({
      where: { id: sessionId },
      include: { quizzes: true, category: true }
    });

    if (!session || !session.quizzes || session.quizzes.length === 0) {
      return res.status(404).json({ error: 'آزمون این جلسه یافت نشد' });
    }

    let targetQuiz: any = quizId ? session.quizzes.find(q => q.id === quizId) : undefined;
    if (!targetQuiz) {
      // Also search in videoClips
      const sessionWithClips = await prisma.classSession.findUnique({
        where: { id: sessionId },
        include: { videoClips: { include: { quizzes: true } } }
      });
      sessionWithClips?.videoClips.forEach(c => {
        (c.quizzes || []).forEach(q => {
          if (!targetQuiz && (q.id === quizId || !quizId)) targetQuiz = q;
        });
      });
    }

    if (!targetQuiz && session.quizzes.length > 0) {
      targetQuiz = session.quizzes[0];
    }

    if (!targetQuiz) {
      return res.status(404).json({ error: 'آزمون مشخص شده یافت نشد' });
    }

    const validQuiz = targetQuiz;

    const questionsList = validQuiz.questionsJson 
      ? (typeof validQuiz.questionsJson === 'string' ? JSON.parse(validQuiz.questionsJson) : validQuiz.questionsJson) 
      : [];
    let correctCount = 0;
    const correctAnswers: number[] = [];

    for (let i = 0; i < questionsList.length; i++) {
      const q = questionsList[i];
      const expectedCorrect = q.correctIndex !== undefined ? q.correctIndex : (q.correct !== undefined ? q.correct : q.correctAnswer);
      correctAnswers.push(Number(expectedCorrect));
      if (Number(answers[i]) === Number(expectedCorrect) || String(answers[i]) === String(expectedCorrect)) {
        correctCount++;
      }
    }

    const totalQuestions = questionsList.length || 1;
    const requiredCorrect = Math.min(session.minPassScore || 1, totalQuestions);
    let passed = false;
    let submissionStatus = 'PENDING';
    let rewardZarik = (validQuiz.rewardZarik !== undefined && validQuiz.rewardZarik !== null) ? validQuiz.rewardZarik : 10;
    const rewardNakh = validQuiz.rewardNakh || 0;
    const rewardFarsh = validQuiz.rewardFarsh || 0;

    const quizType = String(validQuiz.type || '').toUpperCase();
    if (quizType !== 'TEXT' && quizType !== 'FILE') {
      passed = correctCount >= (totalQuestions === 1 ? 1 : requiredCorrect);
      submissionStatus = passed ? 'APPROVED' : 'FAILED';
    } else {
      // For TEXT and FILE, it awaits mentor review
      passed = false;
      submissionStatus = 'PENDING';
    }

    // Mentors follow the same content order but earn nothing: no submission row (it would land in
    // review queues), no rewards, no notification. Only the per-clip progress is kept, which is
    // what unlocks the next part.
    if (isMentorRole(req.user?.role)) {
      if (passed) {
        const clip = await prisma.videoClip.findFirst({
          where: validQuiz.clipId ? { id: validQuiz.clipId } : { sessionId: session.id, clipOrder: validQuiz.orderIndex }
        });
        if (clip) {
          await prisma.userProgress.upsert({
            where: { userId_clipId: { userId, clipId: clip.id } },
            update: { quizPassed: true },
            create: {
              userId,
              clipId: clip.id,
              trackType: await trackTypeForCategory(prisma, session.category?.id, session.category?.stationId),
              stationId: session.category?.stationId || 'unknown',
              sessionId: session.id,
              quizPassed: true
            }
          });
        }
      }
      return res.json({
        score: correctCount,
        total: questionsList.length,
        passed,
        status: submissionStatus,
        correctAnswers,
        rewardZarik: 0,
        submissionId: null
      });
    }

    // Check if student has already passed this quiz to prevent double rewards
    const existingApproved = await prisma.quizSubmission.findFirst({
      where: { quizId: validQuiz.id, studentId: userId, status: 'APPROVED' }
    });

    const isFirstPass = passed && !existingApproved;

    let submission: any;
    await prisma.$transaction(async (tx) => {
      submission = await tx.quizSubmission.create({
        data: {
          quizId: validQuiz.id,
          studentId: userId,
          status: submissionStatus,
          score: correctCount,
          answersJson: JSON.stringify(answers)
        }
      });

      if (isFirstPass) {
        const reward = {
          userId,
          sourceType: 'class_quiz',
          sourceId: submission.id,
          reason: `پاداش شرکت در آزمون کلاس: ${session.title}`,
          createdBy: userId,
          zarikCategory: 'Quiz Rewards'
        };
        await changeBalance(tx, { ...reward, asset: 'zarik', amount: rewardZarik });
        await changeBalance(tx, { ...reward, asset: 'nakh', amount: rewardNakh });
        await changeBalance(tx, { ...reward, asset: 'farsh', amount: rewardFarsh });

        const clip = await tx.videoClip.findFirst({
          where: validQuiz.clipId ? { id: validQuiz.clipId } : { sessionId: session.id, clipOrder: validQuiz.orderIndex }
        });
        if (clip) {
          const trackType = await trackTypeForCategory(tx, session.category?.id, session.category?.stationId);
          const stationId = session.category?.stationId || 'unknown';
          let progress = await tx.userProgress.findUnique({
             where: { userId_clipId: { userId, clipId: clip.id } }
          });
          if (progress) {
             await tx.userProgress.update({
                where: { id: progress.id },
                data: { quizPassed: true }
             });
          } else {
             await tx.userProgress.create({
                data: {
                  userId,
                  clipId: clip.id,
                  trackType,
                  stationId,
                  sessionId: session.id,
                  quizPassed: true
                }
             });
          }
        }
      }
    });

    // Passing a quiz needs no notification; only the money it adds does, and it says why.
    if (passed && isFirstPass && rewardZarik > 0) {
      await prisma.notification.create({
        data: {
          userId,
          title: 'افزوده شدن سرمایه',
          message: `${rewardZarik} زریک به سرمایه شما اضافه شد. علت: شرکت موفق در آزمون «${session.title}».`,
          type: 'reward'
        }
      });
    }

    res.json({
      score: correctCount,
      total: questionsList.length,
      passed,
      status: submissionStatus,
      correctAnswers,
      rewardZarik: isFirstPass ? rewardZarik : 0,
      submissionId: submission?.id
    });
    
    // Evaluate progress asynchronously
    evaluateStudentProgress(userId);
  } catch (error) {
    console.error('submitSessionQuiz error:', error);
    res.status(500).json({ error: 'خطایی در تصحیح و ثبت آزمون کلاس رخ داد' });
  }
};

export const deleteStation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.station.delete({
      where: { id }
    });
    res.json({ message: 'Station deleted successfully' });
  } catch (error) {
    console.error('deleteStation error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getUserProgress = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    
    const progress = await prisma.userProgress.findMany({
      where: { userId }
    });
    res.json(progress);
  } catch (error) {
    console.error('getUserProgress error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * The signed-in user's answered quizzes (latest submission per quiz) with the answers they gave, so another
 * device can show them as answered / reviewable. clipId is the clip the quiz belongs to.
 */
export const getMyQuizAnswers = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const subs = await prisma.quizSubmission.findMany({
      where: { studentId: userId },
      orderBy: { submittedAt: 'desc' },
      include: { quiz: { select: { id: true, sessionId: true, clipId: true, orderIndex: true } } }
    });

    // Quizzes that are not linked to a clip are matched to the clip with the same order in their session
    const sessionIds = Array.from(new Set(subs.filter(x => !x.quiz.clipId).map(x => x.quiz.sessionId)));
    const clips = sessionIds.length
      ? await prisma.videoClip.findMany({ where: { sessionId: { in: sessionIds } }, select: { id: true, sessionId: true, clipOrder: true } })
      : [];
    const clipByOrder = new Map(clips.map(c => [`${c.sessionId}|${c.clipOrder}`, c.id]));

    const seen = new Set<string>();
    const out: any[] = [];
    for (const sub of subs) {
      if (seen.has(sub.quizId)) continue;
      seen.add(sub.quizId);
      let answers: any[] = [];
      try { const parsed = sub.answersJson ? JSON.parse(sub.answersJson) : []; if (Array.isArray(parsed)) answers = parsed; } catch (_) {}
      out.push({
        quizId: sub.quizId,
        sessionId: sub.quiz.sessionId,
        clipId: sub.quiz.clipId || clipByOrder.get(`${sub.quiz.sessionId}|${sub.quiz.orderIndex}`) || null,
        partIndex: Math.max(0, sub.quiz.orderIndex - 1),
        status: sub.status,
        score: sub.score,
        answers
      });
    }
    res.json(out);
  } catch (error) {
    console.error('getMyQuizAnswers error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/** The app reports the real length of a clip once its player knows it (replaces a missing/wrong stored duration). */
export const reportClipDuration = async (req: any, res: Response) => {
  try {
    const { clipId } = req.params;
    const seconds = Math.round(Number(req.body?.durationSeconds));
    if (!Number.isFinite(seconds) || seconds < 1 || seconds > 6 * 3600) {
      return res.status(400).json({ error: 'مدت ویدیو نامعتبر است' });
    }
    const clip = await prisma.videoClip.findUnique({ where: { id: clipId }, select: { duration: true } });
    if (!clip) return res.status(404).json({ error: 'کلیپ یافت نشد' });
    if (clip.duration === null || Math.abs(clip.duration - seconds) > 2) {
      await prisma.videoClip.update({ where: { id: clipId }, data: { duration: seconds } });
    }
    res.json({ duration: seconds });
  } catch (error) {
    console.error('reportClipDuration error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const markClipWatched = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    
    const { clipId } = req.params;
    const { trackType, stationId, sessionId } = req.body;
    
    let progress = await prisma.userProgress.findUnique({
      where: { userId_clipId: { userId, clipId } }
    });
    
    if (progress) {
      progress = await prisma.userProgress.update({
        where: { id: progress.id },
        data: { isWatched: true }
      });
    } else {
      progress = await prisma.userProgress.create({
        data: {
          userId,
          clipId,
          trackType: trackType || 'unknown',
          stationId: stationId || 'unknown',
          sessionId: sessionId || 'unknown',
          isWatched: true
        }
      });
    }
    
    res.json(progress);
  } catch (error) {
    console.error('markClipWatched error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.classCategory.delete({ where: { id } });
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
};

export const deleteSession = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.classSession.delete({ where: { id } });
    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
};

export const deleteClip = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.videoClip.delete({ where: { id } });
    res.json({ message: 'Clip deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete clip' });
  }
};

export const deleteQuiz = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.quiz.delete({ where: { id } });
    res.json({ message: 'Quiz deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete quiz' });
  }
};

export const reorderStations = async (req: Request, res: Response) => {
  try {
    const { stationIds, orders } = req.body;
    let orderedIds: string[] = [];

    if (Array.isArray(stationIds)) {
      orderedIds = stationIds;
    } else if (Array.isArray(orders)) {
      const sorted = [...orders].sort((a, b) => (Number(a.orderIndex) || 0) - (Number(b.orderIndex) || 0));
      orderedIds = sorted.map(s => s.id);
    }

    if (!orderedIds || orderedIds.length === 0) {
      return res.status(400).json({ error: 'لیست شناسه‌های منزلگاه‌ها الزامی است' });
    }

    // The first station keeps its display number (e.g. 0), so a drag never turns "منزلگاه ۰" into "۱"
    const existing = await prisma.station.findMany({ select: { orderIndex: true } });
    const base = existing.length ? Math.max(0, Math.min(...existing.map(s => s.orderIndex))) : 1;

    await prisma.$transaction(async (tx) => {
      // Step 1: Temporarily assign negative indices to prevent collisions
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.station.update({
          where: { id: orderedIds[i] },
          data: { orderIndex: -(i + 1) }
        });
      }
      // Step 2: Assign strictly unique sequential orderIndex from the base number
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.station.update({
          where: { id: orderedIds[i] },
          data: { orderIndex: base + i }
        });
      }
    });

    res.json({ message: 'ترتیب منزلگاه‌ها با موفقیت ذخیره و یکتا شد' });
  } catch (error: any) {
    console.error('reorderStations error:', error);
    res.status(500).json({ error: error.message || 'خطا در تغییر ترتیب منزلگاه‌ها' });
  }
};

export const updateStationAccess = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isLocked, status, scheduledUnlockTime, requirePreviousComplete, targetCaravansJson } = req.body;

    const station = await prisma.station.findUnique({ where: { id } });
    if (!station) {
      return res.status(404).json({ error: 'منزلگاه یافت نشد' });
    }

    const lockedBool = typeof isLocked === 'boolean' ? isLocked : (status === 'locked');
    const statusVal = status || (lockedBool ? 'locked' : 'active');

    let parsedUnlockTime: Date | null = null;
    if (scheduledUnlockTime && String(scheduledUnlockTime).trim() !== '') {
      const d = new Date(scheduledUnlockTime);
      if (!isNaN(d.getTime())) {
        parsedUnlockTime = d;
      }
    }

    const updated = await prisma.station.update({
      where: { id },
      data: {
        isLocked: lockedBool,
        status: statusVal,
        scheduledUnlockTime: parsedUnlockTime,
        requirePreviousComplete: Boolean(requirePreviousComplete),
        targetCaravansJson: typeof targetCaravansJson === 'string' ? targetCaravansJson : (targetCaravansJson ? JSON.stringify(targetCaravansJson) : null)
      }
    });

    res.json({
      success: true,
      message: 'تنظیمات وضعیت دسترسی منزلگاه با موفقیت بروزرسانی شد',
      station: updated
    });
  } catch (error: any) {
    console.error('updateStationAccess error:', error);
    res.status(500).json({ error: error.message || 'خطای سرور' });
  }
};

export const createStation = createOrUpdateStation;
export const updateStation = createOrUpdateStation;
export const createClass = createOrUpdateCategory;
export const updateClass = createOrUpdateCategory;
export const createSession = createOrUpdateSession;
export const updateSession = createOrUpdateSession;
export const createPart = createClipForSession;
// PUT /lms/sessions/:id/parts/:clipId -> the clip id is in :clipId, not :id (that is the session)
export const updatePart = async (req: Request, res: Response) => {
  req.body = { ...(req.body || {}), clipId: req.params.clipId, sessionId: undefined };
  return createOrUpdateClip(req, res);
};
export const createQuestion = createOrUpdateQuiz;
export const updateQuestion = createOrUpdateQuiz;

