import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/db';
import { isMentorRole } from '../utils/roles';

/** A mentor may act on a ticket only if its sender is in one of the mentor's caravans. */
export async function mentorOwnsTicket(mentorId: string, studentId: string): Promise<boolean> {
  const student = await prisma.user.findUnique({ where: { id: studentId }, select: { caravanId: true } });
  if (!student?.caravanId) return false;
  const caravan = await prisma.caravan.findFirst({ where: { id: student.caravanId, mentorId }, select: { id: true } });
  return !!caravan;
}

/** The ticket's sender, the mentor of their caravan and admins may act on a ticket. */
async function canActOnTicket(user: NonNullable<AuthRequest['user']>, studentId: string): Promise<boolean> {
  if (user.id === studentId) return true;
  if (String(user.role).toLowerCase() === 'admin') return true;
  return isMentorRole(user.role) && mentorOwnsTicket(user.id, studentId);
}

export async function createTicket(req: AuthRequest, res: Response) {
  try {
    const { category, subject, voiceUrl, attachmentUrl } = req.body;
    if (!category || !subject) return res.status(400).json({ error: 'دسته‌بندی و موضوع الزامی است' });
    
    const ticket = await prisma.supportTicket.create({
      data: {
        studentId: req.user!.id,
        category,
        subject,
        voiceUrl,
        attachmentUrl
      }
    });
    // Let the admins know: the support inbox in the panel is the only place these messages are answered
    const admins = await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } });
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map(a => ({
          userId: a.id,
          title: 'پیام جدید به پشتیبانی',
          message: String(subject).slice(0, 140),
          type: 'ticket' // the panel's bell opens this ticket
        }))
      });
    }
    res.json(ticket);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getTickets(req: AuthRequest, res: Response) {
  try {
    const isMentor = req.user!.role === 'mentor';
    
    let tickets;
    const { caravanId, userId, status } = req.query;
    
    let adminWhere: any = {};
    if (userId) adminWhere.studentId = userId;
    if (status) adminWhere.status = status;
    if (caravanId) {
      const usersInCaravan = await prisma.user.findMany({ where: { caravanId: String(caravanId) }, select: { id: true } });
      adminWhere.studentId = { in: usersInCaravan.map(u => u.id) };
    }

    if (req.user!.role === 'admin') {
      tickets = await prisma.supportTicket.findMany({
        where: adminWhere,
        include: {
          replies: { orderBy: { createdAt: 'asc' }, include: { mentor: { select: { id: true, name: true, avatarUrl: true, role: true } } } },
          // the caravan's mentor lets the panel group tickets by mentor (mentors' tickets tab)
          student: {
            select: {
              id: true, name: true, avatarUrl: true, phoneNumber: true, role: true, userCode: true,
              caravan: { select: { id: true, name: true, mentor: { select: { id: true, name: true, avatarUrl: true, phoneNumber: true } } } }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    } else if (isMentor) {
      // Mentors see tickets from all students in all their assigned caravans
      const caravans = await prisma.caravan.findMany({ where: { mentorId: req.user!.id } });
      if (caravans.length === 0) return res.json([]);
      
      const caravanIds = caravans.map(c => c.id);
      const members = await prisma.user.findMany({ where: { caravanId: { in: caravanIds } } });
      const memberIds = members.map(m => m.id);
      
      tickets = await prisma.supportTicket.findMany({
        where: { studentId: { in: memberIds } },
        include: { replies: true, student: { select: { name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      tickets = await prisma.supportTicket.findMany({
        where: { studentId: req.user!.id },
        include: { replies: true },
        orderBy: { createdAt: 'desc' }
      });
    }
    res.json(tickets);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function replyTicket(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { message, voiceUrl, attachmentUrl } = req.body;
    
    const ticket = await prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ error: 'تیکت یافت نشد' });
    if (!(await canActOnTicket(req.user!, ticket.studentId))) {
      return res.status(403).json({ error: 'به این تیکت دسترسی ندارید' });
    }
    
    const reply = await prisma.supportTicketReply.create({
      data: {
        ticketId: id,
        message,
        voiceUrl,
        attachmentUrl,
        mentorId: isMentorRole(req.user!.role) ? req.user!.id : null
      }
    });
    res.json(reply);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function resolveTicket(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { rating } = req.body; // Student can provide rating when resolving

    const ticket = await prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ error: 'تیکت یافت نشد' });
    if (!(await canActOnTicket(req.user!, ticket.studentId))) {
      return res.status(403).json({ error: 'به این تیکت دسترسی ندارید' });
    }

    await prisma.supportTicket.update({
      where: { id },
      data: { status: 'resolved', ratingGiven: req.user!.id === ticket.studentId ? rating : undefined }
    });
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
