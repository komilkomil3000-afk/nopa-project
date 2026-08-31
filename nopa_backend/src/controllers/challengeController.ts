import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/db';

export async function createChallenge(req: AuthRequest, res: Response) {
  try {
    if (!req.user || (req.user.role !== 'mentor' && req.user.role !== 'admin')) {
      return res.status(403).json({ error: 'تنها مربی‌ها و مدیران می‌توانند چالش ایجاد کنند' });
    }

    const { title, description, type, questions, rewardZarik } = req.body;

    if (!title || !description || !type) {
      return res.status(400).json({ error: 'فیلدهای عنوان، توضیحات و نوع چالش الزامی هستند' });
    }

    const challenge = await prisma.challenge.create({
      data: {
        title,
        description,
        type,
        questions: questions ? JSON.stringify(questions) : null,
        rewardZarik: rewardZarik || 200,
        createdByMentorId: req.user.id
      }
    });

    // Create notifications for students
    const students = await prisma.user.findMany({
      where: { role: 'student' }
    });

    await prisma.notification.createMany({
      data: students.map(s => ({
        userId: s.id,
        title: 'چالش جدید ابلاغ شد 🏆',
        message: `چالش جدید "${title}" توسط راهبر منتشر گردید.`,
        type: 'challenge'
      }))
    });

    res.status(201).json(challenge);
  } catch (error) {
    console.error('createChallenge error:', error);
    res.status(500).json({ error: 'خطایی در ایجاد چالش رخ داد' });
  }
}

export async function getChallenges(req: AuthRequest, res: Response) {
  try {
    const challenges = await prisma.challenge.findMany({
      orderBy: { createdAt: 'desc' }
    });

    const parsedChallenges = challenges.map(c => ({
      ...c,
      questions: c.questions ? JSON.parse(c.questions) : null
    }));

    res.json(parsedChallenges);
  } catch (error) {
    console.error('getChallenges error:', error);
    res.status(500).json({ error: 'خطایی در دریافت لیست چالش‌ها رخ داد' });
  }
}

export async function submitQuiz(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'کاربر احراز هویت نشده است' });
    }

    const { id } = req.params;
    const { answers } = req.body; // Array of selected options indices, e.g. [0, 1, 0, 2, 1]

    if (!Array.isArray(answers)) {
      return res.status(400).json({ error: 'فرمت پاسخ‌ها نامعتبر است' });
    }

    const challenge = await prisma.challenge.findUnique({
      where: { id }
    });

    if (!challenge || challenge.type !== 'quiz') {
      return res.status(404).json({ error: 'آزمون مورد نظر یافت نشد' });
    }

    const questionsList = challenge.questions ? JSON.parse(challenge.questions) : [];
    let correctCount = 0;

    for (let i = 0; i < questionsList.length; i++) {
      if (answers[i] === questionsList[i].correct) {
        correctCount++;
      }
    }

    const calculatedReward = correctCount * 10; // 10 Zarik per correct answer

    // Update student balance
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        zarikBalance: { increment: calculatedReward }
      }
    });

    // Save submission record
    const submission = await prisma.submission.create({
      data: {
        challengeId: id,
        studentId: req.user.id,
        status: 'approved',
        score: correctCount,
        mentorFeedback: `ثبت خودکار پاسخنامه آزمون. نمره: ${correctCount}/${questionsList.length}`,
        answerText: `پاسخ‌ها: ${JSON.stringify(answers)}`
      }
    });

    // Send reward notification
    await prisma.notification.create({
      data: {
        userId: req.user.id,
        title: 'ثبت پاداش آزمون 💰',
        message: `آزمون شما بررسی شد. پاسخ‌های صحیح: ${correctCount} از ۵. مقدار پاداش: +${calculatedReward} زریک.`,
        type: 'reward'
      }
    });

    res.json({
      score: correctCount,
      total: questionsList.length,
      rewardZarik: calculatedReward,
      zarikBalance: updatedUser.zarikBalance,
      submissionId: submission.id
    });
  } catch (error) {
    console.error('submitQuiz error:', error);
    res.status(500).json({ error: 'خطایی در تصحیح و ثبت آزمون رخ داد' });
  }
}
