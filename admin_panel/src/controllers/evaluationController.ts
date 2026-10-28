import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/db';

export async function evaluateMentor(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'کاربر احراز هویت نشده است' });
    }

    const { mentorId, ratingValue, guidanceFeedback, seasonEvaluationComments } = req.body;

    if (!mentorId || !ratingValue) {
      return res.status(400).json({ error: 'شناسه راهبر و امتیاز ارزیابی الزامی هستند' });
    }

    const rating = await prisma.mentorRating.create({
      data: {
        mentorId,
        studentId: req.user.id,
        ratingValue: parseInt(ratingValue),
        guidanceFeedback,
        seasonEvaluationComments
      }
    });

    // Mark evaluation as done for the current season, unlocking exams
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        hasEvaluatedMentorThisSeason: true
      }
    });

    // Notify mentor about evaluation
    await prisma.notification.create({
      data: {
        userId: mentorId,
        title: 'ارزیابی راهبری جدید ثبت شد ⭐️',
        message: 'یکی از اعضای کاروان عملکرد شما در این فصل را ارزیابی نمود.',
        type: 'alert'
      }
    });

    res.status(201).json({
      success: true,
      ratingId: rating.id,
      hasEvaluatedMentorThisSeason: true
    });
  } catch (error) {
    console.error('evaluateMentor error:', error);
    res.status(500).json({ error: 'خطایی در ثبت ارزیابی راهبر رخ داد' });
  }
}
