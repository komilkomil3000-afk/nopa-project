import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/db';

export async function createMentorChallenge(req: AuthRequest, res: Response) {
  try {
    const { title, description, stationId, deadline, rewardZarik, verificationType } = req.body;
    if (!title || !description) return res.status(400).json({ error: 'عنوان و توضیحات الزامی است' });

    // Enforce mentor's own caravan
    const mentorCaravan = await prisma.caravan.findFirst({
      where: { mentorId: req.user!.id }
    });
    if (!mentorCaravan) {
      return res.status(400).json({ error: 'شما به عنوان راهبر به کاروانی متصل نیستید' });
    }
    const assignedCaravanId = mentorCaravan.id;

    const metadata = { stationId, caravanId: assignedCaravanId, deadline, verificationType };
    
    const challenge = await prisma.challenge.create({
      data: {
        title,
        description: description + `\n\n[Metadata: ${JSON.stringify(metadata)}]`,
        type: verificationType || 'skill',
        rewardZarik: parseInt(rewardZarik) || 200,
        createdByMentorId: req.user!.id,
        caravanId: assignedCaravanId
      }
    });

    // Notify ONLY target caravan students
    const targetStudents = await prisma.user.findMany({
      where: { caravanId: assignedCaravanId, role: 'student' }
    });

    if (targetStudents.length > 0) {
      await prisma.notification.createMany({
        data: targetStudents.map(s => ({
          userId: s.id,
          title: 'چالش جدید کاروان ابلاغ شد 🏆',
          message: `چالش جدید "${title}" توسط راهبر کاروان (${mentorCaravan.name}) برای شما ابلاغ گردید.`,
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
    const mentorCaravans = await prisma.caravan.findMany({
      where: { mentorId: req.user!.id },
      select: { id: true }
    });
    const caravanIds = mentorCaravans.map(c => c.id);

    const challenges = await prisma.challenge.findMany({
      where: {
        OR: [
          { createdByMentorId: req.user!.id },
          ...(caravanIds.length > 0 ? [{ caravanId: { in: caravanIds } }] : [])
        ]
      },
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

export async function getMentorCaravanProgress(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    
    // Find mentor's caravan
    const caravan = await prisma.caravan.findFirst({
      where: {
        OR: [
          { mentorId: userId },
          { members: { some: { id: userId } } }
        ]
      },
      include: {
        members: {
          where: { role: 'student' },
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            phoneNumber: true,
            zarikBalance: true,
            levelFrame: true
          }
        }
      }
    });

    // Fetch all stations with categories, sessions, clips, quizzes
    const stations = await prisma.station.findMany({
      include: {
        categories: {
          include: {
            sessions: {
              include: {
                videoClips: { orderBy: { clipOrder: 'asc' } },
                quizzes: true
              },
              orderBy: { orderIndex: 'asc' }
            }
          },
          orderBy: { orderIndex: 'asc' }
        }
      },
      orderBy: { orderIndex: 'asc' }
    });

    // Get watch records & quiz submissions for all caravan members
    const memberIds = caravan ? caravan.members.map(m => m.id) : [];
    
    const watchRecords = await prisma.sessionWatchRecord.findMany({
      where: { userId: { in: memberIds } }
    });

    const quizSubmissions = await prisma.quizSubmission.findMany({
      where: { studentId: { in: memberIds } }
    });

    res.json({
      caravan: caravan ? {
        id: caravan.id,
        name: caravan.name,
        memberCount: caravan.members.length
      } : null,
      members: caravan ? caravan.members : [],
      stations,
      watchRecords,
      quizSubmissions
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

