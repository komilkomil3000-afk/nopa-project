"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportData = void 0;
const client_1 = require("@prisma/client");
const exceljs_1 = __importDefault(require("exceljs"));
// pdfmake temporarily disabled due to import issues
const prisma = new client_1.PrismaClient();
// PDFMake fonts configuration (For full Persian support, Vazirmatn is needed, using Helvetica as fallback here)
const fonts = {
    Roboto: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
    }
};
// const printer = new PdfPrinter(fonts);
const exportData = async (req, res) => {
    const { type, format } = req.query; // type: users, caravans, ledger, audit; format: pdf, excel, csv
    try {
        let data = [];
        let headers = [];
        if (type === 'users') {
            const users = await prisma.user.findMany({
                include: { caravan: true }
            });
            headers = ['ID', 'Name', 'Phone', 'Role', 'Level', 'Zarik', 'Caravan'];
            data = users.map(u => [u.id, u.name, u.phoneNumber, u.role, u.mentorLevel, u.zarikBalance, u.caravan?.name || '-']);
        }
        else if (type === 'caravans') {
            const caravans = await prisma.caravan.findMany({
                include: { mentor: true }
            });
            headers = ['ID', 'Name', 'Mentor', 'Members', 'Points', 'Progress'];
            data = caravans.map(c => [c.id, c.name, c.mentor?.name || '-', c.memberCount, c.groupPoints, c.overallProgress]);
        }
        else if (type === 'ledger') {
            const ledger = await prisma.zarikTransaction.findMany();
            headers = ['ID', 'UserID', 'Amount', 'Category', 'Reason', 'Date'];
            data = ledger.map(l => [l.id, l.userId, l.amount, l.category, l.reason, l.createdAt.toISOString()]);
        }
        else if (type === 'audit') {
            const logs = await prisma.auditLog.findMany();
            headers = ['ID', 'Actor', 'Action', 'Target', 'Details', 'Date'];
            data = logs.map(l => [l.id, l.actorName, l.action, l.targetEntity, l.details, l.createdAt.toISOString()]);
        }
        else {
            return res.status(400).json({ error: 'Invalid export type' });
        }
        if (format === 'csv') {
            const csvContent = [
                headers.join(','),
                ...data.map(row => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            ].join('\n');
            res.header('Content-Type', 'text/csv');
            res.attachment(`export_${type}.csv`);
            return res.send(csvContent);
        }
        else if (format === 'excel') {
            const workbook = new exceljs_1.default.Workbook();
            const sheet = workbook.addWorksheet('Export', { views: [{ rightToLeft: true }] });
            // Styling Headers
            const headerRow = sheet.addRow(headers);
            headerRow.font = { bold: true, size: 12 };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } };
            data.forEach(row => sheet.addRow(row));
            // Auto-fit columns roughly
            sheet.columns.forEach(column => {
                column.width = 20;
            });
            res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.attachment(`export_${type}.xlsx`);
            await workbook.xlsx.write(res);
            return res.end();
        }
        else if (format === 'pdf') {
            const generatedAt = new Date().toLocaleString('fa-IR');
            const docDefinition = {
                content: [
                    { text: `گزارش خروجی: ${type.toString().toUpperCase()}`, style: 'header', alignment: 'right' },
                    { text: `تاریخ تولید: ${generatedAt}`, style: 'subheader', alignment: 'right' },
                    {
                        table: {
                            headerRows: 1,
                            body: [
                                headers,
                                ...data.map(row => row.map((cell) => String(cell)))
                            ]
                        },
                        layout: 'lightHorizontalLines'
                    }
                ],
                styles: {
                    header: {
                        fontSize: 18,
                        bold: true,
                        margin: [0, 0, 0, 5]
                    },
                    subheader: {
                        fontSize: 10,
                        color: 'gray',
                        margin: [0, 0, 0, 15]
                    }
                },
                defaultStyle: {
                    font: 'Roboto',
                    alignment: 'right'
                }
            };
            return res.status(501).json({ error: 'PDF export not implemented' });
        }
        else {
            return res.status(400).json({ error: 'Invalid format' });
        }
    }
    catch (error) {
        console.error('Export Error:', error);
        res.status(500).json({ error: 'Export failed' });
    }
};
exports.exportData = exportData;
