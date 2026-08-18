import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/db';

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
        include: { replies: true, student: { select: { name: true, avatarUrl: true } } },
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
    
    const reply = await prisma.supportTicketReply.create({
      data: {
        ticketId: id,
        message,
        voiceUrl,
        attachmentUrl,
        mentorId: req.user!.role === 'mentor' ? req.user!.id : null
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
    
    await prisma.supportTicket.update({
      where: { id },
      data: { status: 'resolved', ratingGiven: rating }
    });
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
