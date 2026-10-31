/**
 * Catalog of everything a non-super-admin can be allowed to do in the admin panel.
 *
 * Each permission key maps to:
 *   - rules: the /api/v1/admin/* requests it unlocks (method + path relative to the admin router)
 *   - tabs : the panel tabs that show up in the sidebar when the key is granted
 *
 * Anything NOT listed here (role management, the permission matrix itself, creating admins)
 * stays super-admin-only and can never be delegated.
 *
 * Which keys each role has is stored in the database (RolePermission.permissionsJson) and edited
 * by the super admin in the panel. DEFAULT_ROLE_PERMISSIONS is used until it is edited, and equals
 * what each role could do before this catalog existed.
 */
export interface Rule {
  methods: string[];
  path: RegExp;
}

export interface PermissionDef {
  key: string;
  group: string;
  label: string;
  /** Powerful: shown with a warning in the matrix. */
  sensitive?: boolean;
  tabs?: string[];
  rules: Rule[];
}

const GET = ['GET'];
const WRITE = ['POST', 'PUT', 'PATCH', 'DELETE'];
const r = (methods: string[], path: RegExp): Rule => ({ methods, path });

export const PERMISSIONS: PermissionDef[] = [
  // ---- کاربران
  { key: 'users.view', group: 'کاربران', label: 'مشاهده دایرکتوری کاربران و پروفایل‌ها', tabs: ['users-tab', 'levels-tab'], rules: [
    r(GET, /^\/users$/i), r(GET, /^\/users\/metrics$/i), r(GET, /^\/users\/(?!export$)[^/]+$/i),
    r(GET, /^\/users\/[^/]+\/analytics$/i), r(GET, /^\/levels-and-certificates$/i),
  ]},
  { key: 'users.manage', group: 'کاربران', label: 'ایجاد، ویرایش، مسدودسازی و حذف کاربران', sensitive: true, rules: [
    r(['POST'], /^\/users$/i), r(['PUT'], /^\/users\/[^/]+$/i), r(['PATCH'], /^\/users\/[^/]+\/(block|status)$/i),
    r(['DELETE'], /^\/users\/[^/]+$/i), r(['POST'], /^\/students$/i), r(['POST'], /^\/students\/[^/]+\/level-frame$/i),
    r(['POST'], /^\/levels\/grant$/i),
  ]},
  { key: 'users.password', group: 'کاربران', label: 'تعیین گذرواژه‌ی جدید برای کاربران', sensitive: true, rules: [
    r(['POST'], /^\/users\/[^/]+\/override-password$/i),
  ]},
  { key: 'users.export', group: 'کاربران', label: 'خروجی گرفتن از اطلاعات (Excel / CSV)', sensitive: true, rules: [
    r(GET, /^\/users\/export$/i), r(GET, /^\/export$/i),
  ]},

  // ---- کیف پول
  { key: 'wallet.ledger', group: 'کیف پول و پاداش', label: 'مشاهده دفتر تراکنش‌های زریک', tabs: ['rewards-tab'], rules: [r(GET, /^\/rewards\/ledger$/i)] },
  { key: 'wallet.reports', group: 'کیف پول و پاداش', label: 'گزارش‌ها و آمار اقتصاد زریک', tabs: ['rewards-tab'], rules: [
    r(GET, /^\/rewards\/(analytics|stats|rules|mentor-rules)$/i), r(GET, /^\/zarik\/economy-hub$/i), r(GET, /^\/wallet\/economy-hub-analytics$/i),
  ]},
  { key: 'wallet.adjust', group: 'کیف پول و پاداش', label: 'افزودن یا کسر زریک و پاداش', sensitive: true, rules: [
    r(['POST'], /^\/rewards\/(adjust|grant)$/i), r(['POST'], /^\/students\/[^/]+\/adjust-balance$/i),
  ]},
  { key: 'wallet.rules', group: 'کیف پول و پاداش', label: 'تعریف و حذف قوانین پاداش', sensitive: true, rules: [
    r(['POST'], /^\/rewards\/(rules|mentor-rules)$/i), r(['DELETE'], /^\/rewards\/mentor-rules\/[^/]+$/i),
  ]},
  { key: 'leaderboards.view', group: 'کیف پول و پاداش', label: 'مشاهده جدول رتبه‌بندی‌ها', rules: [r(GET, /^\/leaderboard\/(assets|individuals|caravans)$/i)] },

  // ---- کاروان‌ها
  { key: 'caravans.list', group: 'کاروان‌ها', label: 'فقط فهرست نام کاروان‌ها (برای انتخاب مخاطب)', rules: [r(GET, /^\/caravans$/i)] },
  { key: 'caravans.view', group: 'کاروان‌ها', label: 'مشاهده جزئیات و اعضای کاروان‌ها', tabs: ['caravans-tab'], rules: [
    r(GET, /^\/caravans(\/[^/]+)?$/i), r(GET, /^\/asset-conversions$/i),
  ]},
  { key: 'caravans.manage', group: 'کاروان‌ها', label: 'ساخت، ویرایش و حذف کاروان و مدیریت اعضا', sensitive: true, rules: [
    r(['POST'], /^\/caravans$/i), r(['PUT', 'PATCH'], /^\/caravans\/[^/]+$/i), r(['DELETE'], /^\/caravans\/[^/]+$/i),
    r(['PUT'], /^\/caravans\/[^/]+\/(status|block-members)$/i), r(['POST'], /^\/caravans\/(bulk-transfer|transfer)$/i),
    r(['POST'], /^\/caravans\/[^/]+\/members\/bulk-add$/i), r(['POST', 'DELETE'], /^\/caravans\/[^/]+\/members\/[^/]+$/i),
    r(['POST'], /^\/asset-conversions\/[^/]+\/approve$/i),
  ]},
  { key: 'caravans.broadcast', group: 'کاروان‌ها', label: 'ارسال پیام به اعضای یک کاروان', rules: [r(['POST'], /^\/caravans\/[^/]+\/broadcast$/i)] },

  // ---- راهبران
  { key: 'mentors.scorecards', group: 'راهبران', label: 'مشاهده کارنامه و ارزیابی راهبران', rules: [r(GET, /^\/mentors\/(scorecards|evaluations)$/i)] },
  { key: 'mentors.view', group: 'راهبران', label: 'مشاهده فهرست، پرونده و مدارک راهبران', tabs: ['mentors-profile-tab', 'mentors-docs-tab'], rules: [
    r(GET, /^\/mentors$/i), r(GET, /^\/mentors\/documents\/pending$/i), r(GET, /^\/mentors\/[^/]+\/(history|dossier)$/i),
  ]},
  { key: 'mentors.manage', group: 'راهبران', label: 'ثبت و ویرایش راهبر، تایید مدارک، تعلیق', sensitive: true, rules: [
    r(['POST'], /^\/mentors$/i), r(['PUT'], /^\/mentors\/[^/]+$/i), r(['POST'], /^\/mentors\/[^/]+\/(grant-stars|assign-caravans|moderate)$/i),
    r(['POST'], /^\/mentors\/documents\/[^/]+\/(approve|reject)$/i),
  ]},
  { key: 'tickets.handle', group: 'راهبران', label: 'مشاهده و پاسخ به تیکت‌های پشتیبانی', tabs: ['mentors-tickets-tab'], rules: [
    r(GET, /^\/tickets$/i), r(['POST'], /^\/tickets\/[^/]+\/(reply|resolve)$/i),
  ]},

  // ---- چالش‌ها
  { key: 'challenges.view', group: 'چالش‌ها و تکالیف', label: 'مشاهده چالش‌ها و تکالیف ارسال‌شده', tabs: ['submissions-tab'], rules: [r(GET, /^\/challenges$/i), r(GET, /^\/submissions$/i)] },
  { key: 'challenges.create', group: 'چالش‌ها و تکالیف', label: 'ایجاد چالش', rules: [r(['POST'], /^\/challenges$/i)] },
  { key: 'challenges.edit', group: 'چالش‌ها و تکالیف', label: 'ویرایش چالش', rules: [r(['PUT', 'PATCH'], /^\/challenges\/[^/]+$/i)] },
  { key: 'challenges.delete', group: 'چالش‌ها و تکالیف', label: 'حذف چالش', sensitive: true, rules: [r(['DELETE'], /^\/challenges\/[^/]+$/i)] },
  { key: 'submissions.review', group: 'چالش‌ها و تکالیف', label: 'تصحیح تکالیف و اعطای پاداش', rules: [r(['POST', 'PATCH'], /^\/submissions\/[^/]+\/review$/i)] },

  // ---- محتوای آموزشی
  { key: 'lms.view', group: 'محتوای آموزشی', label: 'مشاهده ساختار منزلگاه‌ها، کلاس‌ها و آزمون‌ها', tabs: ['lms-tab'], rules: [
    r(GET, /^\/lms\/(stations|classes|sessions|clips|quizzes)$/i), r(GET, /^\/courses\/hierarchy$/i),
  ]},
  { key: 'lms.manage', group: 'محتوای آموزشی', label: 'ساخت و ویرایش منزلگاه، کلاس، جلسه و آزمون', sensitive: true, rules: [
    r(WRITE, /^\/(lms|stations|courses)(\/.*)?$/i), r(['POST'], /^\/quizzes$/i),
  ]},
  { key: 'media.upload', group: 'محتوای آموزشی', label: 'آپلود فایل و ویدیو', rules: [r(['POST'], /^\/media\/upload$/i)] },
  { key: 'forms.view', group: 'محتوای آموزشی', label: 'مشاهده فرم‌ها', tabs: ['form-builder-tab'], rules: [r(GET, /^\/forms$/i)] },
  { key: 'forms.submissions', group: 'محتوای آموزشی', label: 'مشاهده پاسخ‌های فرم‌ها', rules: [r(GET, /^\/forms\/[^/]+\/submissions$/i)] },
  { key: 'forms.manage', group: 'محتوای آموزشی', label: 'ساخت و ویرایش فرم‌ها', rules: [
    r(['POST'], /^\/forms(\/fields|\/submit)?$/i), r(['DELETE'], /^\/forms(\/fields)?\/[^/]+$/i),
  ]},
  { key: 'instructors.view', group: 'محتوای آموزشی', label: 'مشاهده بانک اساتید', tabs: ['instructors-tab'], rules: [r(GET, /^\/instructors(\/[^/]+)?$/i)] },
  { key: 'instructors.manage', group: 'محتوای آموزشی', label: 'ثبت و ویرایش اساتید', rules: [r(['POST'], /^\/instructors$/i), r(['PUT', 'DELETE'], /^\/instructors\/[^/]+$/i)] },

  // ---- اخبار
  { key: 'news.view', group: 'اخبار و بنرها', label: 'مشاهده اخبار جارچی و بنرها', tabs: ['news-tab', 'banners-tab'], rules: [r(GET, /^\/news$/i), r(GET, /^\/banners$/i)] },
  { key: 'news.manage', group: 'اخبار و بنرها', label: 'انتشار، ویرایش و حذف اخبار و بنرها', rules: [r(['POST'], /^\/(news|banners)$/i), r(['PUT', 'DELETE'], /^\/(news|banners)\/[^/]+$/i)] },

  // ---- پیام‌رسانی
  { key: 'broadcast.send', group: 'پیام‌رسانی', label: 'ارسال پیام عمومی و اعلان', tabs: ['notifications-tab'], rules: [
    r(['POST'], /^\/announcements\/broadcast$/i), r(['POST'], /^\/notifications\/broadcast$/i),
  ]},
  { key: 'broadcast.log', group: 'پیام‌رسانی', label: 'مشاهده الگوها و سابقه ارسال‌ها', tabs: ['notifications-tab'], rules: [r(GET, /^\/notifications\/(templates|logs|overrides)$/i)] },
  { key: 'broadcast.settings', group: 'پیام‌رسانی', label: 'تعریف الگو و روشن/خاموش کردن کانال‌ها', rules: [r(['POST'], /^\/notifications\/(templates|overrides)$/i)] },
  { key: 'messages.use', group: 'پیام‌رسانی', label: 'صندوق پیام‌ها و پاسخ به کاربران', rules: [
    r(GET, /^\/messages$/i), r(['POST'], /^\/messages$/i), r(['POST'], /^\/messages\/[^/]+\/reply$/i),
  ]},
  { key: 'chat.view', group: 'پیام‌رسانی', label: 'نظارت بر گفتگوها', tabs: ['chat-tab'], rules: [r(GET, /^\/chat$/i)] },
  { key: 'chat.moderate', group: 'پیام‌رسانی', label: 'حذف پیام‌های گفتگو', rules: [r(['DELETE'], /^\/chat\/[^/]+$/i)] },

  // ---- گزارش و امنیت
  { key: 'analytics.view', group: 'گزارش‌ها و امنیت', label: 'آمار و داشبورد تحلیلی', tabs: ['analytics-tab'], rules: [r(GET, /^\/analytics$/i)] },
  { key: 'audit.view', group: 'گزارش‌ها و امنیت', label: 'مشاهده گزارشات و سابقه عملیات سیستم', sensitive: true, tabs: ['audit-tab'], rules: [r(GET, /^\/audit\/logs$/i)] },
  { key: 'security.manage', group: 'گزارش‌ها و امنیت', label: 'لیست سیاه، خروج اجباری نشست‌ها و تنظیمات سیستم', sensitive: true, rules: [
    r(['GET', ...WRITE], /^\/security\/.*$/i), r(['GET', ...WRITE], /^\/settings\/[^/]+$/i),
  ]},
];

