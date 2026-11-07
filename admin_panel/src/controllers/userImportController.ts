// Bulk add of people from the panel's «افزودن گروهی» dialog (public/js/features/user-import.js).
//
//   POST /admin/users/import/parse  { fileName, data (base64) } -> { rows: string[][] }
//        Reads the first sheet of an Excel (.xlsx/.xls) or CSV file into plain text cells. The panel
//        maps the columns itself (the same flow serves text pasted from the clipboard).
//   POST /admin/users/import        { rows: ImportRow[], defaultPassword?, existing?: 'skip' | 'update' }
//        Creates every row (name + phone are the only required fields) and reports each row's result.
//
// Both routes are mounted with a larger JSON body limit in app.ts (USER_IMPORT_BODY_LIMIT).
import { Response } from 'express';
import bcrypt from 'bcryptjs';
import * as XLSX from 'xlsx';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { normalizePhone } from '../middleware/smsProtection';
import { isMentorRole } from '../utils/roles';
import { applyMentorCaravanChoice } from '../services/caravanMentor';
import { moveToCaravan } from '../services/caravanMembership';
import { ASSIGNABLE_ROLES, ROLE_ADMIN, ROLE_STUDENT, SUPER_ADMIN_ONLY_ROLES } from '../utils/roles';
import { avatarFor, normalizeGender } from '../utils/avatar';
import { logAdminAction } from './adminController';

export const MAX_IMPORT_ROWS = 2000;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const DEFAULT_PASSWORD = '123456';

