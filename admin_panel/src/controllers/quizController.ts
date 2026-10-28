import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';

export async function createQuizMock(req: AuthRequest, res: Response) {
  try {
    const { title, rewardZarik, passScore } = req.body;
    
    // Mock success response as per Phase 1 requirements
    // Real quiz engine to be developed in Phase 3
    res.status(201).json({ 
      success: true, 
      message: 'آزمون با موفقیت ثبت شد (نسخه اولیه)',
      data: {
        id: 'mock-quiz-' + Date.now(),
        title,
        rewardZarik,
        passScore,
        createdAt: new Date()
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
