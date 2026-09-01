import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/db';

export async function createMentorChallenge(req: AuthRequest, res: Response) {
  try {
    const { title, description, stationId, caravanId, deadline, rewardZarik, verificationType } = req.body;
    if (!title || !description) return res.status(400).json({ error: 'عنوان و توضیحات الزامی است' });

    // Pack extra fields into questions JSON or just append to description if not available in schema
    // Since schema doesn't have stationId/deadline, we'll store them in description or questions
    const metadata = { stationId, caravanId, deadline, verificationType };
    
    const challenge = await prisma.challenge.create({
      data: {
        title,
        description: description + `\n\n[Metadata: ${JSON.stringify(metadata)}]`,
        type: verificationType || 'skill',
        rewardZarik: parseInt(rewardZarik) || 200,
        createdByMentorId: req.user!.id
      }
    });

    // Notify target caravan students
    const targetStudents = caravanId 
      ? await prisma.user.findMany({ where: { caravanId, role: 'student' } })
      : await prisma.user.findMany({ where: { role: 'student' } });

    if (targetStudents.length > 0) {
      await prisma.notification.createMany({
        data: targetStudents.map(s => ({
          userId: s.id,
          title: 'چالش جدید ابلاغ شد 🏆',
          message: `چالش جدید "${title}" توسط راهبر برای شما ابلاغ گردید.`,
          type: 'challenge'
        }))
      });
    }

    res.status(201).json(challenge);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getMentorChallenges(req: AuthRequest, res: Response) {
  try {
    const challenges = await prisma.challenge.findMany({
      where: { createdByMentorId: req.user!.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(challenges);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getChallengeSubmissions(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const submissions = await prisma.submission.findMany({
      where: { challengeId: id },
      include: {
        student: { select: { id: true, name: true, avatarUrl: true } }
      },
      orderBy: { submittedAt: 'desc' }
    });
    res.json(submissions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function reviewChallengeSubmission(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { status, rewardZarik, mentorFeedback } = req.body;
    
    const submission = await prisma.submission.findUnique({ where: { id }, include: { challenge: true } });
    if (!submission) return res.status(404).json({ error: 'یافت نشد' });

    await prisma.$transaction(async (tx) => {
      await tx.submission.update({
        where: { id },
        data: {
          status: status, // "APPROVED" or "REJECTED"
          score: parseInt(rewardZarik) || 0,
          mentorFeedback
        }
      });

      if (status === 'APPROVED' || status === 'approved') {
        await tx.user.update({
          where: { id: submission.studentId },
          data: { zarikBalance: { increment: parseInt(rewardZarik) || 0 } }
        });
      }
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getMentorTicketDetails(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        student: { select: { name: true, avatarUrl: true, phoneNumber: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: { mentor: { select: { name: true, avatarUrl: true } } }
        }
      }
    });
    if (!ticket) return res.status(404).json({ error: 'تیکت یافت نشد' });
    res.json(ticket);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function replyMentorTicket(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { message, voiceUrl, attachmentUrl } = req.body;
    if (!message) return res.status(400).json({ error: 'متن پیام الزامی است' });

    const reply = await prisma.supportTicketReply.create({
      data: {
        ticketId: id,
        message,
        voiceUrl,
        attachmentUrl,
        mentorId: req.user!.id
      }
    });

    // Update ticket status to answered
    await prisma.supportTicket.update({
      where: { id },
      data: { status: 'answered', updatedAt: new Date() }
    });

    res.json(reply);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