const canonicalRole = (role: any) => String(role ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
const str = (v: any) => (v === undefined || v === null ? '' : String(v).trim());
const faDigits = (s: string) => s
  .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const intOr = (v: any, fallback: number) => {
  const n = parseInt(faDigits(str(v)), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export async function parseUserImportFile(req: AuthRequest, res: Response) {
  try {
    const fileName = str(req.body?.fileName).toLowerCase();
    const data = str(req.body?.data).replace(/^data:[^,]*,/, '');
    if (!data) return res.status(400).json({ error: 'فایلی دریافت نشد' });
    const buffer = Buffer.from(data, 'base64');
    if (buffer.length > MAX_FILE_BYTES) return res.status(413).json({ error: 'حجم فایل بیشتر از ۵ مگابایت است' });

    let wb: XLSX.WorkBook;
    if (/\.(csv|tsv|txt)$/.test(fileName)) {
      // Read text files as UTF-8 ourselves (xlsx guesses a legacy code page and breaks Persian text)
      let text = buffer.toString('utf8').replace(/^﻿/, '');
      const fs = /\.tsv$/.test(fileName) || (text.split('\n')[0] || '').includes('\t') ? '\t' : undefined;
      wb = XLSX.read(text, { type: 'string', raw: true, ...(fs ? { FS: fs } : {}) } as any);
    } else if (/\.(xlsx|xls|xlsm|ods)$/.test(fileName)) {
      wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
    } else {
      return res.status(400).json({ error: 'فقط فایل‌های Excel (xlsx/xls) یا CSV پشتیبانی می‌شوند' });
    }

    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return res.status(400).json({ error: 'فایل هیچ برگه‌ای ندارد' });
    const raw = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: false, defval: '', blankrows: false });
    const rows = raw
      .map(r => (Array.isArray(r) ? r.map(c => str(c)) : []))
      .filter(r => r.some(c => c !== ''));
    if (rows.length > MAX_IMPORT_ROWS + 1) {
      return res.status(400).json({ error: `حداکثر ${MAX_IMPORT_ROWS} ردیف در هر بار قابل افزودن است` });
    }
    res.json({ rows, sheet: wb.SheetNames[0] });
  } catch (error: any) {
    res.status(400).json({ error: 'فایل قابل خواندن نیست: ' + (error?.message || '') });
  }
}

interface RowResult { index: number; status: 'created' | 'updated' | 'skipped' | 'error'; message: string; userId?: string; }

export async function importUsers(req: AuthRequest, res: Response) {
  try {
    const rows: any[] = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!rows.length) return res.status(400).json({ error: 'هیچ ردیفی برای افزودن انتخاب نشده است' });
    if (rows.length > MAX_IMPORT_ROWS) return res.status(400).json({ error: `حداکثر ${MAX_IMPORT_ROWS} ردیف در هر بار قابل افزودن است` });
    const existingMode = req.body?.existing === 'update' ? 'update' : 'skip';
    const isSuper = canonicalRole(req.user?.role) === ROLE_ADMIN;

    const defaultPassword = str(req.body?.defaultPassword) || DEFAULT_PASSWORD;
    if (defaultPassword.length < 4) return res.status(400).json({ error: 'گذرواژه پیش‌فرض باید دست‌کم ۴ نویسه باشد' });
    const defaultHash = await bcrypt.hash(defaultPassword, 10);

    // caravans can be given by id or by name
    const caravans = await prisma.caravan.findMany({ select: { id: true, name: true } });
    const caravanById = new Map(caravans.map(c => [c.id, c.id]));
    const caravanByName = new Map(caravans.map(c => [str(c.name).replace(/\s+/g, ' ').toLowerCase(), c.id]));
    const resolveCaravan = (v: any): string | null | undefined => {
      const s = str(v);
      if (!s) return undefined;
      return caravanById.get(s) || caravanByName.get(s.replace(/\s+/g, ' ').toLowerCase()) || null;
    };

    const phones = rows.map(r => normalizePhone(str(r?.phoneNumber)));
    const existingUsers = await prisma.user.findMany({
      where: { phoneNumber: { in: phones.filter(Boolean) } },
      select: { id: true, phoneNumber: true, role: true, caravanId: true, isDeleted: true },
    });
    const existingByPhone = new Map(existingUsers.map(u => [u.phoneNumber, u]));

    const maxUser = await prisma.user.findFirst({ orderBy: { userCode: 'desc' }, where: { userCode: { not: null } } });
    let nextUserCode = maxUser && maxUser.userCode ? maxUser.userCode + 1 : 110100;

    const seen = new Set<string>();
    const touchedCaravans = new Set<string>();
    const results: RowResult[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] || {};
      const index = Number.isInteger(r.index) ? r.index : i;
      const name = str(r.name).replace(/\s+/g, ' ');
      const phone = phones[i];
      const fail = (message: string, status: RowResult['status'] = 'error') => results.push({ index, status, message });

      if (!name) { fail('نام وارد نشده است'); continue; }
      if (!/^09\d{9}$/.test(phone)) { fail('شماره همراه معتبر نیست (باید ۱۱ رقم و با ۰۹ شروع شود)'); continue; }
      if (seen.has(phone)) { fail('این شماره در همین فهرست تکراری است', 'skipped'); continue; }
      seen.add(phone);

      const role = canonicalRole(r.role) || ROLE_STUDENT;
      if (!ASSIGNABLE_ROLES.includes(role)) { fail('نقش نامعتبر است'); continue; }
      if (SUPER_ADMIN_ONLY_ROLES.includes(role) && !isSuper) { fail('ایجاد حساب مدیر فقط برای سوپر ادمین مجاز است'); continue; }

      const caravanId = resolveCaravan(r.caravanId ?? r.caravanName);
      if (caravanId === null) { fail(`کاروان «${str(r.caravanId ?? r.caravanName)}» پیدا نشد`); continue; }
      const gender = normalizeGender(r.gender) ?? null;
      const extra = {
        nationalId: faDigits(str(r.nationalId)) || undefined,
        dateOfBirth: faDigits(str(r.dateOfBirth)) || undefined,
        email: str(r.email) || undefined,
        city: str(r.city) || undefined,
        bio: str(r.bio) || undefined,
        slogan: str(r.slogan).slice(0, 30) || undefined,
        academicDegree: str(r.academicDegree) || undefined,
        academicCertificates: str(r.academicCertificates) || undefined,
      };
      const ownPassword = faDigits(str(r.password));

      try {
        const existing = existingByPhone.get(phone);
        if (existing && !existing.isDeleted) {
          if (existingMode === 'skip') { fail('این شماره قبلا ثبت شده است', 'skipped'); continue; }
          const protectedTarget = SUPER_ADMIN_ONLY_ROLES.includes(canonicalRole(existing.role));
          if (protectedTarget && !isSuper) { fail('ویرایش حساب مدیران فقط برای سوپر ادمین مجاز است', 'skipped'); continue; }
          // Roles of existing people only change for a super admin, never for an admin account or oneself
          const changeRole = isSuper && role !== canonicalRole(existing.role) && canonicalRole(existing.role) !== ROLE_ADMIN && existing.id !== req.user?.id;
          await prisma.user.update({
            where: { id: existing.id },
            data: {
              name,
              ...extra,
              ...(gender ? { gender } : {}),
              ...(str(r.levelFrame) ? { levelFrame: intOr(r.levelFrame, 1) } : {}),
              ...(str(r.mentorLevel) ? { mentorLevel: intOr(r.mentorLevel, 1) } : {}),
              ...(ownPassword.length >= 4 ? { passwordHash: await bcrypt.hash(ownPassword, 10) } : {}),
              ...(changeRole ? { role, tokenVersion: { increment: 1 } } : {}),
            },
          });
          if (changeRole) await prisma.userSession.deleteMany({ where: { userId: existing.id } });
          // A caravan change moves the person (assets and progress stay; groups and chats follow), or for a mentor
          // makes him the caravan's mentor
          if (caravanId !== undefined) {
            const roleNow = changeRole ? role : existing.role;
            if (isMentorRole(roleNow)) await applyMentorCaravanChoice(existing.id, roleNow, null, caravanId || null);
            else if ((caravanId || null) !== (existing.caravanId ?? null)) await moveToCaravan([existing.id], caravanId || null, { notify: false });
          }
          if (existing.caravanId) touchedCaravans.add(existing.caravanId);
          if (caravanId) touchedCaravans.add(caravanId);
          results.push({ index, status: 'updated', message: 'مشخصات به‌روز شد', userId: existing.id });
          continue;
        }
        if (existing && existing.isDeleted) { fail('این شماره متعلق به حساب حذف‌شده‌ای است', 'skipped'); continue; }

        const user = await prisma.user.create({
          data: {
            name,
            phoneNumber: phone,
            passwordHash: ownPassword.length >= 4 ? await bcrypt.hash(ownPassword, 10) : defaultHash,
            role,
            caravanId: isMentorRole(role) ? null : (caravanId || null),
            levelFrame: intOr(r.levelFrame, 1),
            mentorLevel: intOr(r.mentorLevel, 1),
            ...extra,
            nationalId: extra.nationalId || null,
            dateOfBirth: extra.dateOfBirth || null,
            gender,
            avatarUrl: avatarFor(role, gender, null) ?? null,
            identityVerified: true,
            userCode: nextUserCode++,
          },
        });
        if (isMentorRole(role) && caravanId) await applyMentorCaravanChoice(user.id, role, null, caravanId);
        if (caravanId) touchedCaravans.add(caravanId);
        results.push({ index, status: 'created', message: 'افزوده شد', userId: user.id });
      } catch (e: any) {
        fail(e?.code === 'P2002' ? 'شماره یا کد ملی تکراری است' : 'خطا در ذخیره: ' + (e?.message || ''));
      }
    }

    for (const id of touchedCaravans) {
      const count = await prisma.user.count({ where: { caravanId: id } });
      await prisma.caravan.update({ where: { id }, data: { memberCount: count } }).catch(() => {});
    }

    const count = (s: RowResult['status']) => results.filter(x => x.status === s).length;
    const summary = { created: count('created'), updated: count('updated'), skipped: count('skipped'), failed: count('error') };
    await logAdminAction(
      req.user?.id || 'system',
      req.user?.phoneNumber || 'Admin',
      'IMPORT_USERS',
      'User',
      'bulk',
      `افزودن گروهی همسفران: ${summary.created} نفر جدید، ${summary.updated} به‌روزرسانی، ${summary.skipped} ردشده، ${summary.failed} خطا`,
      req.ip || '127.0.0.1'
    );
    res.json({ summary, results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
