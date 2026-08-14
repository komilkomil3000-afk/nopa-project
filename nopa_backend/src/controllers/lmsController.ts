import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getStations = async (req: Request, res: Response) => {
  try {
    const stations = await prisma.station.findMany({
      include: {
        categories: {
          include: {
            sessions: {
              include: { quiz: true },
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
    const { id, title, subtitle, description, iconUrl, orderIndex, releaseDate, releaseTime, scoringCriteriaJson } = req.body;
    let station;
    if (id) {
      station = await prisma.station.update({
        where: { id },
        data: { title, subtitle, description, iconUrl, orderIndex: Number(orderIndex || 0), releaseDate: releaseDate ? new Date(releaseDate) : null, releaseTime, scoringCriteriaJson }
      });
    } else {
      station = await prisma.station.create({
        data: { title, subtitle, description, iconUrl, orderIndex: Number(orderIndex || 0), releaseDate: releaseDate ? new Date(releaseDate) : null, releaseTime, scoringCriteriaJson }
      });
    }
    res.json({ message: 'Saved successfully', data: station });
  } catch (error) {
    console.error('createOrUpdateStation error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const createOrUpdateCategory = async (req: Request, res: Response) => {
  try {
    const { id, stationId, title, orderIndex } = req.body;
    let category;
    if (id) {
      category = await prisma.classCategory.update({
        where: { id },
        data: { title, orderIndex: Number(orderIndex || 0) }
      });
    } else {
      category = await prisma.classCategory.create({
        data: { stationId, title, orderIndex: Number(orderIndex || 0) }
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
    const { id, categoryId, title, description, videoUrl, instructor, minWatchThreshold, minPassScore, maxZarikReward, maxPointsReward, orderIndex } = req.body;
    let session;
    if (id) {
      session = await prisma.classSession.update({
        where: { id },
        data: { title, description, videoUrl, instructor, 
                minWatchThreshold: Number(minWatchThreshold || 70), 
                minPassScore: Number(minPassScore || 0), 
                maxZarikReward: Number(maxZarikReward || 0), 
                maxPointsReward: Number(maxPointsReward || 0), 
                orderIndex: Number(orderIndex || 0) }
      });
    } else {
      session = await prisma.classSession.create({
        data: { categoryId, title, description, videoUrl, instructor, 
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
      const existing = await prisma.quiz.findUnique({ where: { sessionId } });
      if (existing) {
         quiz = await prisma.quiz.update({
           where: { sessionId },
           data: { title, questionsJson, rewardZarik: Number(rewardZarik||0), rewardNakh: Number(rewardNakh||0), rewardFarsh: Number(rewardFarsh||0) }
         });
      } else {
         quiz = await prisma.quiz.create({
           data: { sessionId, title, questionsJson, rewardZarik: Number(rewardZarik||0), rewardNakh: Number(rewardNakh||0), rewardFarsh: Number(rewardFarsh||0) }
         });
      }
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
