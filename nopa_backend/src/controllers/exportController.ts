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
        
        c.members.forEach((m: any) => {
          totalZarik += m.zarikBalance || 0;
          let sessionsProgress = 0;
          let quizzesProgress = 0;
          if (m.sessionWatchRecords && m.sessionWatchRecords.length > 0) {
            sessionsProgress = m.sessionWatchRecords.reduce((sum: number, s: any) => sum + s.watchedPercentage, 0) / m.sessionWatchRecords.length;
          }
          if (m.quizSubmissions && m.quizSubmissions.length > 0) {
            quizzesProgress = m.quizSubmissions.reduce((sum: number, q: any) => sum + q.score, 0) / m.quizSubmissions.length;
          }
          totalProgress += (sessionsProgress + quizzesProgress) / 2;
        });

        const overallProgress = c.members.length > 0 ? totalProgress / c.members.length : 0;
        return [c.name, c.mentor?.name || '-', c._count.members, totalZarik, overallProgress.toFixed(1)];
      });
    } else if (type === 'ledger') {
      const ledger = await prisma.zarikTransaction.findMany();
      headers = ['ID', 'UserID', 'Amount', 'Category', 'Reason', 'Date'];
      data = ledger.map(l => [l.id, l.userId, l.amount, l.category, l.reason, l.createdAt.toISOString()]);
    } else if (type === 'audit') {
      const logs = await prisma.auditLog.findMany();
      headers = ['ID', 'Actor', 'Action', 'Target', 'Details', 'Date'];
      data = logs.map(l => [l.id, l.actorName, l.action, l.targetEntity, l.details, l.createdAt.toISOString()]);
    } else if (type === 'mentors') {
      const mentors = await prisma.user.findMany({
        where: {
          OR: [
            { role: { in: ['mentor', 'SUPER_MENTOR'] } },
            { mentoredCaravans: { some: {} } },
            { role: 'admin' }
          ]
        },
        include: {
          caravan: true,
          mentoredCaravans: true,
          ratingsReceived: true,
          evaluationsReceived: true
        },
        orderBy: { createdAt: 'desc' }
      });

      headers = [
        'ردیف',
        'نام و نام خانوادگی',
        'شماره همراه',
        'کد ملی',
        'مدرک و تخصص',
        'شهر سکونت',
        'کاروان‌های تحت هدایت',
        'سطح راهبری',
        'میانگین امتیاز',
        'وضعیت حساب'
      ];

      data = mentors.map((m, idx) => {
        const caravansStr = (m.mentoredCaravans && m.mentoredCaravans.length > 0)
          ? m.mentoredCaravans.map(c => c.name).join('، ')
          : (m.caravan?.name || 'فاقد کاروان');

        const ratings = m.ratingsReceived || [];
        const evals = m.evaluationsReceived || [];
        let totalRatingSum = 0;
        let totalRatingCount = 0;
        ratings.forEach((r: any) => {
          const val = Number(r.ratingValue) || Number(r.rating) || 0;
          if (val > 0) { totalRatingSum += val; totalRatingCount++; }
        });
        evals.forEach((e: any) => {
          const val = Number(e.rating) || Number(e.responsivenessScore) || 0;
          if (val > 0) { totalRatingSum += val; totalRatingCount++; }
        });

        let avgRatingText = 'فاقد ارزیابی (۰ نظر)';
        if (totalRatingCount > 0) {
          avgRatingText = `${(totalRatingSum / totalRatingCount).toFixed(1)} ⭐ (${totalRatingCount} نظر)`;
        }

        let levelStr = 'سطح ۱ (مقدماتی)';
        if (m.mentorLevel === 3) levelStr = 'سطح ۳ (ارشد)';
        else if (m.mentorLevel === 2) levelStr = 'سطح ۲ (پیشرفته)';

        let statusStr = 'فعال';
        if (m.accountStatus === 'SUSPENDED' || m.blocked || m.isDeleted) statusStr = 'مسدود / تعلیق';
        else if (m.accountStatus === 'PENDING_VERIFICATION') statusStr = 'در انتظار بررسی';

        return [
          idx + 1,
          m.name || 'راهبر بدون نام',
          m.phoneNumber || '-',
          m.nationalId || '-',
          m.academicDegree || 'عمومی',
          m.city || '-',
          caravansStr,
          levelStr,
          avgRatingText,
          statusStr
        ];
      });
    } else if (type === 'mentors_league') {
      const search = (req.query.search as string) || '';
      const sortBy = (req.query.sortBy as string) || 'rating';
      const whereClause: any = { role: 'mentor' };
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
      } else if (sortBy === 'progress') {
        rankedMentors.sort((a, b) => b.caravanProgress - a.caravanProgress);
      } else if (sortBy === 'activity') {
        rankedMentors.sort((a, b) => b.activityScore - a.activityScore);
      } else if (sortBy === 'level') {
        rankedMentors.sort((a, b) => b.mentorLevel - a.mentorLevel);
      }

      headers = ['رتبه', 'نام راهبر', 'موبایل', 'کاروان', 'میانگین ستاره', 'امتیاز فعالیت', 'پیشرفت کاروان'];
      data = rankedMentors.map((m, idx) => [idx + 1, m.name, m.phoneNumber, m.caravanName, m.rating, m.activityScore, m.caravanProgress + '%']);
    } else {
      return res.status(400).json({ error: 'Invalid export type' });
    }

    let reportTitle = `گزارش سامانه: ${type}`;
    if (type === 'mentors') reportTitle = 'گزارش جامع شناسنامه و مشخصات راهبران و اساتید آموزشی';
    else if (type === 'caravans') reportTitle = 'گزارش وضعیت و پیشرفت کاروان‌های آموزشی';
    else if (type === 'users') reportTitle = 'فهرست کاربران و دانش‌آموزان سامانه';
    else if (type === 'ledger') reportTitle = 'دفتر کل تراکنش‌های مالی و پاداش‌های زریک';
    else if (type === 'mentors_league') reportTitle = 'جدول لیگ و رتبه‌بندی برترین راهبران';

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
      const sheet = workbook.addWorksheet('گزارش نپا', { views: [{ rightToLeft: true }] });
      
      // Title row
      const titleRow = sheet.addRow([reportTitle]);
      titleRow.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.mergeCells(1, 1, 1, headers.length);
      sheet.getRow(1).height = 35;

      // Subtitle / Date
      const dateRow = sheet.addRow([`تاریخ تهیه گزارش: ${new Date().toLocaleDateString('fa-IR')} | تعداد رکوردها: ${data.length}`]);
      dateRow.font = { size: 10, italic: true, color: { argb: 'FF64748B' } };
      dateRow.alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.mergeCells(2, 1, 2, headers.length);
      sheet.getRow(2).height = 22;

      // Empty spacing row
      sheet.addRow([]);

      // Headers Row
      const headerRow = sheet.addRow(headers);
      headerRow.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      headerRow.height = 28;
      
      // Data Rows
      data.forEach((row, rIdx) => {
        const dRow = sheet.addRow(row);
        dRow.alignment = { horizontal: 'center', vertical: 'middle' };
        dRow.height = 22;
        if (rIdx % 2 === 1) {
          dRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        }
      });
      
      // Set column widths
      sheet.columns.forEach((column, cIdx) => {
        let maxLen = 14;
        if (headers[cIdx]) maxLen = Math.max(maxLen, headers[cIdx].length * 2);
        column.width = maxLen;
      });
      
      res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.attachment(`export_${type}.xlsx`);
      await workbook.xlsx.write(res);
      return res.end();
    }
    else if (format === 'pdf') {
      const generatedAt = new Date().toLocaleDateString('fa-IR');
      
      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="fa">
        <head>
          <meta charset="UTF-8">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;700&display=swap');
            body {
              font-family: 'Vazirmatn', Tahoma, 'B Yekan', sans-serif;
              padding: 24px;
              direction: rtl;
              text-align: right;
              background-color: #ffffff;
              color: #1e293b;
            }
            .header-box {
              border-bottom: 2px solid #0284c7;
              padding-bottom: 14px;
              margin-bottom: 20px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .title { font-size: 18px; font-weight: bold; color: #0f172a; margin: 0; }
            .meta { font-size: 11px; color: #64748b; margin-top: 5px; }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 15px;
              direction: rtl;
              font-size: 11px;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 9px 8px;
              text-align: center;
            }
            th {
              background-color: #0284c7;
              color: white;
              font-weight: bold;
            }
            tr:nth-child(even) {
              background-color: #f8fafc;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              font-size: 10px;
              color: #94a3b8;
              border-top: 1px solid #e2e8f0;
              padding-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="header-box">
            <div>
              <h1 class="title">سامانه جامع نپا | ${reportTitle}</h1>
              <div class="meta">تاریخ صدور گزارش: ${generatedAt} | تعداد کل رکوردها: ${data.length}</div>
            </div>
          </div>
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
          <div class="footer">تولید شده توسط سامانه مدیریت آموزشی نپا (NOPA ERP System)</div>
        </body>
        </html>
      `;

      const options = { format: 'A4', landscape: true, margin: { top: '15px', bottom: '15px', left: '15px', right: '15px' } };
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
