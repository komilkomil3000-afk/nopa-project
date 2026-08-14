import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function getMentors(req: AuthRequest, res: Response) {
  try {
    const mentors = await prisma.user.findMany({
      where: { role: 'mentor' },
      include: {
        caravan: true,
        ratingsReceived: true,
        supportReplies: true
      }
    });

    res.json(mentors);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function createOrUpdateMentor(req: AuthRequest, res: Response) {
  try {
    const { id, name, phoneNumber, nationalId, academicDegree, caravanId, certificates, isSuperMentor } = req.body;

    let user;
    if (id) {
      const data: any = {
        name,
        phoneNumber,
        nationalId,
        academicDegree,
        academicCertificates: certificates,
        caravanId: caravanId || null
      };
      if (typeof isSuperMentor === 'boolean') {
        data.role = isSuperMentor ? 'SUPER_MENTOR' : 'mentor';
      }
      user = await prisma.user.update({
        where: { id },
        data
      });
    } else {
      user = await prisma.user.create({
        data: {
          name,
          phoneNumber,
          nationalId,
          role: isSuperMentor ? 'SUPER_MENTOR' : 'mentor',
          passwordHash: bcrypt.hashSync('123456', 10),
          academicDegree,
          academicCertificates: certificates,
          caravanId: caravanId || null
        }
      });
    }

    res.json({ success: true, user });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function grantFiveStars(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    
    // Admin granting 5 stars to mentor profile completion
    await prisma.mentorRating.create({
      data: {
        mentorId: id,
        studentId: req.user!.id, // admin as rater
        ratingValue: 5,
        guidanceFeedback: 'تکمیل پروفایل راهبری - اعطای ۵ ستاره پیش‌فرض'
      }
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getPendingDocuments(req: AuthRequest, res: Response) {
  try {
    const docs = await prisma.mentorDocument.findMany({
      where: { status: 'pending' },
      include: { user: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(docs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function approveDocument(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const doc = await prisma.mentorDocument.update({ where: { id }, data: { status: 'approved' } });
    // Mark user's identityVerified true when approving primary identity doc
    await prisma.user.update({ where: { id: doc.userId }, data: { identityVerified: true } });
    res.json({ success: true, doc });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function rejectDocument(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const doc = await prisma.mentorDocument.update({ where: { id }, data: { status: 'rejected', rejectReason: reason || null } });
    res.json({ success: true, doc });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getMentorHistory(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const challenges = await prisma.challenge.findMany({ where: { createdByMentorId: id } });
    const tickets = await prisma.supportTicket.findMany({ where: { studentId: id } });
    res.json({ challenges, tickets });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function assignCaravans(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params; // mentor id
    const { caravanIds } = req.body as { caravanIds?: string[] };
    if (!caravanIds || !Array.isArray(caravanIds)) {
      return res.status(400).json({ error: 'caravanIds must be an array' });
    }

    await prisma.$transaction(async (tx) => {
      // Clear previous mentor assignment for these caravans if any
      for (const caravanId of caravanIds) {
        await tx.caravan.updateMany({ where: { id: caravanId }, data: { mentorId: id } });
      }
    });

    res.json({ success: true, assigned: caravanIds.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function completeProfile(req: AuthRequest, res: Response) {
  try {
    const { nationalId, dateOfBirth, city, academicDegree, bio } = req.body;
    const userId = req.user!.id;

    await prisma.user.update({
      where: { id: userId },
      data: {
        nationalId,
        dateOfBirth,
        city,
        academicDegree,
        bio,
        identityVerified: true,
        zarikBalance: { increment: 500 }
      }
    });
    res.json({ success: true, message: 'اطلاعات پروفایل با موفقیت تکمیل شد و پاداش زریک دریافت کردید' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function evaluateMentor(req: AuthRequest, res: Response) {
  try {
    const { mentorId, stationId, rating, responsivenessScore, guidanceScore, feedbackText } = req.body;
    const studentId = req.user!.id;

    if (!mentorId || !rating) return res.status(400).json({ error: '??????? ??????? ???? ???' });

    const evaluation = await prisma.mentorEvaluation.create({
      data: {
        studentId,
        mentorId,
        stationId,
        rating,
        responsivenessScore: responsivenessScore || rating,
        guidanceScore: guidanceScore || rating,
        feedbackText
      }
    });

    res.json(evaluation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function savePrivateNote(req: AuthRequest, res: Response) {
  try {
    const { studentId, noteText } = req.body;
    const mentorId = req.user!.id;

    if (!studentId || !noteText) return res.status(400).json({ error: '??? ??????? ? ????????? ?????? ???' });

    const note = await prisma.privateStudentNote.create({
      data: {
        mentorId,
        studentId,
        noteText
      }
    });

    res.json(note);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getPrivateNotes(req: AuthRequest, res: Response) {
  try {
    const { studentId } = req.params;
    const notes = await prisma.privateStudentNote.findMany({
      where: {
        studentId,
        mentorId: req.user!.role === 'admin' ? undefined : req.user!.id
      },
      include: { mentor: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(notes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

