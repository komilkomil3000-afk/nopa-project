"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportData = void 0;
const client_1 = require("@prisma/client");
const exceljs_1 = __importDefault(require("exceljs"));
// @ts-ignore
const html_pdf_node_1 = __importDefault(require("html-pdf-node"));
const prisma = new client_1.PrismaClient();
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
                where: { isDeleted: false },
                include: {
                    mentor: true,
                    _count: { select: { members: { where: { isDeleted: false } } } },
                    members: {
                        where: { isDeleted: false },
                        select: {
                            zarikBalance: true,
                            sessionWatchRecords: { select: { watchedPercentage: true } },
                            quizSubmissions: { select: { score: true } }
                        }
                    }
                }
            });
            headers = ['نام کاروان', 'راهبر', 'تعداد اعضا', 'مجموع زریک', 'پیشرفت (%)'];
            data = caravans.map(c => {
                let totalProgress = 0;
                let totalZarik = 0;
                c.members.forEach((m) => {
                    totalZarik += m.zarikBalance || 0;
                    let sessionsProgress = 0;
                    let quizzesProgress = 0;
                    if (m.sessionWatchRecords && m.sessionWatchRecords.length > 0) {
                        sessionsProgress = m.sessionWatchRecords.reduce((sum, s) => sum + s.watchedPercentage, 0) / m.sessionWatchRecords.length;
                    }
                    if (m.quizSubmissions && m.quizSubmissions.length > 0) {
                        quizzesProgress = m.quizSubmissions.reduce((sum, q) => sum + q.score, 0) / m.quizSubmissions.length;
                    }
                    totalProgress += (sessionsProgress + quizzesProgress) / 2;
                });
                const overallProgress = c.members.length > 0 ? totalProgress / c.members.length : 0;
                return [c.name, c.mentor?.name || '-', c._count.members, totalZarik, overallProgress.toFixed(1)];
            });
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
        else if (type === 'mentors') {
            const mentors = await prisma.user.findMany({
                where: { role: 'mentor' },
                include: { caravan: true }
            });
            headers = ['نام و نام خانوادگی', 'موبایل', 'کد ملی', 'کاروان', 'سطح مربی', 'وضعیت اکانت'];
            data = mentors.map(m => [m.name, m.phoneNumber, m.nationalId || '-', m.caravan?.name || '-', m.mentorLevel, m.accountStatus]);
        }
        else if (type === 'mentors_league') {
            const search = req.query.search || '';
            const sortBy = req.query.sortBy || 'rating';
            const whereClause = { role: 'mentor' };
            if (search) {
                whereClause.OR = [
                    { name: { contains: search } },
                    { phoneNumber: { contains: search } }
                ];
            }
            const mentors = await prisma.user.findMany({
                where: whereClause,
                select: {
                    id: true,
                    name: true,
                    phoneNumber: true,
                    mentorLevel: true,
                    caravan: true,
                    submissions: { select: { id: true, status: true } },
                    supportReplies: { select: { id: true, createdAt: true } },
                    evaluationsReceived: true,
                }
            });
            const rankedMentors = mentors.map(m => {
                const evals = m.evaluationsReceived || [];
                const avg = evals.length > 0
                    ? evals.reduce((sum, e) => sum + e.rating, 0) / evals.length
                    : 4.5;
                const caravanProgress = m.caravan ? m.caravan.overallProgress : 0;
                const activityScore = m.submissions.length * 2 + m.supportReplies.length * 5;
                return {
                    name: m.name,
                    phoneNumber: m.phoneNumber,
                    caravanName: m.caravan?.name || '-',
                    mentorLevel: m.mentorLevel,
                    rating: parseFloat(avg.toFixed(1)),
                    caravanProgress,
                    activityScore
                };
            });
            if (sortBy === 'rating') {
                rankedMentors.sort((a, b) => b.rating - a.rating);
            }
            else if (sortBy === 'progress') {
                rankedMentors.sort((a, b) => b.caravanProgress - a.caravanProgress);
            }
            else if (sortBy === 'activity') {
                rankedMentors.sort((a, b) => b.activityScore - a.activityScore);
            }
            else if (sortBy === 'level') {
                rankedMentors.sort((a, b) => b.mentorLevel - a.mentorLevel);
            }
            headers = ['رتبه', 'نام راهبر', 'موبایل', 'کاروان', 'میانگین ستاره', 'امتیاز فعالیت', 'پیشرفت کاروان'];
            data = rankedMentors.map((m, idx) => [idx + 1, m.name, m.phoneNumber, m.caravanName, m.rating, m.activityScore, m.caravanProgress + '%']);
        }
        else {
            return res.status(400).json({ error: 'Invalid export type' });
        }
        if (format === 'csv') {
            const BOM = '\uFEFF';
            const csvContent = BOM + [
                headers.join(','),
                ...data.map(row => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            ].join('\n');
            res.header('Content-Type', 'text/csv; charset=utf-8');
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
            const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="fa">
        <head>
          <meta charset="UTF-8">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;700&display=swap');
            body {
              font-family: 'Vazirmatn', Tahoma, sans-serif;
              padding: 20px;
              direction: rtl;
              text-align: right;
            }
            h1 { text-align: center; color: #333; }
            .date { text-align: left; font-size: 12px; color: #666; margin-bottom: 20px; }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
              direction: rtl;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: center;
              font-size: 11px;
            }
            th {
              background-color: #8B5CF6;
              color: white;
            }
          </style>
        </head>
        <body>
          <h1>گزارش خروجی: ${type}</h1>
          <div class="date">تاریخ تولید: ${generatedAt}</div>
          <table>
            <thead>
              <tr>
                ${headers.map(h => `<th>${h}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${data.map(row => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
        </body>
        </html>
      `;
            const options = { format: 'A4', margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' } };
            const file = { content: htmlContent };
            try {
                const pdfBuffer = await html_pdf_node_1.default.generatePdf(file, options);
                res.header('Content-Type', 'application/pdf');
                res.attachment(`export_${type}.pdf`);
                return res.send(pdfBuffer);
            }
            catch (err) {
                console.error('PDF Generation Error:', err);
                return res.status(500).json({ error: 'PDF Generation failed' });
            }
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
