import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
// @ts-ignore
import htmlPdf from 'html-pdf-node';

const prisma = new PrismaClient();

export const exportData = async (req: Request, res: Response) => {
  const { type, format } = req.query; // type: users, caravans, ledger, audit; format: pdf, excel, csv

  try {
    let data: any[] = [];
    let headers: string[] = [];

    if (type === 'users') {
      const users = await prisma.user.findMany({
        include: { caravan: true }
      });
      headers = ['ID', 'Name', 'Phone', 'Role', 'Level', 'Zarik', 'Caravan'];
      data = users.map(u => [u.id, u.name, u.phoneNumber, u.role, u.mentorLevel, u.zarikBalance, u.caravan?.name || '-']);
    } else if (type === 'caravans') {
      const caravans = await prisma.caravan.findMany({
        include: { mentor: true }
      });
      headers = ['ID', 'Name', 'Mentor', 'Members', 'Points', 'Progress'];
      data = caravans.map(c => [c.id, c.name, c.mentor?.name || '-', c.memberCount, c.groupPoints, c.overallProgress]);
    } else if (type === 'ledger') {
      const ledger = await prisma.zarikTransaction.findMany();
      headers = ['ID', 'UserID', 'Amount', 'Category', 'Reason', 'Date'];
      data = ledger.map(l => [l.id, l.userId, l.amount, l.category, l.reason, l.createdAt.toISOString()]);
    } else if (type === 'audit') {
      const logs = await prisma.auditLog.findMany();
      headers = ['ID', 'Actor', 'Action', 'Target', 'Details', 'Date'];
      data = logs.map(l => [l.id, l.actorName, l.action, l.targetEntity, l.details, l.createdAt.toISOString()]);
    } else {
      return res.status(400).json({ error: 'Invalid export type' });
    }

    if (format === 'csv') {
      const BOM = '\uFEFF';
      const csvContent = BOM + [
        headers.join(','),
        ...data.map(row => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      
      res.header('Content-Type', 'text/csv; charset=utf-8');
      res.attachment(`export_${type}.csv`);
      return res.send(csvContent);
    } 
    else if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
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
            }
            h1 { text-align: center; color: #333; }
            .date { text-align: left; font-size: 12px; color: #666; margin-bottom: 20px; }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
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
              ${data.map(row => `<tr>${row.map((cell: any) => `<td>${cell}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
        </body>
        </html>
      `;

      const options = { format: 'A4', margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' } };
      const file = { content: htmlContent };
      
      try {
        const pdfBuffer = await htmlPdf.generatePdf(file, options);
        res.header('Content-Type', 'application/pdf');
        res.attachment(`export_${type}.pdf`);
        return res.send(pdfBuffer);
      } catch (err) {
        console.error('PDF Generation Error:', err);
        return res.status(500).json({ error: 'PDF Generation failed' });
      }
    } else {
      return res.status(400).json({ error: 'Invalid format' });
    }
  } catch (error) {
    console.error('Export Error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
};
