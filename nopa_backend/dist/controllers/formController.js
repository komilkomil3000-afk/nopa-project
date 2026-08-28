"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFormSubmissions = exports.submitForm = exports.deleteField = exports.createOrUpdateField = exports.deleteForm = exports.createOrUpdateForm = exports.getForms = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getForms = async (req, res) => {
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
    }
    catch (error) {
        console.error('getForms error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
exports.getForms = getForms;
const createOrUpdateForm = async (req, res) => {
    try {
        const { id, title, purpose, placement, targetAudience, targetCaravanId } = req.body;
        let form;
        if (id) {
            form = await prisma.dynamicForm.update({
                where: { id },
                data: { title, purpose, placement, targetAudience, targetCaravanId }
            });
        }
        else {
            form = await prisma.dynamicForm.create({
                data: { title, purpose, placement, targetAudience, targetCaravanId }
            });
        }
        res.json({ message: 'Form saved successfully', data: form });
    }
    catch (error) {
        console.error('createOrUpdateForm error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
exports.createOrUpdateForm = createOrUpdateForm;
const deleteForm = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.dynamicForm.delete({ where: { id } });
        res.json({ message: 'Form deleted successfully' });
    }
    catch (error) {
        console.error('deleteForm error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
exports.deleteForm = deleteForm;
const createOrUpdateField = async (req, res) => {
    try {
        const { id, formId, type, label, isRequired, orderIndex, optionsJson } = req.body;
        let field;
        if (id) {
            field = await prisma.formField.update({
                where: { id },
                data: { type, label, isRequired: Boolean(isRequired), orderIndex: Number(orderIndex || 0), optionsJson }
            });
        }
        else {
            field = await prisma.formField.create({
                data: { formId, type, label, isRequired: Boolean(isRequired), orderIndex: Number(orderIndex || 0), optionsJson }
            });
        }
        res.json({ message: 'Field saved successfully', data: field });
    }
    catch (error) {
        console.error('createOrUpdateField error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
exports.createOrUpdateField = createOrUpdateField;
const deleteField = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.formField.delete({ where: { id } });
        res.json({ message: 'Field deleted successfully' });
    }
    catch (error) {
        console.error('deleteField error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
exports.deleteField = deleteField;
const submitForm = async (req, res) => {
    try {
        const { formId, userId, answersJson } = req.body;
        const submission = await prisma.formSubmission.create({
            data: { formId, userId, answersJson: JSON.stringify(answersJson) }
        });
        res.status(201).json({ message: 'Form submitted successfully', data: submission });
    }
    catch (error) {
        console.error('submitForm error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
exports.submitForm = submitForm;
const getFormSubmissions = async (req, res) => {
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
    }
    catch (error) {
        console.error('getFormSubmissions error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
exports.getFormSubmissions = getFormSubmissions;