export const PERMISSION_KEYS = PERMISSIONS.map(p => p.key);
const BY_KEY = new Map(PERMISSIONS.map(p => [p.key, p]));

/** Roles whose permissions are editable. The super admin always has everything. */
export const CONFIGURABLE_ROLES = ['SUB_ADMIN', 'mentor', 'student'] as const;
export type ConfigurableRole = typeof CONFIGURABLE_ROLES[number];

export const ROLE_LABELS_FA: Record<string, string> = {
  admin: 'سوپر ادمین', SUB_ADMIN: 'ادمین', mentor: 'راهبر', student: 'دانش‌آموز',
};

/** What each role could do before the matrix existed (unchanged until the super admin edits it). */
export const DEFAULT_ROLE_PERMISSIONS: Record<ConfigurableRole, string[]> = {
  SUB_ADMIN: [
    'challenges.view', 'challenges.create', 'lms.view', 'forms.view', 'forms.submissions', 'news.view', 'chat.view',
    'instructors.view', 'caravans.list', 'broadcast.send', 'broadcast.log', 'caravans.broadcast',
  ],
  mentor: [
    'users.view', 'caravans.view', 'tickets.handle', 'challenges.view', 'challenges.create', 'challenges.edit',
    'submissions.review', 'analytics.view', 'leaderboards.view', 'wallet.ledger', 'chat.view', 'messages.use',
    'lms.view', 'mentors.scorecards', 'forms.view', 'news.view', 'caravans.broadcast',
  ],
  student: [],
};

