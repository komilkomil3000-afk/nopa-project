import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getForms = async (req: Request, res: Response) => {
  try {
    const forms = await prisma.dynamicForm.findMany({
      include: {
        fields: {
          orderBy: { orderIndex: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(forms);
  } catch (error) {
    console.error('getForms error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const createOrUpdateForm = async (req: Request, res: Response) => {
  try {
    const { id, title, purpose, placement, targetAudience, targetCaravanId } = req.body;
    let form;
    if (id) {
      form = await prisma.dynamicForm.update({
        where: { id },
        data: { title, purpose, placement, targetAudience, targetCaravanId }
      });
    } else {
      form = await prisma.dynamicForm.create({
        data: { title, purpose, placement, targetAudience, targetCaravanId }
      });
    }
    res.json({ message: 'Form saved successfully', data: form });
  } catch (error) {
    console.error('createOrUpdateForm error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const deleteForm = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.dynamicForm.delete({ where: { id } });
    res.json({ message: 'Form deleted successfully' });
  } catch (error) {
    console.error('deleteForm error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const createOrUpdateField = async (req: Request, res: Response) => {
  try {
    const { id, formId, type, label, isRequired, orderIndex, optionsJson } = req.body;
    let field;
    if (id) {
      field = await prisma.formField.update({
        where: { id },
        data: { type, label, isRequired: Boolean(isRequired), orderIndex: Number(orderIndex || 0), optionsJson }
      });
    } else {
      field = await prisma.formField.create({
        data: { formId, type, label, isRequired: Boolean(isRequired), orderIndex: Number(orderIndex || 0), optionsJson }
      });
    }
    res.json({ message: 'Field saved successfully', data: field });
  } catch (error) {
    console.error('createOrUpdateField error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const deleteField = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.formField.delete({ where: { id } });
    res.json({ message: 'Field deleted successfully' });
  } catch (error) {
    console.error('deleteField error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const submitForm = async (req: Request, res: Response) => {
  try {
    const { formId, userId, answersJson } = req.body;
    const submission = await prisma.formSubmission.create({
      data: { formId, userId, answersJson: JSON.stringify(answersJson) }
    });
    res.status(201).json({ message: 'Form submitted successfully', data: submission });
  } catch (error) {
    console.error('submitForm error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getFormSubmissions = async (req: Request, res: Response) => {
  try {
    const { formId } = req.params;
    const submissions = await prisma.formSubmission.findMany({
      where: { formId },
      include: {
        user: { select: { name: true, phoneNumber: true } }
      },
      orderBy: { submittedAt: 'desc' }
    });
    res.json(submissions);
  } catch (error) {
    console.error('getFormSubmissions error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
