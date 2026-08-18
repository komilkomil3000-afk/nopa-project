import { Request, Response } from 'express';
import prisma from '../config/db';
import { evaluateStudentProgress } from './certificateController';

export const getStations = async (req: Request, res: Response) => {
  try {
    const stations = await prisma.station.findMany({
      include: {
        categories: {
          include: {
            sessions: {
              include: { 
                quizzes: true,
                videoClips: {
                  orderBy: { clipOrder: 'asc' }
                }
              },
              orderBy: { orderIndex: 'asc' }
            }
          },
          orderBy: { orderIndex: 'asc' }
        }
      },
      orderBy: { orderIndex: 'asc' }
    });
    res.json(stations);
  } catch (error) {
    console.error('getStations error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const createOrUpdateStation = async (req: Request, res: Response) => {
  try {
    const { id, title, subtitle, description, iconUrl, orderIndex, releaseDate, releaseTime, scoringCriteriaJson, categories } = req.body;
    
    const result = await prisma.$transaction(async (tx) => {
      let station;
      const releaseDateVal = releaseDate ? new Date(releaseDate) : null;
      const orderIndexVal = Number(orderIndex || 0);

      if (id) {
        station = await tx.station.update({
          where: { id },
          data: { title, subtitle, description, iconUrl, orderIndex: orderIndexVal, releaseDate: releaseDateVal, releaseTime, scoringCriteriaJson }
        });
      } else {
        station = await tx.station.create({
          data: { title, subtitle, description, iconUrl, orderIndex: orderIndexVal, releaseDate: releaseDateVal, releaseTime, scoringCriteriaJson }
        });
      }

      if (categories && Array.isArray(categories)) {
        const existingCategories = await tx.classCategory.findMany({
          where: { stationId: station.id }
        });
        const existingCategoryIds = existingCategories.map(c => c.id);
        const incomingCategoryIds = categories.filter(c => c.id).map(c => c.id);

        const categoriesToDelete = existingCategoryIds.filter(cid => !incomingCategoryIds.includes(cid));
        if (categoriesToDelete.length > 0) {
          await tx.classCategory.deleteMany({
            where: { id: { in: categoriesToDelete } }
          });
        }

        for (let i = 0; i < categories.length; i++) {
          const cat = categories[i];
          let dbCategory;
          if (cat.id && existingCategoryIds.includes(cat.id)) {
            dbCategory = await tx.classCategory.update({
              where: { id: cat.id },
              data: { title: cat.title, orderIndex: Number(cat.orderIndex || i) }
            });
          } else {
            dbCategory = await tx.classCategory.create({
              data: { stationId: station.id, title: cat.title, orderIndex: Number(cat.orderIndex || i) }
            });
          }

          const incomingSessions = cat.sessions || [];
          const existingSessions = await tx.classSession.findMany({
            where: { categoryId: dbCategory.id }
          });
          const existingSessionIds = existingSessions.map(s => s.id);
          const incomingSessionIds = incomingSessions.filter((s: any) => s.id).map((s: any) => s.id);

          const sessionsToDelete = existingSessionIds.filter(sid => !incomingSessionIds.includes(sid));
          if (sessionsToDelete.length > 0) {
            await tx.classSession.deleteMany({
              where: { id: { in: sessionsToDelete } }
            });
          }

          for (let j = 0; j < incomingSessions.length; j++) {
            const sess = incomingSessions[j];
            let dbSession;
            const sessData = {
              title: sess.title,
              description: sess.description || '',
              videoUrl: sess.videoUrl || '',
              instructor: sess.instructor || 'استاد نپا',
              minWatchThreshold: Number(sess.minWatchThreshold || 70.0),
              minPassScore: Number(sess.minPassScore || 0),
              maxZarikReward: Number(sess.maxZarikReward || 0),
              maxPointsReward: Number(sess.maxPointsReward || 0),
              orderIndex: Number(sess.orderIndex || j)
            };

            if (sess.id && existingSessionIds.includes(sess.id)) {
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
            const incomingClipIds = incomingClips.filter((clip: any) => clip.id).map((clip: any) => clip.id);

            const clipsToDelete = existingClipIds.filter(cid => !incomingClipIds.includes(cid));
            if (clipsToDelete.length > 0) {
              await tx.videoClip.deleteMany({
                where: { id: { in: clipsToDelete } }
              });
            }

            for (let k = 0; k < incomingClips.length; k++) {
              const clip = incomingClips[k];
              const clipData = {
                title: clip.title,
                videoUrl: clip.videoUrl,
                clipOrder: Number(clip.clipOrder || k),
                duration: Number(clip.duration || 0)
              };

              if (clip.id && existingClipIds.includes(clip.id)) {
                await tx.videoClip.update({
                  where: { id: clip.id },
                  data: clipData
                });
              } else {
                await tx.videoClip.create({
                  data: {
                    sessionId: dbSession.id,
                    ...clipData
                  }
                });
              }
            }

            const incomingQuizzes = sess.quizzes || (sess.quiz ? [sess.quiz] : []);
            await tx.quiz.deleteMany({
              where: { sessionId: dbSession.id }
            });
            for (let q = 0; q < incomingQuizzes.length; q++) {
              const quizPayload = incomingQuizzes[q];
              await tx.quiz.create({
                data: {
                  sessionId: dbSession.id,
                  title: quizPayload.title || 'آزمون کلاس',
                  questionsJson: quizPayload.questionsJson,
                  rewardZarik: Number(quizPayload.rewardZarik || 0),
                  rewardNakh: Number(quizPayload.rewardNakh || 0),
                  rewardFarsh: Number(quizPayload.rewardFarsh || 0),
                  orderIndex: Number(quizPayload.orderIndex || q + 1)
                }
              });
            }
          }
        }
      }

      return station;
    });

    res.json({ message: 'Saved successfully', data: result });
  } catch (error) {
    console.error('createOrUpdateStation error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const createOrUpdateCategory = async (req: Request, res: Response) => {
  try {
    const { id, stationId, packageId, title, orderIndex } = req.body;
    const finalStationId = stationId || packageId;
    let category;
    if (id) {
      category = await prisma.classCategory.update({
        where: { id },
        data: { title, orderIndex: Number(orderIndex || 0) }
      });
    } else {
      category = await prisma.classCategory.create({
        data: { stationId: finalStationId, title, orderIndex: Number(orderIndex || 0) }
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
    const { id, categoryId, subCourseId, title, description, videoUrl, instructor, teacher, minWatchThreshold, minPassScore, maxZarikReward, maxPointsReward, orderIndex } = req.body;
    const finalCategoryId = categoryId || subCourseId;
    const finalInstructor = instructor || teacher;
    let session;
    if (id) {
      session = await prisma.classSession.update({
        where: { id },
        data: { title, description, videoUrl, instructor: finalInstructor, 
                minWatchThreshold: Number(minWatchThreshold || 70), 
                minPassScore: Number(minPassScore || 0), 
                maxZarikReward: Number(maxZarikReward || 0), 
                maxPointsReward: Number(maxPointsReward || 0), 
                orderIndex: Number(orderIndex || 0) }
      });
    } else {
      session = await prisma.classSession.create({
        data: { categoryId: finalCategoryId, title, description, videoUrl, instructor: finalInstructor, 
                minWatchThreshold: Number(minWatchThreshold || 70), 
                minPassScore: Number(minPassScore || 0), 
                maxZarikReward: Number(maxZarikReward || 0), 
                maxPointsReward: Number(maxPointsReward || 0), 
                orderIndex: Number(orderIndex || 0) }
      });
    }
    res.json({ message: 'Saved successfully', data: session });
  } catch (error) {
    console.error('createOrUpdateSession error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const addClipToSession = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, clipOrder, videoUrl } = req.body;
    
    const clip = await prisma.videoClip.create({
      data: {
        sessionId: id,
        title,
        videoUrl,
        clipOrder: Number(clipOrder || 0),
        duration: 0
      }
    });
    
    res.json({ message: 'Clip added successfully', data: clip });
  } catch (error) {
    console.error('addClipToSession error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const createOrUpdateQuiz = async (req: Request, res: Response) => {
  try {
    const { id, sessionId, title, questionsJson, rewardZarik, rewardNakh, rewardFarsh } = req.body;
    let quiz;
    if (id) {
      quiz = await prisma.quiz.update({
        where: { id },
        data: { title, questionsJson, rewardZarik: Number(rewardZarik||0), rewardNakh: Number(rewardNakh||0), rewardFarsh: Number(rewardFarsh||0) }
      });
    } else {
      quiz = await prisma.quiz.create({
        data: { sessionId, title, questionsJson, rewardZarik: Number(rewardZarik||0), rewardNakh: Number(rewardNakh||0), rewardFarsh: Number(rewardFarsh||0) }
      });
    }
    res.json({ message: 'Saved successfully', data: quiz });
  } catch (error) {
    console.error('createOrUpdateQuiz error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
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
    
    // Evaluate progress asynchronously
    evaluateStudentProgress(userId);
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
      include: { quizzes: true }
    });

    if (!session || !session.quizzes || session.quizzes.length === 0) {
      return res.status(404).json({ error: 'آزمون این جلسه یافت نشد' });
    }

    const targetQuiz = quizId ? session.quizzes.find(q => q.id === quizId) : session.quizzes[0];
    if (!targetQuiz) {
      return res.status(404).json({ error: 'آزمون مشخص شده یافت نشد' });
    }

    const questionsList = targetQuiz.questionsJson ? JSON.parse(targetQuiz.questionsJson) : [];
    let correctCount = 0;

    for (let i = 0; i < questionsList.length; i++) {
      if (answers[i] === questionsList[i].correct) {
        correctCount++;
      }
    }

    const minPass = session.minPassScore || 3;
    const passed = correctCount >= minPass;

    const rewardZarik = targetQuiz.rewardZarik || 200;
    const rewardNakh = targetQuiz.rewardNakh || 0;
    const rewardFarsh = targetQuiz.rewardFarsh || 0;

    // Check if student has already passed this quiz to prevent double rewards
    const existingApproved = await prisma.quizSubmission.findFirst({
      where: { quizId: targetQuiz.id, studentId: userId, status: 'APPROVED' }
    });

    const isFirstPass = passed && !existingApproved;

    let submission: any;
    await prisma.$transaction(async (tx) => {
      submission = await tx.quizSubmission.create({
        data: {
          quizId: targetQuiz.id,
          studentId: userId,
          status: passed ? 'APPROVED' : 'FAILED',
          score: correctCount,
          answersJson: JSON.stringify(answers)
        }
      });

      if (isFirstPass) {
        // Increment student balance and assets
        await tx.user.update({
          where: { id: userId },
          data: {
            zarikBalance: { increment: rewardZarik },
            nakh: { increment: rewardNakh },
            farsh: { increment: rewardFarsh }
          }
        });

        // Log transaction in ZarikTransaction if zarik is awarded
        if (rewardZarik > 0) {
          await tx.zarikTransaction.create({
            data: {
              userId,
              amount: rewardZarik,
              category: 'Quiz Rewards',
              reason: `پاداش شرکت در آزمون کلاس: ${session.title}`,
              createdBy: userId
            }
          });
        }
      }
    });

    // Send notification
    await prisma.notification.create({
      data: {
        userId,
        title: passed ? 'قبولی در آزمون کلاس 🎉' : 'نتیجه آزمون کلاس 📝',
        message: passed
          ? `تبریک! شما در آزمون "${session.title}" قبول شدید. نمره: ${correctCount}/${questionsList.length}. پاداش: +${rewardZarik} زریک`
          : `شما در آزمون "${session.title}" نمره قبولی کسب نکردید. نمره: ${correctCount}/${questionsList.length}. مجدداً تلاش کنید.`,
        type: 'reward'
      }
    });

    res.json({
      score: correctCount,
      total: questionsList.length,
      passed,
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