/** Roles that may enter the panel by default (the super admin cannot be switched off at role level). */
export const DEFAULT_PANEL_LOGIN: Record<string, boolean> = { admin: true, SUB_ADMIN: true, mentor: false, student: false };

/** Which configurable bucket a stored role belongs to. 'admin' is the super admin. */
export function configKey(role?: string | null): 'admin' | ConfigurableRole {
  const r = String(role || '').toLowerCase();
  if (r === 'admin') return 'admin';
  if (r === 'sub_admin') return 'SUB_ADMIN';
  if (r === 'mentor' || r === 'super_mentor' || r === 'dual') return 'mentor';
  return 'student';
}

export function isValidKey(key: string): boolean {
  return BY_KEY.has(key);
}

export function rulesForKeys(keys: Iterable<string>): Rule[] {
  const out: Rule[] = [];
  for (const k of keys) {
    const def = BY_KEY.get(k);
    if (def) out.push(...def.rules);
  }
  return out;
}

export function tabsForKeys(keys: Iterable<string>): string[] {
  const tabs = new Set<string>();
  for (const k of keys) {
    const def = BY_KEY.get(k);
    if (def?.tabs) def.tabs.forEach(t => tabs.add(t));
  }
  return Array.from(tabs);
}

export function matches(rules: Rule[], method: string, path: string): boolean {
  const m = method.toUpperCase();
  return rules.some(rule => rule.methods.includes(m) && rule.path.test(path));
}

/** Public (serialisable) view of the catalog for the matrix UI. */
export function catalogForClient() {
  return PERMISSIONS.map(p => ({ key: p.key, group: p.group, label: p.label, sensitive: !!p.sensitive }));
}